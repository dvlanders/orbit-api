const { Sequelize, DataTypes } = require('sequelize');
const user = require('./user');

const sequelize = new Sequelize( "bfmgyxwixcsjs1k8gdhy", "uqykk7jgjdlyupsi", "7Q4nuc8dMOhdwPrMCUGL", {
    host: "bfmgyxwixcsjs1k8gdhy-mysql.services.clever-cloud.com",
    port: 3306,
    logging: console.log,
    maxConcurrentQueries: 100,
    dialect: 'mysql',
    pool: { maxConnections: 5, maxIdleTime: 30 },
    language: 'en',
  });

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = require("./user")(sequelize, DataTypes);

module.exports = { db };