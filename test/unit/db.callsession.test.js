const assert = require("assert");
const testUtils = require("../test_utils")

const dbInstance = testUtils.initializeEnvironment(true);

const fs = require("fs");
const {GameServerDBModel} = require('../../src/models/gameServerDBModel')
const {CaptureMethodDBModel} = require('../../src/models/captureMethodDBModel')
const {initUser} = require('../../src/models/userDBModel')
const { ConfigDBModel, getValue, getNumValue, getBoolValue } = require('../../src/models/configDBModel')
const CallService = require("../../src/services/callServiceImp");
const {dbStatus} = require("../../src/utils/dbUtils");
const dbRelationships = require("../../src/models/dbRelationships")

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

before("Populate db", async () => {
    await dbInstance.authenticate()
    await dbRelationships.init();
    await dbInstance.sync();
    await ConfigDBModel.upsert({"key": "CAPACITY_PER_SERVER", "value": "2"})
    await sleep(1500); // wait until the config cache is refreshed

})

after(async () => {
    dbInstance.close();
    if(fs.existsSync(dbInstance.options.host)) {
      fs.unlinkSync(dbInstance.options.host);
    }
})

describe("Get remote server test",  () => {
  it("Should get remote server matching requested server", async () =>
  {
    const user1Id = "517832B9BD3FE23D";
    const user2Id = "5A73AA3555EA3C11";
    await initUser(user1Id);
    await initUser(user2Id);
    const callId = await CallService.initialize(user1Id, user2Id)


    await CaptureMethodDBModel.upsert({"method": "webrtc","capacity": 2});
    await CaptureMethodDBModel.upsert({"method": "ccapi","capacity": 1});
    const gameServer1ExternalIp= "35.188.14.30";
    const gameServer2ExternalIp= "34.132.213.188"

    const gameServer = await GameServerDBModel.create({"id": "kokomo-gs-2022-05-04t21-33-00-936z", "status": dbStatus.ACTIVE, "zone": "zone", "externalIp": gameServer1ExternalIp})
    const gameServer2 = await GameServerDBModel.create({"id": "kokomo-gs-2022-05-04t17-41-00-713z", "status": dbStatus.ACTIVE, "zone": "zone", "externalIp": gameServer2ExternalIp})

    const userIp = "144.121.192.5"
    const requestServer1 = await CallService.requestServer(user1Id, callId, userIp, "webrtc");
    assert.equal( requestServer1.statusCode, 200);
    const requestServer2 = await CallService.requestServer(user2Id, callId, userIp, "webrtc");
    assert.equal( requestServer2.statusCode, 200);

    const remoteServer1 = await CallService.getRemoteServer(user1Id, callId, userIp);
    const remoteServer2 = await CallService.getRemoteServer(user2Id, callId, userIp);

    assert.equal(requestServer1.message, remoteServer2.message[0]["ip"])
    assert.equal(requestServer2.message, remoteServer1.message[0]["ip"])

    await gameServer.update({"status": dbStatus.DISABLE}) // clean up
    await gameServer2.update({"status": dbStatus.DISABLE}) // clean up
  })


})
