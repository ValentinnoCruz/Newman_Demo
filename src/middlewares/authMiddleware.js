const {err_401} = require('../utils/responseCommon');
const {jwtAccessTokenIsValid} = require('../services/authServiceImp');
const logger = require("../../logger");

const isAuthorized = async (req, res, next) => {
  const AUTH_DISABLED = String(process.env.AUTH_DISABLED).toLowerCase() === "true";
  if (AUTH_DISABLED) {
    logger.warn("Authentication is disabled");
    next();
    return
  }

  let authToken = req.headers['authorization'];
  if (authToken.startsWith('Bearer ')) {
    authToken = authToken.substring(7)
  }

  const jwtToken = jwtAccessTokenIsValid(authToken);
  if(!jwtToken) {
    const {statusCode, message} = err_401();
    return res.status(statusCode).json({message});
  }
  req.decodedJWT = jwtToken;
  next();
}

module.exports = {
  isAuthorized,
}
