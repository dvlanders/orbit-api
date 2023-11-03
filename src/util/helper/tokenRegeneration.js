const cron = require("cron");
const User = require("../../models/userAuth");
const axios = require("axios");
let time = new Date();
const dynamoose = require("dynamoose");

async function regeneration() {
  const userDetails = await User.scan()
    .where("isVerified")
    .eq(true)
    .where("sfox_id")
    .not()
    .eq("")
    .attributes(["sfox_id"])
    .exec();

  User.batchPut();

  let sfoxIds = [];
  for (const user of userDetails) {
    if (user.sfox_id !== undefined) {
      sfoxIds.push(user.sfox_id);
    }
  }

  console.log(sfoxIds);

  if (sfoxIds.length > 0) {
    let apiPath = `${process.env.SFOX_BASE_URL}/v1/enterprise/user-tokens`;

    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: `Bearer ${process.env.SFOX_ENTERPRISE_API_KEY}`,
      },
      data: {
        data: sfoxIds,
      },
    });

    console.log(response?.data?.data);

    // if (response?.data?.data?.length > 0) {
    //   const transactionOperations = response?.data?.data.map((user) => {
    //     return User.transaction.update(
    //       { user_id: user.id },
    //       { userToken: "token" }
    //     );
    //   });

    //   await dynamoose.transaction(transactionOperations);
    // }
  }
}
// const job = new cron.CronJob('48 18 * * *', () => {
// regeneration();

// })

// job.start();

/**
 * https://api.sfox.com/v1/currency
 */
