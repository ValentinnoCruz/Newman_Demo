const authService = require('../services/authServiceImp');
const {err_401, StatusCode} = require('../utils/responseCommon');
const {refreshAccessToken} = require('../services/authServiceImp');
const axios = require("axios");

const playfabTitleID = process.env.PLAYFAB_TITLE_ID || "59D13"; // default to dev
const playfabSecretKey = process.env.PLAYFAB_SECRET_KEY || "JEX69NS1QQTXWYQ4X538CBI338YU557GJRDOXKN5Z74URFF8MY"; // default to dev

const refreshJwtToken = async (req, res, next) => {
  const refreshToken = req.body['refresh_token'];
  if(!refreshToken) {
    const {statusCode, message} = err_401();
    return res.status(statusCode).json({message});
  }
  const accessToken = await refreshAccessToken(refreshToken);
  if(accessToken) {
    return res.status(StatusCode.OK).json({access_token: accessToken});
  }
  const {statusCode, message} = err_401();
  return res.status(statusCode).json({message});
}

const refreshPlayfabSessionToken = async (req, res, next) => {
  const playfabId = req.decodedJWT.userId;

  let linkServerCustomIdResp = await axios.post(`https://${playfabTitleID}.playfabapi.com/Server/LinkServerCustomId`,{
    "ServerCustomId":playfabId,
    "PlayFabId": playfabId
  },{
    headers: {
      'X-SecretKey': playfabSecretKey
    }
  })

  console.info(`Link server response code: ${linkServerCustomIdResp.status}`);

  let serverCreatedAccountResp = await axios.post(`https://${playfabTitleID}.playfabapi.com/Server/LoginWithServerCustomId`,{
    "ServerCustomId":playfabId
  },{
    headers: {
      'X-SecretKey': playfabSecretKey
    }
  })

  console.info(`logged in with Playfab custom server account`);

  let serverSessionTicket = serverCreatedAccountResp.data.data.SessionTicket;
  let serverEntityTicket = serverCreatedAccountResp.data.data.EntityToken.EntityToken;
  return res.status(StatusCode.OK).json({playfab_session_token: serverSessionTicket, playfab_entity_token: serverEntityTicket});
}

module.exports = {
  refreshJwtToken,
  refreshPlayfabSessionToken
}
