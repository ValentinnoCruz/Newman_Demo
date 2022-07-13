//Admin Controller
const {
  adjustStandbyImp,
  __collectMetrics,
} = require("../services/adminServiceImp");
const { err_401 } = require("../utils/responseCommon");
const logger = require("../../logger");

const adjustStandby = async (req, res, next) => {
  const AUTH_DISABLED =
    String(process.env.AUTH_DISABLED).toLowerCase() === "true";
  if (AUTH_DISABLED) {
    logger.warn("Authentication is disabled");
  } else {
    if (req.header("X-Appengine-Cron") !== "true") {
      logger.warn("X-Appengine-Cron header is not true, sending 401");
      const { statusCode, message } = err_401();
      return res.status(statusCode).json({ message });
    }
  }
  const { statusCode, message } = await adjustStandbyImp();
  res.status(statusCode).json({ message });
};

const collectMetrics = async (req, res, next) => {
  const AUTH_DISABLED =
    String(process.env.AUTH_DISABLED).toLowerCase() === "true";
  if (AUTH_DISABLED) {
    logger.warn("Authentication is disabled");
  } else {
    if (req.header("X-Appengine-Cron") !== "true") {
      logger.warn("X-Appengine-Cron header is not true, sending 401");
      const { statusCode, message } = err_401();
      return res.status(statusCode).json({ message });
    }
  }
  const { statusCode, message } = await __collectMetrics();
  res.status(statusCode).json({ message });
};

module.exports = {
  adjustStandby,
  collectMetrics,
};
