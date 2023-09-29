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
      await queryInterface.addColumn(
      "users",
      "isVerified",
      {
        type: Sequelize.BOOLEAN,
          allowNull: true,
      }
    )

  },
  async down(queryInterface, Sequelize) {},
};

