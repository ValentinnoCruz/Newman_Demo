const {Sequelize, Model, DataTypes} = require('sequelize');
const {getDBInstance} = require('../utils/dbUtils');
const sequelize = getDBInstance();
const logger = require("../../logger");

class ConfigDBModel extends Model {
}

ConfigDBModel.init({
    key: {
        type: DataTypes.TEXT,
        primaryKey: true,
        autoIncrement: false
    },
    value: {
        type: DataTypes.TEXT,
    },
}, {sequelize, modelName: 'Config', tableName: 'Config', timestamps: false});
const refreshCache = async () =>
{
    let ret = {}
    try {
        let conf = await ConfigDBModel.findAll()
        for (const kv in conf)
        {
            ret[conf[kv].key] = conf[kv].value
        }
    } catch (e) {
        logger.error(e.message);
    }
    return ret
}

let cache = refreshCache()

let refresh_rate_seconds = Number(process.env.CONFIG_CACHE_TIME_SECONDS)
if (isNaN(refresh_rate_seconds))
{
    refresh_rate_seconds = 180
}


setInterval(() =>
{
    cache = refreshCache()
}, refresh_rate_seconds*1000);

const getValue = async (key, defaultValue = null) =>
{
    let conf = await cache
    if (key in conf)
    {
        return conf[key]
    } else
    {
        return defaultValue
    }
}

const getNumValue = async (key, defaultValue = null) =>
{
    let conf = await cache
    if (key in conf)
    {
        let val = conf[key]
        let ret = Number(val);
        if (isNaN(ret))
        {
            throw new Error(`number value "${val}" cannot be parsed, must be a numeric value`)
        }
        return ret;
    } else
    {
        return defaultValue
    }
}
const getBoolValue = async (key, defaultValue) =>
{
    let conf = await cache
    if (key in conf)
    {
        let val = conf[key]
        if (String(val).trim().toLowerCase() === "true")
        {
            return true;
        } else if (String(val).trim().toLowerCase() === "false")
        {
            return false
        } else {
            throw new Error(`boolean value "${val}" cannot be parsed, must be "true" or "false" (case insensitive)`)
        }
    } else
    {
        return defaultValue
    }
}

module.exports = {
    ConfigDBModel,
    getValue,
    getNumValue,
    getBoolValue
}
