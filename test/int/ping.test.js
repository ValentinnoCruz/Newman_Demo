const axios = require('axios');
const intTestUtil = require('./int_test_util.js')
const assert = require("assert");

describe("Ping API test",  () => {
    it("should return 200", async () => {
        const response = await axios.get(`${intTestUtil.api_base_url}api/v1/ping`)
        assert.equal(response.status, 200);
    })
})
