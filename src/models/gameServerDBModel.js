const { Sequelize, Model, DataTypes } = require('sequelize');
const { getDBInstance } = require('../utils/dbUtils');
const sequelize = getDBInstance();

class GameServerDBModel extends Model {}
GameServerDBModel.init({
  id: {
    type: DataTypes.TEXT,
    primaryKey: true,
    autoIncrement: false
  },
  zone: {
    type: DataTypes.TEXT,
  },
  status: {
    type: DataTypes.TEXT,
  },
  externalIp: {
    type: DataTypes.TEXT,
    field: 'external_ip'
  }
}, { sequelize, modelName: 'GameServer', tableName: 'GameServer', createdAt: 'created', updatedAt: false });

module.exports = {
  GameServerDBModel
}
