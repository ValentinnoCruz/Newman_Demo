const assert = require("assert");
const testUtils = require("../test_utils")

const dbInstance = testUtils.initializeEnvironment(true);

const fs = require("fs");
const { ConfigDBModel, getValue, getNumValue, getBoolValue } = require('../../src/models/configDBModel')

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

before("Populate db", async () => {
    await dbInstance.authenticate()
    await dbInstance.sync();
    await ConfigDBModel.create({"key": "testStringKey", "value": "testStringValue"})
    await ConfigDBModel.create({"key": "testValidNumberKeyInt", "value": "1234"})
    await ConfigDBModel.create({"key": "testValidNumberKeyFloat", "value": "1234.1234"})
    await ConfigDBModel.create({"key": "testMalformattedNumberKey", "value": "hello world"})
    await ConfigDBModel.create({"key": "testValidBoolKeyTrueUppercase", "value": "TRUE"})
    await ConfigDBModel.create({"key": "testValidBoolKeyTrueLowercase", "value": "true"})
    await ConfigDBModel.create({"key": "testValidBoolKeyTrueMixedcase", "value": "TrUe"})
    await ConfigDBModel.create({"key": "testValidBoolKeyFalseUppercase", "value": "FALSE"})
    await ConfigDBModel.create({"key": "testValidBoolKeyFalseLowercase", "value": "false"})
    await ConfigDBModel.create({"key": "testValidBoolKeyFalseMixedcase", "value": "FaLsE"})
    await ConfigDBModel.create({"key": "testMalformattedBoolKey", "value": "hello world"})
    await sleep(1500); // wait until the config cache is refreshed

})

after(async () => {
    dbInstance.close();
    if(fs.existsSync(dbInstance.options.host)) {
        fs.unlinkSync(dbInstance.options.host);
    }
})

describe("Config db test",  () => {
    describe("String tests",  () =>
    {
        it("Test Valid string key", async () =>
        {
            let val = await getValue("testStringKey")
            assert.strictEqual(val, "testStringValue")
        })
        it("Test get default string key no args", async () =>
        {
            let val = await getValue("testInvalidStringKey")
            assert.strictEqual(val, null)
        })
        it("Test get default string key", async () =>
        {
            let val = await getValue("testInvalidStringKey", "def")
            assert.strictEqual(val, "def")
        })
    })
    describe("Number tests",  () =>
    {
        it("Test Valid Number key int", async () =>
        {
            let val = await getNumValue("testValidNumberKeyInt")
            assert.strictEqual(val, 1234)
        })
        it("Test Valid Number key float", async () =>
        {
            let val = await getNumValue("testValidNumberKeyFloat")
            assert.strictEqual(val, 1234.1234)
        })
        it("Test invalid Number key", async () =>
        {
            let val = await getNumValue("testInvalidValidNumberKeyFloat")
            assert.strictEqual(val, null)
        })
        it("Test invalid Number key default", async () =>
        {
            let val = await getNumValue("testInvalidValidNumberKeyFloat", 123.4)
            assert.strictEqual(val, 123.4)
        })
        it("Test Malformatted Number key", async () =>
        {
            let errorThrown = false;
            try
            {
                let val = await getNumValue("testMalformattedNumberKey")
            } catch (e)
            {
                errorThrown = true
            }
            assert(errorThrown)
        })
    })

        describe("Boolean tests",  () =>
        {
            it("Test Valid bool key True Uppercase", async () =>
            {
                let val = await getBoolValue("testValidBoolKeyTrueUppercase", false)
                assert.strictEqual(val, true)
            })
            it("Test Valid bool key True Lowercase", async () =>
            {
                let val = await getBoolValue("testValidBoolKeyTrueLowercase", false)
                assert.strictEqual(val, true)
            })
            it("Test Valid bool key True Mixed Case", async () =>
            {
                let val = await getBoolValue("testValidBoolKeyTrueMixedcase", false)
                assert.strictEqual(val, true)
            })
            it("Test Valid bool key False Uppercase", async () =>
            {
                let val = await getBoolValue("testValidBoolKeyFalseUppercase", true)
                assert.strictEqual(val, false)
            })
            it("Test Valid bool key False Lowercase", async () =>
            {
                let val = await getBoolValue("testValidBoolKeyFalseLowercase", true)
                assert.strictEqual(val, false)
            })
            it("Test Valid bool key False Mixed Case", async () =>
            {
                let val = await getBoolValue("testValidBoolKeyFalseMixedcase", true)
                assert.strictEqual(val, false)
            })

            it("Test Malformatted boolean key", async () =>
            {
                let errorThrown = false;
                try
                {
                    let val = await getNumValue("testMalformattedBoolKey")
                } catch (e)
                {
                    errorThrown = true
                }
                assert(errorThrown)
            })


        })
})
