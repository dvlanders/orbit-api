const { App } = require("@slack/bolt");
const createLog = require("./supabaseLogger");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const blockBuilder = (caller, request, response) => {
  const statusEmoji =
    response.statusCode >= 200 && response.statusCode < 300 ? "✅" : "❌";
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
          text: caller.profileEmail,
        },
        {
          type: "mrkdwn",
          text: caller.profileId,
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
        text: `\`\`\`${JSON.stringify(request.body, null, 2)}\`\`\``,
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
        text: `\`\`\`${JSON.stringify(
          JSON.parse(response.body),
          null,
          2
        )}\`\`\``,
      },
    },
  ];
};

const sendSlackMessage = async (request, response) => {
  const caller = {
    profileEmail: request.query.profileEmail,
    profileId: request.query.profileId,
  };

  delete request.query.profileEmail;
  delete request.query.profileId;

  try {
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: process.env.SLACK_CHANNEL,
      text: "API Request and Response",
      blocks: blockBuilder(caller, request, response),
    });
  } catch (error) {
    await createLog("slackLogger", null, "Failed to send slack message", error);
  }
};

module.exports = {
  sendSlackMessage,
};
