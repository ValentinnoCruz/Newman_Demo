const axios = require('axios');
const intTestUtil = require('./int_test_util.js')
const assert = require("assert");
const testUtils = require("../test_utils");

const { UserDBModel} = require('../../src/models/userDBModel')

describe("User Init api test",  () => {
    it("should return 200 and find user in db", async () => {
        const userId = testUtils.getRandomId(20);
        let userThatShouldntExist = await UserDBModel.findOne({where: {"id": userId}});
        assert(!userThatShouldntExist);

        const response = await axios.post(`${intTestUtil.api_base_url}api/v1/user/init`,null, {headers: {
            'x-playfab-auth-token': userId
            }})

        assert.equal(response.status, 200);
        let addedUser = await UserDBModel.findOne({where: {"id": userId}});
        assert(addedUser);
        assert.strictEqual(addedUser.getDataValue("id"), userId);
    })

    it("should return 200 after multiple initializations and find user in db", async () => {
        const userId = testUtils.getRandomId(20);
        let userThatShouldntExist = await UserDBModel.findOne({where: {"id": userId}});
        assert(!userThatShouldntExist);

        const firstResponse = await axios.post(`${intTestUtil.api_base_url}api/v1/user/init`,null, {headers: {
                'x-playfab-auth-token': userId
            }})

        assert.equal(firstResponse.status, 200);

        const secondResponse = await axios.post(`${intTestUtil.api_base_url}api/v1/user/init`,null, {headers: {
                'x-playfab-auth-token': userId
            }})

        assert.equal(secondResponse.status, 200);
        let addedUser = await UserDBModel.findOne({where: {"id": userId}});
        assert(addedUser);
        assert.strictEqual(addedUser.getDataValue("id"), userId);
    })
})
