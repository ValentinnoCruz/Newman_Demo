'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Config','Config_pkey');
    await queryInterface.addConstraint('Config', {
      fields: ['key'],
      type: 'primary key',
      name: 'Config_pkey'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Config','Config_pkey');
    await queryInterface.addConstraint('Config', {
      fields: ['key', 'value'],
      type: 'primary key',
      name: 'Config_pkey'
    });
  }
};
