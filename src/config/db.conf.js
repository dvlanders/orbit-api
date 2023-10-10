const { Sequelize } = require("sequelize");
const path = require("path");
const Umzug = require("umzug");
const config = require("../config/config.json");

let database = config.development.database;
let username = config.development.username;
let password = config.development.password;
let host = config.development.host;
let dialect = config.development.dialect;

const sequelizeInstance = new Sequelize({
  database,
  username,
  password,
  host,
  port: 5432,
  dialect,
  pool: {
    max: 10,
    min: 0,
    acquire: 20000,
    idle: 5000,
  },
  dialectOptions: {
    ssl: {
      require: true, // This will help you. But you will see nwe error
      rejectUnauthorized: false, // This line will fix new error
    },
  },
});

const migrate = new Umzug({
  migrations: {
    // indicates the folder containing the migration .js files
    path: path.join(__dirname, "../migrations"),
    pattern: /\.js$/,
    // inject sequelize's QueryInterface in the migrations
    params: [sequelizeInstance.getQueryInterface(), Sequelize],
  },
  // indicates that the migration data should be store in the database
  // itself through sequelize. The default configuration creates a table
  // named `SequelizeMeta`.
  storage: "sequelize",
  storageOptions: {
    sequelize: sequelizeInstance,
  },
});

const psqlDbConnect = async function () {
  try {
    await sequelizeInstance.authenticate();
    console.log("Connection has been established successfully (PSQL)");

    // Check if migrations have already been applied
    // const executedMigrations = await migrate.executed();
    // if (executedMigrations.length === 0) {
    //   // No migrations have been applied, so run them
    await migrate.up();
    //   console.log("All migrations performed successfully (PSQL)");
    // } else {
    //   console.log("Migrations have already been applied (PSQL)");
    // }
  } catch (err) {
    console.error("Error in db connection", err);
  }
};

module.exports = { psqlDbConnect, sequelizeInstance };
