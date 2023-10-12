const AWS = require("aws-sdk");
let t = new AWS.EventBridge();
const client = new EventBridgeClient({
  credentials: {
    accessKeyId: "AKIAWTCFUVBIEYZJDCWM",
    secretAccessKey: "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",
  },
  region: "us-east-1",
});

// const createEventBus = async (eventBusName) => {
//     const client = new EventBridge({ region: "us-west-1" });  // Change region accordingly
//     try {
//         const response = await client.createEventBus({
//             Name: eventBusName
//         });
//         console.log("Event Bus Created:", response);
//     } catch (error) {
//         console.error("Error Creating Event Bus:", error);
//     }
// }
// createEventBus("HifiBridgeEventBus");

// const eventBridge = new EventBridge({ region: "us-west-1" });

// exports.putEvent = async function (eventType, detail) {
//   try {
//     let see = await eventBridge.putEvents({
//       Entries: [
//         {
//           EventBusName: "HifiBridgeEventBus", // Replace with your event bus name
//           Source: "app",
//           DetailType: eventType,
//           Detail: JSON.stringify(detail),
//         },
//       ],
//     });
//   } catch (error) {
//     console.error(`Error sending ${eventType} event:`, error);
//   }
// };
