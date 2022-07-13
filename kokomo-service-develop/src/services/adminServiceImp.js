const ConfigDbModel = require("../models/configDBModel");
const { CallSessionDBModel } = require("../models/callSessionDBModel");
const { GameServerDBModel } = require("../models/gameServerDBModel");
const logger = require("../../logger");
const { spawnZone, syncInstancesAndDB} = require("../utils/gCompute");
const { ok, err_500 } = require("../utils/responseCommon");
const { dbStatus } = require("../utils/dbUtils");
const _ = require("lodash");

const axios = require("axios");
const sequelize = require("sequelize");

const compute = require("@google-cloud/compute");
const monitoring = require("@google-cloud/monitoring");
const { ErrorReporting } = require("@google-cloud/error-reporting");
const { CaptureMethodDBModel } = require("../models/captureMethodDBModel");
const client = new monitoring.MetricServiceClient();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const pingUntilSuccessAsync = async (name, zone, project, pingIp) => {
  let pingSucceeded = false;
  let sleepInterval = 5000;
  let maxSleepTimeMs = 900000;
  let startTime = Date.now();
  while (!pingSucceeded) {
    try {
      await axios.get(`http://${pingIp}/ping`);
      await sleep(sleepInterval);
      pingSucceeded = true;
      logger.debug(`Successfully pinged game server, name: ${name}`);

      const updateResult = await GameServerDBModel.update(
        { status: dbStatus.ACTIVE },
        { where: { id: name } }
      );
      logger.debug(`Set server with name ${name} to ACTIVE`);
    } catch (e) {
      if (Date.now() > startTime + maxSleepTimeMs) {
        logger.error(`Failed to create instance : ${name}, deleting`);
        const inGcp = String(process.env.IN_GCP).toLowerCase() === "true";
        if (inGcp) {
          const errors = new ErrorReporting();
          errors.report("Failed to create game server instance");
        }

        const updateResult = await GameServerDBModel.update(
          { status: dbStatus.ERROR },
          { where: { id: name } }
        );

        const instancesClient = new compute.InstancesClient();
        await instancesClient.delete({
          project: project,
          zone,
          instance: name,
        });
        logger.debug(`Set server with name ${name} to ERROR`);
        return;
      }
      // no worries, retry
    }
  }
};

