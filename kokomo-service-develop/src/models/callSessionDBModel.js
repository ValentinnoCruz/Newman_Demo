const { Model, DataTypes } = require('sequelize');
const { getDBInstance } = require('../utils/dbUtils');
const sequelize = getDBInstance();

class CallSessionDBModel extends Model {
}
CallSessionDBModel.init({
  id: {
    type: DataTypes.TEXT,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  gameServerId: {
    type: DataTypes.TEXT,
    field: 'game_server_id',
  },
  userId: {
    type: DataTypes.TEXT,
    primaryKey: true,
    field: 'user_id',
  },
  captureMethod: {
    type: DataTypes.TEXT,
    field: 'capture_method',
  },
  status: {
    type: DataTypes.TEXT,
    field: 'status',
  },
  userIp: {
    type: DataTypes.TEXT,
    field: 'user_ip',
  },
}, { sequelize, modelName: 'CallSession', tableName: 'CallSession' });

module.exports = {
  CallSessionDBModel
}
