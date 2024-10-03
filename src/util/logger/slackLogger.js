const { App } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});
const web = new WebClient(process.env.SLACK_BOT_TOKEN, { rejectRateLimitedCalls: true });

const safeJsonStringify = (content) => {
  let requestBodyJson;
  try {
    requestBodyJson = JSON.stringify(content, null, 2);
  } catch (error) {
    requestBodyJson = JSON.stringify({ data: content }, null, 2);
  }
  return requestBodyJson;
}

// upload jsonContent to Slack channel
const uploadJSON = async (jsonContent, filename, title, channelId) => {
  const result = await web.filesUploadV2({
    channel_id: channelId,
    initial_comment: title,
    content: jsonContent,
    filename: filename,
    title: title,
  });
  return result;
};

// get jsonBodyText
const getJsonBodyText = async (jsonObject, filename, title, channelId) => {
    const jsonContent = safeJsonStringify(jsonObject);
    let jsonBodyText = `\`\`\`${jsonContent}\`\`\``;
    if (jsonBodyText.length > 3000) {
        const result = await web.filesUploadV2({
            channel_id: channelId,
            initial_comment: title,
            content: jsonContent,
            filename: filename,
            title: title,
        });
        jsonBodyText = `${title} is too large to display. <${result.files[0].files[0].permalink}|${title} Body File>`
    }
    return jsonBodyText;
}

// Build the Slack blocks for the request and response message
const reqResBlockBuilder = async (caller, request, response) => {
  const channelId = process.env.SLACK_CHANNEL_API;
  const statusEmoji =
    response.statusCode >= 200 && response.statusCode < 300 ? "✅" : "❌";

  const requestBodyText = await getJsonBodyText(request.body, "request_body.json", "Request Body", channelId);

  const responseBodyText = await getJsonBodyText(response.body, "response_body.json", "Response Body", channelId);

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚨 API Request: ${request.method} ${request.route}`,
        emoji: true,
      },
    },
    {
      type: "divider",
    },
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Caller",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: "✉️ *Profile Email*",
        },
        {
          type: "mrkdwn",
          text: "🪪 *Profile ID*",
        },
        {
          type: "mrkdwn",
          text: caller.profileEmail || "N/A",
        },
        {
          type: "mrkdwn",
          text: caller.profileId || "N/A",
        },
      ],
    },
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Query Parameters",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`${JSON.stringify(request.query, null, 2)}\`\`\``,
      },
    },
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Body",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: requestBodyText,
      },
    },
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Response (${statusEmoji} ${response.statusCode})`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: responseBodyText,
      },
    },
  ];
};

// Build the Slack blocks for the Transaction message
const transactionBlockBuilder = async (profileEmail, profileId, userId, rampType, transactionRecord, message) => {
    const channelId = process.env.SLACK_CHANNEL_TRANSACTION;

    // const messageBodyText = await getJsonBodyText(messageJson, "message_body.json", "Message Body", channelId);

    const transactionRecordBodyText = await getJsonBodyText(transactionRecord, "transaction_body.json", "Transaction Body", channelId);

    return [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: `🚨 ${rampType} Transaction Notification`
            }
        },
        {
            type: "divider",
        },
        {
            type: "header",
            text: {
                type: "plain_text",
                text: "Caller",
                emoji: true,
                },
        },
        {
            type: "section",
            fields: [
                {
                    type: "mrkdwn",
                    text: "✉️ *Profile Email*",
                },
                {
                    type: "mrkdwn",
                    text: "🪪 *Profile ID*",
                },
                {
                    type: "mrkdwn",
                    text: profileEmail || "N/A",
                },
                {
                    type: "mrkdwn",
                    text: profileId || "N/A",
                },
            ],
        },
        {
            type: "section",
            fields: [
                {
                    type: "mrkdwn",
                    text: "👤 *User ID*",
                },
                {
                    type: "mrkdwn",
                    text: "💸 *TransactionRecord ID*",
                },
                {
                    type: "mrkdwn",
                    text: userId || "N/A"
                },
                {
                    type: "mrkdwn",
                    text: transactionRecord.id || "N/A",
                },
            ]
        },
        {
            type: "header",
            text: {
                type: "plain_text",
                text: "Message",
            },
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: message,
            }
        },
        {
            type: "header",
            text: {
                type: "plain_text",
                text: "Transaction Record",
            },
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: transactionRecordBodyText,
            }
        }
    ];
}

// Build the Slack blocks for the log message
const logBlockBuilder = async (
  profileEmail,
  userEmail,
  source,
  log,
  response
) => {
  const channelId = process.env.SLACK_CHANNEL_LOG;

  const responseText = await getJsonBodyText(response, "response_details.json", "Response Details", channelId);

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚨 New Log`,
        emoji: true,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: "✉️ *Profile Email*",
        },
        {
          type: "mrkdwn",
          text: "✉️ *User Email*",
        },
        {
          type: "mrkdwn",
          text: profileEmail || "N/A",
        },
        {
          type: "mrkdwn",
          text: userEmail || "N/A",
        },
      ],
    },
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Error Source",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "plain_text",
        text: source || "N/A",
        emoji: true,
      },
    },
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Error Log",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "plain_text",
        text: log || "N/A",
        emoji: true,
      },
    },
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Response Details",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: responseText,
      },
    },
  ];
};

