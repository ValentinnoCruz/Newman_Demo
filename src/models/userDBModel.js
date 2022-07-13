const { Sequelize, Model, DataTypes } = require('sequelize');
const { getDBInstance } = require('../utils/dbUtils');
const sequelize = getDBInstance();
const logger = require("../../logger");

class UserDBModel extends Model {}
UserDBModel.init({
  id: {
    type: DataTypes.TEXT,
    primaryKey: true,
    autoIncrement: false,
  },
}, { sequelize, modelName: 'User', tableName: 'User', timestamps: false });

const findAll = async () => {
  return await UserDBModel.findAll();
}
const initUser = async (id) => {
  return UserDBModel.findOrCreate({where: {id: id}})
}

(async () => {
  try {
    await sequelize.authenticate();
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
  }
})();

module.exports = {
  UserDBModel,
  findAll,
  initUser
}
