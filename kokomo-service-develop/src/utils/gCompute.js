const compute = require('@google-cloud/compute')
const _ = require('lodash')
const { GameServerDBModel } = require('../models/gameServerDBModel')
const { dbStatus } = require('./dbUtils');
const net = require('net');
const spawnZone = 'us-central1-a';
const fwNameIpv4 = 'allow-v4'
const fwNameIpv6 = 'allow-v6'
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'gcp-kokomo-dev'
const logger = require("../../logger");
const {CallSessionDBModel} = require("../models/callSessionDBModel");
const {Op} = require("sequelize");
const NONE_IPv4 = '0.0.0.0/0';
const NONE_IPv6 = '0::0/0';


const syncInstancesAndDB = async () => {
  const instancesClient = new compute.InstancesClient();
  const [instanceList] = await instancesClient.list({
    project: projectId,
    zone: spawnZone,
  });

  // 1 - Get all instances in GCP and add them to a set, add them to our list of game servers if they exist
  // this can happen if our database gets wiped accidentally, we don't want to leave unused instanced hanging
  let matchingInstances = new Set()

  function mapInstanceStatus(status) {
    if(status === 'RUNNING')
    {
      return dbStatus.ACTIVE;
    }
    else if(status === 'PROVISIONING')
    {
      return dbStatus.INITIALIZING
    }
    else
    {
      return dbStatus.ENDED
    }
    return undefined;
  }

  for (const instance of instanceList) {
    if(/kokomo-gs-[0-9]{4}-[0-9]{2}-[0-9]{2}t[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{1,5}z/.test(instance.name))
    {
      logger.info(` - ${instance.name} (${JSON.stringify(
          {
            id: instance.name,
            zone: spawnZone,
            status: instance.status,
            externalIp: instance.networkInterfaces[0].accessConfigs[0].natIP || '0'
          }
      )})`);
      matchingInstances.add(instance.name);
      let gameSV = await GameServerDBModel.findByPk(instance.name);
      if(!gameSV) {
        gameSV = GameServerDBModel.build({id: instance.name});
      }
      gameSV.zone = spawnZone;
      gameSV.status = mapInstanceStatus(instance.status);
      gameSV.externalIp= `${instance.networkInterfaces[0].accessConfigs[0].natIP}` || '0';
      await gameSV.save();
    } else
    {
      logger.info(`found instance with name ${instance.name} which does not seem to be a spawned Kokomo game server`);
    }
  }
  // 2 - find all instances the game server db thinks exists and make sure they are in gcp,
  // if they are not, mark them as errored and end all calls associated with them
  let instances_in_db = await GameServerDBModel.findAll({
    attributes: ['id'],
    where: { [Op.or]: [
        {status: dbStatus.ACTIVE},
        {status: dbStatus.INITIALIZING}
      ]}
  })
  for(let instance of instances_in_db)
  {
    let id = instance.getDataValue('id');
    if (!matchingInstances.has(id))
    {
      // if the instance is in the db but not in gcp
      logger.warn(`Instance ${id} was present in db but not in GCP, marking as errored and ending all calls associated with it`);
      let num_gs_updated = await GameServerDBModel.update(
        { status: dbStatus.ENDED },
        { where: { id: id } }
      );

      let num_calls_updated = await CallSessionDBModel.update(
        {status: dbStatus.ENDED},
        {
          where: {gameServerId: id}
        },
      );
      logger.warn(`Marked ${num_gs_updated} game servers as ended and ${num_calls_updated} calls`);
    }
  }

}

const buildFirewallRuleName = (ipAddress, userId) => {
  let name = net.isIPv4(ipAddress)? fwNameIpv4: fwNameIpv6;
  if(userId) {
    name += userId.toLowerCase();
  }
  name += '-kkm';
  return name;
}

const createNewFwNetwork = async (ipAddress, userId) => {
  const network = new compute.NetworksClient();
  const operationsClient = new compute.GlobalOperationsClient();
  const [nwList] = await network.list({project: projectId});
  if(nwList) {
    const kokomoVPC = nwList.find(nw =>nw.name===process.env.VPC_NETWORK_NAME);
    if(kokomoVPC) {
      const computeProtos = compute.protos.google.cloud.compute.v1;
      const newFW = new computeProtos.Firewall();
      const firewallsClient = new compute.FirewallsClient();
      newFW.targetTags= ['allow-all-canon', 'development'];
      newFW.priority = 1000;
      newFW.direction= 'INGRESS';
      newFW.allowed = [
        {
          IPProtocol: 'tcp',
          ports: ['80', '443', '8081', '8082', '8091'],
        },
      ];
      newFW.name = buildFirewallRuleName(ipAddress, userId);
      const ip = `${ipAddress}${net.isIPv4(ipAddress)? '/32' : '/64'}`;
      newFW.sourceRanges = [ip];
      newFW.network= kokomoVPC.selfLink;
      try {
        const [response] = await firewallsClient.insert({
          project: projectId,
          firewallResource: newFW,
        });
        operation = response.latestResponse;
        // Wait for the create operation to complete.
        while (operation.status !== 'DONE') {
          [operation] = await operationsClient.wait({
            operation: operation.name,
            project: projectId,
          });
        }
      logger.info('Firewall rule created');
      } catch (e) {
        logger.error('Firewall create failed', e)
      }
    }
  }
}
let operation = null;
const deleteIPs = [];
const addIPs = [];
const waitForFWReady = async () => {
  const operationsClient = new compute.GlobalOperationsClient();
  // Wait for the create operation to complete.
  while (operation && operation.status !== 'DONE') {
    console.log("waiting", operation.name);
    [operation] = await operationsClient.wait({
      operation: operation.name,
      project: projectId,
    });
  }
  if(operation) {
    console.log("end waiting", operation.name);
    operation = null;
  }
}
const updateFw = async (policy, projectId, fwRule) => {
  if(!fwRule) {
    return;
  }
  try {
    await waitForFWReady();
    const [response] = await policy.update({
      firewall: fwRule.name,
      firewallResource: fwRule,
      project: projectId,
    })
    operation = response.latestResponse;
  } catch (e) {
    logger.error('Firewall update failed', e)
  }
}

const removeFW = async (firewallRuleName) => {
  try {
    const firewallsClient = new compute.FirewallsClient();
    const operationsClient = new compute.GlobalOperationsClient();

    const [response] = await firewallsClient.delete({
      project: projectId,
      firewall: firewallRuleName,
    });
    let operation = response.latestResponse;
    // Wait for the create operation to complete.
    while (operation.status !== 'DONE') {
      [operation] = await operationsClient.wait({
        operation: operation.name,
        project: projectId,
      });
    }
  } catch (e) {
    logger.error('Firewall rule delete fell', e);
  }
  logger.info('Firewall rule deleted');
}

const addIpAddressIntoNetwork = async (ipAddress, userId) => {
  if(String(process.env.IN_GCP).toLowerCase() !== "true") {
    return;
  }
  if(!ipAddress) return;
  const policy = new compute.FirewallsClient();
  const [fwList] = await policy.list({
    project: projectId,
    zone: spawnZone
  });
  let fwName = buildFirewallRuleName(ipAddress, userId);
  const fwRule = fwList.find(rule => rule.name === fwName);
  const ip = `${ipAddress}${net.isIPv4(ipAddress)? '/32' : '/64'}`;
  if(fwRule) {
    if(fwRule.sourceRanges.includes(ip)) {
      return;
    }
    if(fwRule.sourceRanges.includes(NONE_IPv4)) {
      fwRule.sourceRanges = _.remove(fwRule.sourceRanges, NONE_IPv4);
    }
    if(fwRule.sourceRanges.includes(NONE_IPv6)) {
      fwRule.sourceRanges = _.remove(fwRule.sourceRanges, NONE_IPv6);
    }
    fwRule.sourceRanges.push(ip);
    await updateFw(policy, projectId, fwRule);
  } else {
    await createNewFwNetwork(ipAddress, userId);
  }
}

const removeIpAddressFromNetwork = async (ipAddress, userId) => {
  if(String(process.env.IN_GCP).toLowerCase() !== "true") {
    return;
  }
  if(!ipAddress) return;
  const policy = new compute.FirewallsClient();
  const [fwList] = await policy.list({
    project: projectId,
    zone: spawnZone
  });
  let fwName = buildFirewallRuleName(ipAddress, userId);
  const fwRule = fwList.find(rule => rule.name === fwName);
  if(fwRule) {
    const ip = `${ipAddress}${net.isIPv4(ipAddress)? '/32' : '/64'}`;
    if(!fwRule.sourceRanges.includes(ip)) {
      return;
    }
    fwRule.sourceRanges = _.remove(fwRule.sourceRanges, ip);
    if (fwRule.sourceRanges.length === 0) {
      fwRule.sourceRanges = net.isIPv4(ipAddress) ? [NONE_IPv4] : [NONE_IPv6];
      await removeFW(fwName);
    } else {
      await updateFw(policy, projectId, fwRule);
    }
  }
}



module.exports = {
  syncInstancesAndDB,
  spawnZone,
  addIpAddressIntoNetwork,
  removeIpAddressFromNetwork,
}
