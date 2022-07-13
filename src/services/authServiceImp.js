const jwt = require('jsonwebtoken');
const {UserDBModel} = require('../models/userDBModel');
const {getValue} = require('../models/configDBModel')
const logger = require("../../logger");

const accessTokenLife = async () => await getValue("ACCESS_TOKEN_LIFE", "30m");
const refreshTokenLife = async () => await getValue("REFRESH_TOKEN_LIFE", "1y");
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || '4M8mzGf70LgbLd5O0p0d';
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'b26583ea-8e96-406f-82c4-d4a8d5e2d8b4';

/**
 * Generate our initial access and refresh token for the given user
 * @param {string} userId
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
const generateInitialJWTAccessAndRefreshTokens = async (userId) => {
  if (!userId) throw new Error('userId is a required parameter');

  let accessToken = await generateJWTToken(getJWTPayload(userId), accessTokenSecret, await accessTokenLife());
  let refreshToken = await generateJWTToken(getJWTPayload(userId), refreshTokenSecret, await refreshTokenLife());
  return {accessToken, refreshToken};
}

/**
 * Check if a JWT access token is valid, this function will return true only if:
 *    - the access token exists
 *    - the access token is not expired
 *    - the access token is correctly signed
 * @param {string} accessToken
 * @returns {boolean}
 */
const jwtAccessTokenIsValid = (accessToken) => {
  if (!accessToken) {
    return false
  }

  try {
    return jwt.verify(accessToken, accessTokenSecret);
  } catch (error) {
    logger.error(`Error in verify access token:  + ${error}`);
    return false;
  }
};

/**
 * Retrieve a new access token from the refresh token, this function will return null if:
 *  - the refresh token is expired
 *  - the refresh token can't be verified
 *  - the refresh token does not contain the userId field
 *  - the user associated with the refresh token is deleted
 * @param refreshToken
 * @returns {Promise<string|null>}
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    const jwtData = jwt.verify(refreshToken, refreshTokenSecret);
    if (!jwtData) { // if the token can't be decoded
      return null;
    }
    const userId = jwtData.userId;
    if (!userId)
    {
      logger.error(`JWT refresh token does not contain required field userId`);
      return null;
    }
    let userInstance = await UserDBModel.findOne({where: {id: userId}})
    if (!userInstance) // if the user was deleted from the database, we will not refresh their access token
    {
      logger.info(`Failing access token refresh as user id ${userId} no longer exists`);
      return null;
    }

    return await generateJWTToken(getJWTPayload(userId), accessTokenSecret, await accessTokenLife());
  } catch (e) { // can happen if token is expired of can't be verified
    logger.error(e.message)
    return null;
  }
}

/**
 * Generate a JWT access or refresh token
 * @param payload data payload to encode
 * @param secret JWT secret to encode
 * @param tokenLife Length of time the token should live for
 * @returns {string|null}
 */
const generateJWTToken = (payload, secret, tokenLife) => {
  try {
    return jwt.sign(
      payload,
      secret,
      {
        algorithm: 'HS256',
        expiresIn: tokenLife,
      },
    );
  } catch (error) {
    logger.error(`Error in generate access token:  + ${error}`);
    return null;
  }
};

/**
 * Get the JWT payload for a given user
 * @param userId
 * @returns {{userId}}
 */
const getJWTPayload = (userId) => {
  // quite simple for now but we will likely want to extend this with a user's premium status
  return {
    userId: userId
  }
}

module.exports = {
  generateInitialJWTAccessAndRefreshTokens,
  jwtAccessTokenIsValid,
  refreshAccessToken,
}
