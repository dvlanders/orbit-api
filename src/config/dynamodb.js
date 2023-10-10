// const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
// const {
//   DynamoDBDocumentClient,
//   QueryCommand,
// } = require("@aws-sdk/lib-dynamodb");

// async function test() {
//   const dynamoDBClient = new DynamoDBClient({
//     region: "us-east-1",
//     credentials: {
//       accessKeyId: accessKeyId,
//       secretAccessKey: secretAccessKey,
//     },
//   });
//   const ddbDocClient = DynamoDBDocumentClient.from(dynamoDBClient);

//   const params = {
//     TableName: "auth_user",
//     KeyConditionExpression: "#user_id = :value",
//     ExpressionAttributeNames: {
//       "#user_id": "user_id",
//     },
//     ExpressionAttributeValues: {
//       ":value": "1",
//     },
//   };
//   const data = await ddbDocClient.send(new QueryCommand(params));

//   console.log(data?.Items);
// }

// test();
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

// Set DynamoDB instance to the Dynamoose DDB instance
dynamoose.aws.ddb.set(ddb);
