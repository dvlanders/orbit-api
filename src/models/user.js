const { Sequelize, DataTypes } = require('sequelize');
const sequelizeInstance = require('../config/db.conf').sequelizeInstance;

const User = sequelizeInstance.define('users', {
  // Model attributes are defined here
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },

  password : {
    type: DataTypes.STRING,
    allowNull: true
  },

  businessName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  secretKey : {
    type: DataTypes.STRING,
    allowNull: true
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  }
  



}, {
    freezeTableName: true,
});

module.exports = User;
