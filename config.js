const fs = require('fs');
require("dotenv").config();
const pg = require('pg');
const {decryptSecrets} = require('./src/utils/utils');
const logger = require('./logger');

const getSecrets = async () => {
  try {
    const inGcp = String(process.env.IN_GCP).toLowerCase() === "true";
    if (inGcp) {
      await decryptSecrets();
    }
  } catch (error) {
    console.error('Unable to connect to the database', error);
    logger.error('Unable to connect to the database:', error);
  }
};

const getEnvAsync = async(key) => {
  await getSecrets();
  console.info(`got env key ${key}, val ${process.env[key]}`);
  return process.env[key]
}

module.exports = async () => ({
  sqlite: {
    dialect: 'sqlite',
    storage: "kokomo.sqlite"
  },
  postgres_local: {
    username: await getEnvAsync('CLOUD_SQL_USERNAME'),
    password: await getEnvAsync('CLOUD_SQL_PASSWORD'),
    database: await getEnvAsync('CLOUD_SQL_DATABASE'),
    host: '127.0.0.1',
    port: 3029,
    dialect: 'postgres',
    dialectOptions: {
      bigNumberStrings: true
    }
  },
  postgres_gcloud: {
    username: await getEnvAsync('CLOUD_SQL_USERNAME'),
    password: await getEnvAsync('CLOUD_SQL_PASSWORD'),
    database: await getEnvAsync('CLOUD_SQL_DATABASE'),
    host: `/cloudsql/${await getEnvAsync('CLOUD_SQL_CONNECTION_STRING')}`,
    port: 5432,
    dialect: 'postgres',
    dialectModule: pg,
    dialectOptions: {
      bigNumberStrings: true
    }
  },
  postgres_appengine: {
    username: 'admin',
    password: await getEnvAsync('CLOUD_SQL_PASSWORD'),
    database: 'kokomo',
    host: '127.0.0.1',
    port: 5432,
    dialect: 'postgres',
    dialectModule: pg,
    dialectOptions: {
      bigNumberStrings: true
    }
  }
});
