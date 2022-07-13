'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn('Auth', 'accessToken', 'access_token');
    await queryInterface.renameColumn('Auth', 'refreshToken', 'refresh_token');
  },
  async down(queryInterface, Sequelize) {
    // await queryInterface.renameColumn('Auth', 'access_token', 'accessToken');
    await queryInterface.renameColumn('Auth', 'refresh_token', 'refreshToken');
  }
};
