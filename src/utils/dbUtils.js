const { Sequelize } = require('sequelize');
const pg = require('pg');
const logger = require("../../logger");

class DBUtils extends Sequelize {
  static instance = null;
}

const dbStatus = {
  INITIALIZING : 'INITIALIZING',
  ACTIVE: 'ACTIVE',
  ERROR: 'ERROR',
  ENDED: 'ENDED',
  DELETING: 'DELETING',
  DISABLE: 'DISABLE',
}

const getDBInstance = () => {
  if(logger.ns)
  {
    try {
      Sequelize.useCLS(logger.ns);
    } catch (e) {
      logger.warn('Failed to make Sequelize use CLS, SQL logs will not be tied to a transaction',e)
    }
  }
  if(DBUtils.instance === null) {
      if(process.env.DB_TYPE === 'sqlite')
      {
          const dbFilename = process.env.SQLITE_DB_FILENAME || 'kokomo.sqlite'
          DBUtils.instance = new Sequelize(`sqlite:${dbFilename}`, {logging: (msg) => logger.info(msg)});
      }
      else
      {
          const connectionStr = 'postgres'
              + '://' + process.env.CLOUD_SQL_USERNAME
              + ':' + process.env.CLOUD_SQL_PASSWORD
              + '@' + process.env.CLOUD_SQL_CONNECTION_STRING
              + '/' + process.env.CLOUD_SQL_DATABASE;
          try
          {
              if((String(process.env.IN_GCP).toLowerCase() === "true"))
              {
                  DBUtils.instance = new Sequelize(
                      process.env.CLOUD_SQL_DATABASE,
                      process.env.CLOUD_SQL_USERNAME,
                      process.env.CLOUD_SQL_PASSWORD,
                      {
                          dialect: 'postgres',
                          host: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_STRING}`,
                          dialectModule: pg,
                          logging: (msg) => logger.info(msg),
                      }
                  );
              }
              else
              {
                  DBUtils.instance = new Sequelize(connectionStr, {dialect: 'postgres', dialectModule: pg,logging: (msg) => logger.info(msg)});
              }
          } catch (error)
          {
              logger.error(error.message);
              process.exit(1);
          }
      }
  }

  return DBUtils.instance;
}
module.exports = {
  getDBInstance,
  dbStatus,
}
