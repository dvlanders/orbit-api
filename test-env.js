const { spawn } = require("child_process");

// Get the argument passed to the script
const arg = process.argv[2];
const test = process.argv[3];
const argLen = process.argv.length;

// Check if no argument is provided
if (!arg) {
  console.error(
    `Error: No environment argument provided. Please specify 'prod' or 'sandbox'. eg. "npm test -- prod/user/ping" for production or "npm test -- sandbox/user/ping" for sandbox`
  );
  return; // Exit early
}

// Determine the value of NODE_ENV based on the argument
const nodeEnv = arg === "prod" ? "production" : "development";

// Construct the test command with the appropriate NODE_ENV
let command = `cross-env DOTENV_CONFIG_PATH=./.env.local NODE_ENV=${nodeEnv} NODE_TEST=True jest --forceExit -- `;

if (argLen == 3) {
  if (arg === "prod") {
    command += "prod/user/ prod/account/ prod/transfer/";
  } else if (arg === "sandbox") {
    command += "sandbox/";
  }
} else if (argLen == 4 && test) {
  if (arg === "prod") {
    command += "prod/" + test;
  } else if (arg === "sandbox") {
    command += "sandbox/" + test;
  }
}

// Split the command into the command part and the arguments part for spawn
const [cmd, ...args] = command.split(/\s+/);
console.log(cmd);
const child = spawn(cmd, args, { stdio: "inherit", shell: true });

child.on("error", (error) => {
  console.error(`exec error: ${error}`);
});