const spawnServer = async (zone = spawnZone) => {
  const instancesClient = new compute.InstancesClient();
  const gameServerMachineImage = await ConfigDbModel.getValue(
    "GAME_SERVER_MACHINE_IMAGE",
    "kokomo-game-server-0-0-1"
  );
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  if (!googleCloudProject) {
    logger.error(
      "GOOGLE_CLOUD_PROJECT env variable is not set but must be to create game servers"
    );
    throw new Error(
      "GOOGLE_CLOUD_PROJECT env variable is not set but must be to create game servers"
    );
  }
  const machineImageUri = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/global/machineImages/${gameServerMachineImage}`;
  const gameServerMachineType = await ConfigDbModel.getValue(
    "GAME_SERVER_MACHINE_TYPE",
    "n1-standard-4"
  );
  const gameServerGpuType = await ConfigDbModel.getValue(
    "GAME_SERVER_GPU_TYPE",
    "nvidia-tesla-t4"
  );
  const spawnDate = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-")
    .toLowerCase();
  const name = `kokomo-gs-${spawnDate}`;
  const network = process.env.GAME_SERVER_NETWORK || "kokomo-vpc-network";
  const region = zone.substr(0, zone.lastIndexOf("-"));
  logger.debug(
    `Creating new game server instance, name: ${name}, machine image: ${gameServerMachineImage}`
  );

  const [response] = await instancesClient.insert({
    instanceResource: {
      name: name,
      disks: [
        {
          // Describe the size and source image of the boot disk to attach to the instance.
          initializeParams: {
            diskSizeGb: "50",
          },
          autoDelete: true,
          boot: true,
          type: "PERSISTENT",
        },
      ],
      sourceMachineImage: machineImageUri,
      guestAccelerators: [
        {
          acceleratorCount: 1,
          acceleratorType: `projects/${googleCloudProject}/zones/${zone}/acceleratorTypes/${gameServerGpuType}`,
        },
      ],
      machineType: `zones/${zone}/machineTypes/${gameServerMachineType}`,
      networkInterfaces: [
        {
          // Use the network interface provided in the networkName argument.
          subnetwork: `projects/${googleCloudProject}/regions/${region}/subnetworks/game-server-subnet-${region}`,
          accessConfigs: [
            {
              name: "External NAT",
              networkTier: "PREMIUM",
            },
          ],
        },
      ],
    },
    project: googleCloudProject,
    zone,
  });
  let operation = response.latestResponse;
  const operationsClient = new compute.ZoneOperationsClient();

  // Wait for the create operation to complete.
  while (operation.status !== "DONE") {
    [operation] = await operationsClient.wait({
      operation: operation.name,
      project: googleCloudProject,
      zone: operation.zone.split("/").pop(),
    });
  }
  logger.debug(`Instance successfully created, name: ${name}`);
  const [instanceInfo] = await instancesClient.get({
    project: googleCloudProject,
    zone,
    instance: name,
  });
  const externalIp = instanceInfo.networkInterfaces[0].accessConfigs[0].natIP;
  const internalIp = instanceInfo.networkInterfaces[0].networkIP;

  const inGcp = String(process.env.IN_GCP).toLowerCase() === "true";

  await GameServerDBModel.create({
    id: name,
    zone: zone,
    status: "INITIALIZING",
    externalIp: `${externalIp}`,
  });

  const pingIp = inGcp ? internalIp : externalIp;

  // We do not want to wait for this as it can take too long, keep handling this on a separate thread
  pingUntilSuccessAsync(name, zone, googleCloudProject, `${pingIp}:8082`);
};

const deleteServer = async (name, zone) => {
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  if (!googleCloudProject) {
    logger.error(
      "GOOGLE_CLOUD_PROJECT env variable is not set but must be to create game servers"
    );
    throw new Error(
      "GOOGLE_CLOUD_PROJECT env variable is not set but must be to create game servers"
    );
  }

  const instancesClient = new compute.InstancesClient();
  await instancesClient.delete({
    project: googleCloudProject,
    zone,
    instance: name,
  });

  const deleteResult = await GameServerDBModel.destroy({ where: { id: name } });
};

const getAvailableServers = async (CAPACITY_PER_SERVER, captureMethod) => {
  const gSV = await GameServerDBModel.findAll({
    raw: true,
    attributes: [
      "id",
      "zone",
      "externalIp",
      "status",
      [sequelize.fn("COUNT", sequelize.col("game_server_id")), "active_calls"],
      [sequelize.col("CallSessions->CaptureMethod.method"), "method"],
      [sequelize.col("CallSessions->CaptureMethod.capacity"), "methodCapacity"],
    ],
    include: [
      {
        model: CallSessionDBModel,
        as: "CallSessions",
        required: false,
        attributes: [],
        include: [
          {
            model: CaptureMethodDBModel,
            as: "CaptureMethod",
            required: false,
            attributes: [],
          },
        ],
        where: {
          status: dbStatus.ACTIVE,
        },
      },
    ],
    where: {
      status: dbStatus.ACTIVE,
    },
    group: ["GameServer.id", "method"],
  });
  if (gSV) {
    const gSVList = {};
    gSV.forEach((sg) => {
      if (gSVList[sg.id]) {
        gSVList[sg.id].active_calls =
          gSVList[sg.id].active_calls + sg.active_calls;
        if (
          (sg.method === captureMethod &&
            sg.active_calls >= sg.methodCapacity) ||
          gSVList[sg.id].active_calls >= CAPACITY_PER_SERVER
        ) {
          gSVList[sg.id] = null;
        }
      } else {
        gSVList[sg.id] = sg;
        if (
          sg.method === captureMethod &&
          sg.active_calls >= sg.methodCapacity
        ) {
          gSVList[sg.id].active_calls = CAPACITY_PER_SERVER;
        }
        gSVList[sg.id].method = captureMethod;
      }
    });
    return _.sortBy(
      _.values(gSVList).filter(
        (gsv) => gsv != null && gsv.active_calls < CAPACITY_PER_SERVER
      ),
      ["externalIp"]
    );
  }
  return [];
};

const getCapacityPerServer = async () =>
  ConfigDbModel.getNumValue("CAPACITY_PER_SERVER", 1);

const adjustStandbyImp = async () => {
  await syncInstancesAndDB();

  const CAPACITY_PER_SERVER = await getCapacityPerServer();
  if (!Number.isInteger(CAPACITY_PER_SERVER)) {
    logger.error(
      `CAPACITY_PER_SERVER ${CAPACITY_PER_SERVER} is not an integer`
    );
    return err_500();
  }
  if (CAPACITY_PER_SERVER < 1) {
    logger.error(
      `CAPACITY_PER_SERVER ${CAPACITY_PER_SERVER} is smaller then 1`
    );
    return err_500();
  }
  try {
    const captureMethods = await CaptureMethodDBModel.findAll();
    if (!captureMethods) return;
    let rs = {};
    let results = [];
    for (const method of captureMethods) {
      const availableSv = await getAvailableServers(
        CAPACITY_PER_SERVER,
        method.method
      );
      if (availableSv.length > 0) {
        for (const aSV of availableSv) {
          if (!aSV.methodCapacity) {
            results.push(aSV);
          }
          const cap = method.capacity - aSV.active_calls;
          if (rs[aSV.id]) {
            rs[aSV.id] = _.min([rs[aSV.id], cap]);
          } else {
            rs[aSV.id] = cap;
          }
        }
      } else {
        rs = {};
      }
    }
    const currentStandbyCapacity = _.sum(_.values(rs));

    const MINIMUM_STANDBY_CAPACITY = await ConfigDbModel.getNumValue(
      "MINIMUM_STANDBY_CAPACITY",
      2
    );
    if (MINIMUM_STANDBY_CAPACITY < 1) {
      logger.error(
        `MINIMUM_STANDBY_CAPACITY ${MINIMUM_STANDBY_CAPACITY} is smaller then 1`
      );
      return err_500();
    }
    const MAXIMUM_STANDBY_CAPACITY = await ConfigDbModel.getNumValue(
      "MAXIMUM_STANDBY_CAPACITY",
      4
    );
    if (MAXIMUM_STANDBY_CAPACITY < 1) {
      logger.error(
        `MAXIMUM_STANDBY_CAPACITY ${MAXIMUM_STANDBY_CAPACITY} is smaller then 1`
      );
      return err_500();
    }
    if (currentStandbyCapacity < MINIMUM_STANDBY_CAPACITY) {
      const serverCountToSpawn = Math.ceil(
        (MINIMUM_STANDBY_CAPACITY - currentStandbyCapacity) /
          _.min(captureMethods.map((method) => method.capacity))
      );
      for (let i = 0; i < serverCountToSpawn; i++) {
        await spawnServer();
      }
    } else if (currentStandbyCapacity > MAXIMUM_STANDBY_CAPACITY) {
      const serverCountToDelete = Math.ceil(
        (currentStandbyCapacity - MAXIMUM_STANDBY_CAPACITY) /
          _.min(captureMethods.map((method) => method.capacity))
      );

      const serversToDelete = results
        .filter((res) => parseInt(res.active_calls) === 0)
        .slice(0, serverCountToDelete);
      for (const serverToDelete of serversToDelete) {
        await GameServerDBModel.update(
          { status: dbStatus.DELETING },
          { where: { id: serverToDelete.id } }
        );
      }
      for (const serverToDelete of serversToDelete) {
        const name = serverToDelete.id;
        const zone = serverToDelete.zone;
        await deleteServer(name, zone);
      }
    }
  } catch (e) {
    logger.error("failed to execute sql query", e);
    return err_500();
  }
  return ok("Server capacity adjusted");
};

const __collectMetrics = async () => {
  try {
    const num_active_calls = await CallSessionDBModel.count({
      where: { status: "ACTIVE" },
    });
    logger.debug(`Active calls = ${num_active_calls}`);

    const IN_GCP = String(process.env.IN_GCP).toLowerCase() === "true";
    if (!IN_GCP) {
      return ok();
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT;

    // Manual creation of a custom metric descriptor
    const createMetricDescriptor = async () => {
      const request = {
        name: client.projectPath(projectId),
        metricDescriptor: {
          displayName: "Active calls",
          description: "The number of active calls",
          type: "custom.googleapis.com/admin/active_calls",
          metricKind: "GAUGE",
          valueType: "INT64",
          unit: "1",
          labels: [
            {
              key: "call_type", // Dummy
              valueType: "STRING",
              description: "The type of calls",
            },
          ],
        },
      };
      const [descriptor] = await client.createMetricDescriptor(request);
      logger.debug("Created a custom metric descriptor", {
        request: request,
        descriptor: descriptor,
      });
    };
    createMetricDescriptor();

    // Write a custom metric
    const writeTimeSeriesData = async () => {
      const dataPoint = {
        interval: {
          endTime: {
            seconds: Date.now() / 1000,
          },
        },
        value: {
          int64Value: num_active_calls,
        },
      };

      const timeSeriesData = {
        metric: {
          type: "custom.googleapis.com/admin/active_calls",
          labels: {
            call_type: "test",
          },
        },
        resource: {
          type: "global",
          labels: {
            project_id: projectId,
          },
        },
        points: [dataPoint],
      };

      const request = {
        name: client.projectPath(projectId),
        timeSeries: [timeSeriesData],
      };

      const result = await client.createTimeSeries(request);
      logger.debug("Wrote a custom metric", {
        request: request,
        result: result,
      });
    };
    writeTimeSeriesData();
  } catch (e) {
    logger.error("Unexpected error", e);
    return err_500();
  }
  return ok();
};

module.exports = {
  adjustStandbyImp,
  getCapacityPerServer,
  getAvailableServers,
  __collectMetrics,
};
