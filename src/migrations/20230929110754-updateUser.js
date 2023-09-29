"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "users",
      'secretKey',
      {
          type: Sequelize.STRING,
          allowNull: true,
      },
    )
  },
  async down(queryInterface, Sequelize) {},
};

