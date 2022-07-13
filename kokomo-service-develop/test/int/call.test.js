const axios = require('axios');
const intTestUtil = require('./int_test_util.js')
const assert = require("assert");
const testUtils = require("../test_utils");
const dbUtils = require("../../src/utils/dbUtils");
const {Op} = require("sequelize");
const { CallSessionDBModel } = require('../../src/models/callSessionDBModel')

describe("Call Init api test",  () => {
    it("should return 200 and call should be initialized in db", async () => {
        let user1 = await intTestUtil.initializeRandomUser();
        let user2 = await intTestUtil.initializeRandomUser();

        const response = await axios.post(`${intTestUtil.api_base_url}api/v1/call/initialize`,{
            "user_id": user1.userId,
            "calling_player_id": user2.userId
        }, {headers: {
            "authorization": user1.accessToken
            }})

        assert.equal(response.status, 200);
        assert(response.data.call_id);
        let createdCalls = await CallSessionDBModel.findAll({where: {"id": response.data.call_id}}).catch(e => console.error(e.message));
        assert.strictEqual(createdCalls.length, 2);
        assert([user1.userId, user2.userId].includes(createdCalls[0].getDataValue("userId")))
        assert([user1.userId, user2.userId].includes(createdCalls[1].getDataValue("userId")))
        assert.notStrictEqual(createdCalls[0].getDataValue("userId"), createdCalls[1].getDataValue("userId"))
        assert.strictEqual(createdCalls[0].getDataValue("status"), dbUtils.dbStatus.INITIALIZING)
        assert.strictEqual(createdCalls[1].getDataValue("status"), dbUtils.dbStatus.INITIALIZING)
    })

    it("should force end old calls", async () => {
        let user1 = await intTestUtil.initializeRandomUser();
        let user2 = await intTestUtil.initializeRandomUser();

        const firstResponse = await axios.post(`${intTestUtil.api_base_url}api/v1/call/initialize`,{
            "user_id": user1.userId,
            "calling_player_id": user2.userId
        }, {headers: {
                "authorization": user1.accessToken
            }})
        assert.equal(firstResponse.status, 200);

        const response = await axios.post(`${intTestUtil.api_base_url}api/v1/call/initialize`,{
            "user_id": user1.userId,
            "calling_player_id": user2.userId
        }, {headers: {
                "authorization": user1.accessToken
            }})

        assert.equal(response.status, 200);
        assert(response.data.call_id);

        let createdCalls = await CallSessionDBModel.findAll({where: {[Op.or]: [
                        {"userId": user1.userId},
                        {"userId": user2.userId}
                    ]}});
        assert.strictEqual(createdCalls.length, 4);

        let endedCallCount = 0;
        let initializedCallCount = 0;
        for(let call of createdCalls) {
            if(call.getDataValue("status") === dbUtils.dbStatus.INITIALIZING)
            {
                initializedCallCount += 1;
            }
            else if(call.getDataValue("status") === dbUtils.dbStatus.ENDED)
            {
                endedCallCount += 1;
            }
        }
        assert.strictEqual(endedCallCount, 2);
        assert.strictEqual(initializedCallCount, 2);
    })

})
