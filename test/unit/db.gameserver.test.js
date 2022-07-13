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

describe("Game server request test",  () => {
  it("Should get 1 CCAPI server calls", async () =>
  {
    const user1Id = "CCAPIRequestTestUser1";
    const user2Id = "CCAPIRequestTestUser2";
    await initUser(user1Id);
    await initUser(user2Id);
    const callId = await CallService.initialize(user1Id, user2Id)

    await CaptureMethodDBModel.upsert({"method": "webrtc","capacity": 2});
    await CaptureMethodDBModel.upsert({"method": "ccapi","capacity": 1});

    const gameServer = await GameServerDBModel.create({"id": "1", "status": dbStatus.ACTIVE, "zone": "zone", "externalIp": "1.1.1.1"})

    const response = await CallService.requestServer(user1Id, callId, "1.1.1.1", "ccapi");
    assert.equal( response.statusCode, 200);
    const ccapiResponse2 = await CallService.requestServer(user2Id, callId, "1.1.1.1", "ccapi");
    assert.equal( ccapiResponse2.statusCode, 503);
    await gameServer.update({"status": dbStatus.DISABLE}) // clean up
  })

  it("Should not get a server as it is initializing", async () =>
  {
    const user1Id = "initializingcalluser";
    const user2Id = "initializingcalluser2";

    await initUser(user1Id);
    await initUser(user2Id);
    const callId = await CallService.initialize(user1Id, user2Id)

    await CaptureMethodDBModel.upsert({"method": "webrtc","capacity": 2});
    await CaptureMethodDBModel.upsert({"method": "ccapi","capacity": 1});

    const gameServer = await GameServerDBModel.create({"id": "2", "status": dbStatus.INITIALIZING, "zone": "zone", "externalIp": "1.1.1.1"})

    const response = await CallService.requestServer(user1Id, callId, "1.1.1.1", "ccapi");
    assert.equal( response.statusCode, 503);
  })

  it("Should get 1 CCAPI and 1 webrtc server calls", async () =>
  {
    const user1Id = "CCAPIWebRTCRequestTestUser1";
    const user2Id = "CCAPIWebRTCRequestTestUser2";
    const user3Id = "CCAPIWebRTCRequestTestUser3";
    const user4Id = "CCAPIWebRTCRequestTestUser4";

    await initUser(user1Id);
    await initUser(user2Id);
    await initUser(user3Id);
    await initUser(user4Id);
    const callId = await CallService.initialize(user1Id, user2Id)
    const callId2 = await CallService.initialize(user3Id, user4Id)

    await CaptureMethodDBModel.upsert({"method": "webrtc","capacity": 2});
    await CaptureMethodDBModel.upsert({"method": "ccapi","capacity": 1});

    const gameServer = await GameServerDBModel.create({"id": "89798", "status": dbStatus.ACTIVE, "zone": "zone", "externalIp": "1.1.1.1"})

    const response = await CallService.requestServer(user1Id, callId, "1.1.1.1", "ccapi");
    assert.equal( response.statusCode, 200);
    const ccapiResponse2 = await CallService.requestServer(user2Id, callId, "1.1.1.1", "webrtc");
    assert.equal( ccapiResponse2.statusCode, 200);

    // we already have 2 instances allocated to this game server, so we expect a 503
    const ccapiResponse3 = await CallService.requestServer(user3Id, callId2, "1.1.1.1", "webrtc");
    assert.equal( ccapiResponse3.statusCode, 503);
    await gameServer.update({"status": dbStatus.DISABLE}) // clean up
  })

  it("Should get 2 webrtc server calls", async () =>
  {
    const user1Id = "webrtcRequestTestUser1";
    const user2Id = "webrtcequestTestUser2";
    await initUser(user1Id);
    await initUser(user2Id);
    const callId = await CallService.initialize(user1Id, user2Id)

    await CaptureMethodDBModel.upsert({"method": "webrtc","capacity": 2});
    await CaptureMethodDBModel.upsert({"method": "ccapi","capacity": 1});

    const gameServer = await GameServerDBModel.create({"id": "3", "status": dbStatus.ACTIVE, "zone": "zone", "externalIp": "1.1.1.1"})

    const response = await CallService.requestServer(user1Id, callId, "1.1.1.1", "webrtc");
    assert.equal( response.statusCode, 200);
    const ccapiResponse2 = await CallService.requestServer(user2Id, callId, "1.1.1.1", "webrtc");
    assert.equal( ccapiResponse2.statusCode, 200);
    await gameServer.update({"status": dbStatus.DISABLE}) // clean up
  })

})
