const axios = require('axios');
const {findAll, initUser} = require('../models/userDBModel')
const playfabTitleID = process.env.PLAYFAB_TITLE_ID || "59D13"; // default to dev
const GetAccountInfoUrl = `https://${playfabTitleID}.playfabapi.com/Client/GetAccountInfo`;
const logger = require("../../logger");

const getUserId = async () => {
  return {"id": "value of users"}
}

const getPlayerIdFromPlayfabAuthToken = async (token) => {
  const data = {}
  const headers= {"X-Authorization": token}
  try {
    const res = await axios.post(GetAccountInfoUrl, data, {headers: headers});
    if(res) {
      return res.data.data.AccountInfo.PlayFabId;
    }
  } catch (e) {
    logger.error()
  }
  return null;
}

module.exports = {
  getUserId,
  getPlayerIdFromPlayfabAuthToken,
  initUser,
}
