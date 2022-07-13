// Call Controller
const CallService = require('../services/callServiceImp')
const {StatusCode,ok, err_500, err_400, err_401, err_404} = require('../utils/responseCommon');
const logger = require("../../logger");

const initialize = async (req, res, next) => {
  let userIp = req.headers['x-forwarded-for'] ||req.socket.remoteAddress || req.connection.remoteAddress || '0.0.0.0';
  userIp = userIp.split(',')[0];
  const userId = req.body['user_id'];
  const callPlayerId = req.body['calling_player_id'];
  if(!callPlayerId && !userId) {
    const {statusCode, message} = err_400('calling_player_id is required!')
    res.status(statusCode).json({message});
  }
  const callId = await CallService.initialize(userId, callPlayerId, userIp);
  if(callId) {
    res.status(StatusCode.OK).json({call_id: callId});
  } else {
    const { statusCode, message} = err_500();
    res.status(statusCode).json({message});
  }
}
const requestServer = async (req, res, next) => {
  const callId = req.body['call_id'];
  const userId = req.body['user_id'];
  const captureMethod = req.body['capture_method'];
  let userIp = req.headers['x-forwarded-for'] ||req.socket.remoteAddress || req.connection.remoteAddress || '0.0.0.0';
  userIp = userIp.split(',')[0];
  if(!callId || !userId) {
    const {statusCode, message} = err_400('call_id and user_id is required!');
    res.status(statusCode).json({message: message});
  }
  try {
    const response = await CallService.requestServer(userId, callId, userIp, captureMethod);
    if(response.statusCode === StatusCode.OK) {
      return res.status(response.statusCode).json({server_ip: response.message});
    }
    return res.status(response.statusCode).json({message: response.message})
  } catch (e) {
    logger.error(e);
  }
  const {statusCode, message } = err_500();
  res.status(statusCode).json({message})
}
const getRemoteServer = async (req, res, next) => {
  const userId = req.query['user_id'];
  const callId = req.query['call_id'];
  if(!userId || !callId) {
    const {statusCode, message} = err_400('user_id and call_id are required!!');
    return res.status(statusCode).json({message});
  }
  const remoteServer = await CallService.getRemoteServer(userId, callId);
  if (remoteServer.statusCode === StatusCode.OK) {
    return res.status(remoteServer.statusCode).json({
      remote_servers:
      remoteServer.message
    });
  }
  res.status(remoteServer.statusCode).json({message: remoteServer.message});
}
const end = async (req, res, next) => {
  const callPlayerId = req.body['user_id'];
  try{
    if(callPlayerId) {
      const isOk = await CallService.endACallById(callPlayerId);
      if(isOk) {
        const { statusCode, message } = ok();
        return res.status(statusCode).json({message});
      }
    } else {
      const { statusCode, message } = err_400();
      return res.status(statusCode).json({message});
    }
  } catch (err) {
    logger.error(err);
  }
  const { statusCode, message } = err_404();
  return res.status(statusCode).json({message});
}

module.exports = {
  initialize,
  requestServer,
  getRemoteServer,
  end,
}
