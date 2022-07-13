const {Op, col} = require("sequelize");
const {CallSessionDBModel} = require('../models/callSessionDBModel')
const {GameServerDBModel} = require('../models/gameServerDBModel')
const {getCapacityPerServer, getAvailableServers, getAvailableCCAPIServers} = require('./adminServiceImp');
const {dbStatus} = require('../utils/dbUtils');
const {err_400, ok, err_503, err_500, err_404} = require('../utils/responseCommon');
const logger = require("../../logger");
const {addIpAddressIntoNetwork, removeIpAddressFromNetwork} = require('../utils/gCompute');
// Call Service
const initialize = async (userId, callPlayerId) =>
{
    const [num, rows] = await CallSessionDBModel.update(
        {status: dbStatus.ENDED},
        {
            where: {
                [Op.and]: [
                    {
                        [Op.or]: [
                            {status: dbStatus.ACTIVE},
                            {status: dbStatus.INITIALIZING}
                        ]
                    },
                    {
                        [Op.or]: [
                            {userId: userId},
                            {userId: callPlayerId}
                        ]
                    }
                ]
            },
            returning: true
        },
    );
    if(num > 0) {
      rows.map(call => removeIpAddressFromNetwork(call.userIp, userId));
    }
    const userCallSession = CallSessionDBModel.build({userId: userId, status: dbStatus.INITIALIZING});
    const calledCallSession = CallSessionDBModel.build({id: userCallSession.id, userId: callPlayerId, status: dbStatus.INITIALIZING});
    await userCallSession.save();
    await calledCallSession.save();

    logger.info(`Initialized call, caller id: ${userId}, called id: ${callPlayerId}, call id: ${userCallSession.id}`);
    return userCallSession.id;
}

const requestServer = async (userId, callId, userIp, captureMethod='webrtc') => {
  const callSession = await CallSessionDBModel.findOne({where: {id: callId, userId: userId, status: dbStatus.INITIALIZING}});
  if(callSession) {
    const capacityPerServer = await getCapacityPerServer();

    const availableServers = await getAvailableServers(capacityPerServer, captureMethod);

    if(availableServers.length > 0) {
      callSession.gameServerId = availableServers[0].id;
      callSession.status= dbStatus.ACTIVE;
      callSession.captureMethod = captureMethod.toLowerCase();
      if(Array.isArray(userIp) && userIp.length > 0) {
        callSession.userIp = userIp[0];
      } else {
        callSession.userIp = userIp;
      }
      await callSession.save();
      if(Array.isArray(userIp) && userIp.length > 0) {
        await addIpAddressIntoNetwork(userIp[0], userId);
      } else {
        await addIpAddressIntoNetwork(userIp, userId);
      }
      return ok(availableServers[0].externalIp);
    } else {
        return err_503("No servers available, retry later.");
    }
  }
  return err_400('Call must be initialized before requesting a server');
}

const getRemoteServer = async (userId, callSessionId, userIp) => {
  const sSession = await CallSessionDBModel.findOne({where: {
    id: callSessionId,
      userId:userId
    }});
  if(sSession) {
    sSession.userIp= userIp;
    await sSession.save();
  }
  const allRemoteServer = await CallSessionDBModel.findAll({
    attributes: [
        'userId',
        [col('external_ip'), 'externalIp' ],
    ],
    include: [
      {
        model: GameServerDBModel,
        as: 'GameServer',
        required: true,
        attributes: [],
        where: {
          'status': dbStatus.ACTIVE
        }
      }
    ],
    where: {
      [Op.and]: [
        {id: callSessionId},
        {userId: {[Op.ne]:userId}},
        {gameServerId: {[Op.not]: null}},
        {status: dbStatus.ACTIVE}
      ]
    },
    group: ['CallSession.user_id', 'GameServer.external_ip']
  });
  if(!allRemoteServer || allRemoteServer.length === 0) {
    return err_404('Could not find remote server')
  }
  return ok(allRemoteServer.map((remoteServer) => {
    return ({ip: remoteServer.getDataValue('externalIp'), user_id: remoteServer.getDataValue('userId')})
  }));
}

const endACallById = async (userId) => {
  const callSession = await CallSessionDBModel.findOne({
    where: {
      userId: userId,
      [Op.or]: [
        {status: dbStatus.INITIALIZING},
        {status: dbStatus.ACTIVE}
      ]
    }
  });
  if (callSession) {
    callSession.status = dbStatus.ENDED;
    if (callSession.userIp) {
      try {
        removeIpAddressFromNetwork(callSession.userIp, userId);
      } catch (e) {
        logger.error('Failed to remove ip address from network',e )
      }
    }
    await callSession.save();
    return true;
  }
  return false;
}

const endAllCallById = async (userId) => {
  const callSession = await CallSessionDBModel.findOne({where: {userId: userId, [Op.or]: [
        {status: dbStatus.INITIALIZING},
        {status: dbStatus.ACTIVE}
      ]}});
  if(callSession) {
    const oCallSession = await CallSessionDBModel.findAll({
      where: {
        id: callSession.id,
      }
    });
    if (oCallSession) {
      for (const o of oCallSession) {
        o.status = dbStatus.ENDED;
        if (callSession.userIp) {
          try {
            removeIpAddressFromNetwork(callSession.userIp, userId);
          } catch (e) {
            logger.error('Failed to remove ip address from network',e )
          }
        }
        await o.save();
      }
    }
    return true;
  }
  return false;
}


module.exports = {
  initialize,
  requestServer,
  endACallById,
  endAllCallById,
  getRemoteServer,
}
