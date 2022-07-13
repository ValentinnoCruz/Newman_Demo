const testUtils = require("../test_utils");
const axios = require("axios");
const assert = require("assert");

const api_base_url = process.env.KOKOMO_ITEST_BASE_URL || 'http://localhost:3000/';
async function initializeRandomUser()
{
    const userId = testUtils.getRandomId(20);

    const response = await axios.post(`${api_base_url}api/v1/user/init`,null, {headers: {
            'x-playfab-auth-token': userId
        }})
    assert.strictEqual(response.status, 200);
    const {accessToken, refreshToken} = response.data.data;
    return {userId, accessToken, refreshToken};
}
module.exports = {
    api_base_url,
    initializeRandomUser,
}
