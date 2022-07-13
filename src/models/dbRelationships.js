const {GameServerDBModel} = require('./gameServerDBModel')
const {CallSessionDBModel} = require('./callSessionDBModel')
const {UserDBModel} = require('./userDBModel');
const {CaptureMethodDBModel} = require('./captureMethodDBModel');

const init = async () =>
{
    GameServerDBModel.hasMany(CallSessionDBModel, {foreignKey: 'gameServerId'});
    CallSessionDBModel.belongsTo(GameServerDBModel, {foreignKey: {name: 'gameServerId', allowNull: true}})
    UserDBModel.hasMany(CallSessionDBModel, {foreignKey: 'userId'})
    CallSessionDBModel.belongsTo(UserDBModel, {foreignKey: 'userId'})
    CaptureMethodDBModel.hasMany(CallSessionDBModel, {foreignKey: 'captureMethod'})
    CallSessionDBModel.belongsTo(CaptureMethodDBModel,{foreignKey: {name: 'captureMethod', allowNull: true}})
}
module.exports = {
    init: init
}
