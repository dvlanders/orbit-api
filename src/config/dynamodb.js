const accessKeyId = "AKIAWTCFUVBIEYZJDCWM";
const secretAccessKey = "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";

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

async function test() {
  const dynamoDBClient = new DynamoDBClient({
    region: "us-east-1",
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });
  const ddbDocClient = DynamoDBDocumentClient.from(dynamoDBClient);

  const params = {
    TableName: "auth_user",
    KeyConditionExpression: "#user_id = :value",
    ExpressionAttributeNames: {
      "#user_id": "user_id",
    },
    ExpressionAttributeValues: {
      ":value": "1",
    },
  };
  const data = await ddbDocClient.send(new QueryCommand(params));

  console.log(data?.Items);
}

test();
