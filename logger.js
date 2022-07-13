const cls = require("cls-hooked");
const ns = cls.getNamespace("global");

const winston = require("winston");
const winstonLogger = winston.createLogger({
  level: "debug",
  format: winston.format.simple(),
});

const logger = {
  ns: ns,
  getLogger: function (isGlobal) {
    if (isGlobal) {
      return winstonLogger;
    }
    const IN_GCP = String(process.env.IN_GCP).toLowerCase() === "true";
    if (!IN_GCP) {
      return winstonLogger;
    }

    try {
      req = ns.get("req");
      if (req) {
        return req.log;
      } else {
        return winstonLogger;
      }
    } catch (e) {
      winstonLogger.error(e);
    }
  },
  error: function (message, err, meta) {
    let errMsgStack = "";
    if (err) {
      errMsgStack = err.message + " " + err.stack;
    }
    this.getLogger().error(message + " " + errMsgStack, meta);
  },
  warn: function (message, meta) {
    this.getLogger().warn(message, meta);
  },
  info: function (message, meta) {
    this.getLogger().info(message, meta);
  },
  debug: function (message, meta) {
    this.getLogger().debug(message, meta);
  },
  start: function (message, meta) {
    if (meta) {
      meta.label = "START";
    } else {
      meta = { label: "START" };
    }
    this.getLogger().info("START: " + message, meta);
  },
  end: function (message, meta) {
    if (meta) {
      meta.label = "END";
    } else {
      meta = { label: "END" };
    }
    this.getLogger().info("END: " + message, meta);
  },
  http: function (message, request, response, meta) {
    if (meta) {
      meta.label = "HTTP";
      meta.request = JSON.stringify(request);
      meta.response = JSON.stringify(response);
    } else {
      meta = {
        label: "HTTP",
        request: JSON.stringify(request),
        response: JSON.stringify(response),
      };
    }
    this.getLogger().debug("HTTP: " + message, meta);
  },
};

module.exports = logger;
