const accessKeyId = "AKIAWTCFUVBIAGUM6VMA";
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
