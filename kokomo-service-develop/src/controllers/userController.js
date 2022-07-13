//Import Services
const userService = require('../services/userServiceImp');
const auth = require('../services/authServiceImp')
const {StatusCode, err_401, ok} = require('../utils/responseCommon');

const init = async (req, res, next) => {
  const getUserId = async (xPlayfabAuthToken, mockPlayfabAuth) => {
    if(mockPlayfabAuth)
    {
      return xPlayfabAuthToken;
    }
    else
    {
      return await userService.getPlayerIdFromPlayfabAuthToken(
          xPlayfabAuthToken);
    }
  }

  const xPlayfabAuthToken = req.headers['x-playfab-auth-token'];
  const mockPlayfabAuth = (String(process.env.MOCK_PLAYFAB_AUTH).toLowerCase() === "true");
  const userId = await getUserId(xPlayfabAuthToken, mockPlayfabAuth);
  if(userId) {
    await userService.initUser(userId);
    const {accessToken, refreshToken} = await auth.generateInitialJWTAccessAndRefreshTokens(userId);
    return res.status(StatusCode.OK).json({message: "User successfully initialized", data: {accessToken, refreshToken}});
  } else {
    const {statusCode, message } = err_401();
    return res.status(statusCode).json({message});
  }
}

module.exports = {
  init,
}