const newCustomerAccountBlockBuilder = async (fullName, email) => {

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🎉 New Customer 🎉`,
        emoji: true,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: "👤 *Name*",
        },
        {
          type: "mrkdwn",
          text: "✉️ *Email*",
        },
        {
          type: "mrkdwn",
          text: fullName || "N/A",
        },
        {
          type: "mrkdwn",
          text: email || "N/A",
        },
      ],
    },
  ];
}

const newTransferBalanceAlertBlockBuilder = async (profileId, feeRecordId, balance, inProgressFeeAmount) => {

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚨 Transfer Fee Exceeds (Available Balance - In Progress Fee)`,
        emoji: true,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: "👤 *Profile ID*",
        },
        {
          type: "mrkdwn",
          text: "*Fee Transaction ID*",
        },
        {
          type: "mrkdwn",
          text: profileId || "N/A",
        },
        {
          type: "mrkdwn",
          text: feeRecordId || "N/A",
        },
      ],
    },
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Available Balance",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "plain_text",
        text: `${balance}`,
        emoji: true,
      },
    },
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "In Progress Fee Transactions Total",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "plain_text",
        text: `${inProgressFeeAmount}`,
        emoji: true,
      },
    },
  ];
  
}

const sendSlackReqResMessage = async (request, response) => {
  try {
    if (process.env.NODE_ENV === "development" && !request.query.profileEmail)
        return;

    const caller = {
      profileEmail: request.query.profileEmail,
      profileId: request.query.profileId,
    };
  
    delete request.query.profileEmail;
    delete request.query.profileId;

    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: process.env.SLACK_CHANNEL_API,
      text: "API Request and Response",
      blocks: await reqResBlockBuilder(caller, request, response),
    });
  } catch (error) {
    // console.error(error);
  }
};

const sendSlackTransactionMessage = async (
  profileEmail,
  profileId,
  userId,
  rampType,
  transactionRecord,
  message
) => {
  try {
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: process.env.SLACK_CHANNEL_TRANSACTION,
      text: "Logger",
      blocks: await transactionBlockBuilder(profileEmail, profileId, userId, rampType, transactionRecord, message),
    });
  } catch (error) {
    console.error(error);
  }
}

const sendSlackLogMessage = async (
  profileEmail,
  userEmail,
  source,
  log,
  response
) => {
  try {
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: process.env.SLACK_CHANNEL_LOG,
      text: "Logger",
      blocks: await logBlockBuilder(
        profileEmail,
        userEmail,
        source,
        log,
        response
      ),
    });
  } catch (error) {
    // console.error(error);
  }
};

const sendSlackNewCustomerMessage = async (
  fullName,
  email
) => {
  try {
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: process.env.SLACK_CHANNEL_NEW_CUSTOMER,
      text: "New Customer Account",
      blocks: await newCustomerAccountBlockBuilder(
        fullName, email
      ),
    });
  } catch (error) {
    // console.error(error);
  }
};

const sendSlackTransferBalanceAlert = async (profileId, feeRecordId, balance, inProgressFeeAmount) => {

  try {
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: process.env.SLACK_CHANNEL_TRANSFER_BALANCE_ALERT,
      text: "Transfer Balance Fee Alert",
      blocks: await newTransferBalanceAlertBlockBuilder(
        profileId, feeRecordId, balance, inProgressFeeAmount
      ),
    });
  } catch (error) {
    // console.error(error);
  }

}

module.exports = {
  sendSlackReqResMessage,
  sendSlackLogMessage,
  sendSlackTransactionMessage,
  sendSlackNewCustomerMessage,
  sendSlackTransferBalanceAlert
};
