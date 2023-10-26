const cron = require("cron");
const User = require("../../models/userAuth");
const axios = require("axios");
let time = new Date();

async function regeneration() {
  const userDetails = await User.scan().where("isVerified").eq(true).exec();

  const sfoxIds = userDetails
    .map((obj) => {
      if (obj.sfox_id && obj.sfox_id.length > 2) {
        return obj.sfox_id;
      } else {
        return null;
      }
    })
    .filter((value) => value !== null); // Filter out null values if needed

  // console.log(sfoxIds);

  // console.log(process.env.SFOX_BASE_URL);

  if (sfoxIds.length > 0) {
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/user-tokens`;

    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: `Bearer ${process.env.SFOX_ENTERPRISE_API_KEY}`,
      },
      data: {
        partnerUserIDs: [
          "5333e320-1a87-4528-81a5-0b8e00d3c047",
          "319f6ff6-17f1-495b-b484-67d0bbcd8145",
        ],
      },
    });

    // console.log(response?.data);
    // let update_user_authtoken = User.update(
    //   { user_id: data.user_id },
    //   { userToken: response?.data?.data?.token }
    // );

    // if(update_user_authtoken) console.log("Token updated successfully")
  }
}
// const job = new cron.CronJob('48 18 * * *', () => {
regeneration();

// })

// job.start();
