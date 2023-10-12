const accessKeyId = "AKIAWTCFUVBIEYZJDCWM";
const secretAccessKey = "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";
const region = "us-east-1";

const dynamoose = require("dynamoose");
const ddb = new dynamoose.aws.ddb.DynamoDB({
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
  region: region,
});

exports.dbInstance = dynamoose.aws.ddb.set(ddb);
