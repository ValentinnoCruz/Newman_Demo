const cls = require("cls-hooked");
const ns = cls.createNamespace("global");

const express = require("express");
require("express-async-errors");
const path = require("path");
const http = require("http");
const OpenApiValidator = require("express-openapi-validator");

const { ConfigDBModel } = require("./src/models/configDBModel");

const userRoute = require("./src/routes/user.route");
const callRoute = require("./src/routes/call.route");
const adminRoute = require("./src/routes/admin.route");
const auth = require("./src/routes/auth.route");

const port = parseInt(process.env.PORT) || 3000;

const apiSpec = path.join(__dirname, "api.json");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require(apiSpec);
const { err_500 } = require("./src/utils/responseCommon");

const winston = require("winston");
const loggingWinston = require("@google-cloud/logging-winston");
const logger = require("./logger");
const {responseJsonBuilder} = require('./src/utils/utils');

let logBodyMaxLength = 20000;
try{
  if(process.env.LOG_BODY_MAX_LENGTH)
  {
    logBodyMaxLength = parseInt(process.env.LOG_BODY_MAX_LENGTH);
  }
} catch (e)
{
  logger.warn(`Failed to parse env variable LOG_BODY_MAX_LENGTH as int, value was ${process.env.LOG_BODY_MAX_LENGTH}, err: ${e.message}`)
  // can't parse log body max length, its ok we will use default
}
// only log the request/response body in dev/staging, in production we don't want to log PII
const shouldLogReqBody = process.env.STAGE && ["stg", "dev"].includes(process.env.STAGE.toLowerCase())

const server = async function () {
  const app = express();

  winstonLogger = logger.getLogger(true);
  if (String(process.env.IN_GCP).toLowerCase() === "true") {
    winstonLogger.add(new loggingWinston.LoggingWinston());
    const requestLogger = await loggingWinston.express.makeMiddleware(
      winstonLogger
    );
    app.use(requestLogger);
  } else {
    winstonLogger.add(new winston.transports.Console());
  }

  app.use(express.urlencoded({ extended: false }));
  app.use(express.text());
  app.use(express.json());

  app.use((req, res, next) => {
    const oldJson = res.json;
    res.json = (body) => {
      res.locals.body = body;
      return oldJson.call(res, body);
    };
    next();
  });

  app.use(function (req, res, next) {
    ns.run(() => {
      ns.set("req", req);
      next();
    });
  });


  app.use(function (err, req, res, next) {
    let { returnStatus, returnMessage } = err_500();
    if (err && err.status && err.message) {
      // We only want to
      if (err.status >= 400 && err.status < 500) {
        returnStatus = err.status;
        returnMessage = err.message;
      } else {
        if (
          err.errors &&
          err.errors.length > 0 &&
          err.errors[0] &&
          err.errors[0].errorCode &&
          err.errors[0].errorCode.endsWith("openapi.validation")
        ) {
          logger.error("OpenAPI Validation error:", err);
        } else {
          logger.error("Unexpected server error:", err);
        }
      }
    }

    res.status(returnStatus).json({
      message: returnMessage,
    });
    next()
  });


  app.use(function (req, res, next) {
    const savedPath = req.path;

    const reqLogPayload = { logType: 'REQUEST', path: savedPath};
    if(shouldLogReqBody) {
      let bodyString;
      if (typeof req.body === 'string') {
        bodyString = req.body;
      } else {
        bodyString = JSON.stringify(req.body)
      }
      if (bodyString.length <= logBodyMaxLength) {
        reqLogPayload.requestBody = req.body;
      } else {
        reqLogPayload.requestBody = "unavailable - too big to log";
      }
      reqLogPayload.requestHeader = req.headers;
    }

    logger.info(`${req.method} @ ${savedPath}`, reqLogPayload);
    res.on("finish", function () {
      const resLogPayload = {logType: 'RESPONSE', path: savedPath};
      if (shouldLogReqBody) {
        resLogPayload.responseHeader = res.headers;
        let body = res.body;
        if (body && body.length <= logBodyMaxLength) {
          try {
            body = JSON.parse(body);
          } catch (e) {
            // do nothing, if JSON is bad just log as is.
          }
          resLogPayload.responseBody = body;
        } else if (body) {
          reqLogPayload.responseBody = "unavailable - too big to log";
        }
        else if(res.locals && res.locals.body)
        {
          resLogPayload.responseBody = res.locals.body;
        }
        resLogPayload.responseCode = res.statusCode;
      }
      logger.info(`END ${req.method} @ ${savedPath} - ${res.statusCode}`, resLogPayload);
    });
    next();
  });

  app.use(
    OpenApiValidator.middleware({
      apiSpec,
      validateResponses: false, // default false
    })
  );

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  app.use("/api/v1/user", userRoute);
  app.use("/api/v1/call", callRoute);
  app.use("/api/v1/admin", adminRoute);
  app.use("/api/v1/auth", auth);

  app.get("/api/v1/ping", function (req, res, next) {
    res.status(200).json({ message: "pong" });
    logger.info("pong1");
    logger.info("pong2");
    next();
  });

  const enableAbout = process.env.STAGE && ["stg", "dev"].includes(process.env.STAGE.toLowerCase())
  if(enableAbout){
    app.get("/api/v1/about", async function (req, res, next) {
      const allConfig = await ConfigDBModel.findAll();
      res.status(200).json(responseJsonBuilder({message: 'kokomo-service', config: allConfig}));
      next();
    });
  }

  http.createServer(app).listen(port);
  logger.info(`Listening on port ${port}`);
};

module.exports = server;
