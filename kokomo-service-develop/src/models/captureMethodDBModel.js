const { Model, DataTypes } = require('sequelize');
const { getDBInstance } = require('../utils/dbUtils');
const sequelize = getDBInstance();

class CaptureMethodDBModel extends Model {
}
CaptureMethodDBModel.init({
  method: {
    type: DataTypes.TEXT,
    primaryKey: true,
  },
  capacity: {
    type: DataTypes.INTEGER,
    field: 'capacity',
  },
}, { sequelize, modelName: 'CaptureMethod', tableName: 'CaptureMethod', timestamps: false });

module.exports = {
  CaptureMethodDBModel
}
