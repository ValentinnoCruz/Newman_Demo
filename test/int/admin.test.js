const axios = require("axios");
const intTestUtil = require("./int_test_util.js");
const assert = require("assert");

describe("Admin Init api test", () => {
  it("collectmetrics should return 200", async () => {
    const response = await axios.get(
      `${intTestUtil.api_base_url}api/v1/admin/jobs/collectmetrics`,
      {
        headers: {
          "X-Appengine-Cron": "true",
        },
      }
    );
    assert.equal(response.status, 200);
  });

  it("collectmetrics should return 401", async () => {
    try {
      const response = await axios.get(
        `${intTestUtil.api_base_url}api/v1/admin/jobs/collectmetrics`
      );
      assert.equal(response.status, 401); // Will never reach here
    } catch (error) {
      if (error.response) {
        assert.equal(error.response.status, 401);
      } else {
        assert.fail("Unexpected error");
      }
    }
  });
});
