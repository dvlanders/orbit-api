const User = require("../../models/userAuth");
const axios = require("axios");
const dynamoose = require("dynamoose");
const cron = require("node-cron");
let { logger } = require("../logger/logger");

/**
 * @description -- The function is set to trigger everyday 5 PM UTC
 * Question But from the sfox response we get it as it will expire from 24 hrs from when it is created
 */
async function regeneration() {
	try {
		const userDetails = await User.scan()
			.where("isVerified")
			.eq(true)
			.where("isSfoxVerified")
			.eq(true)
			.where("sfox_id")
			.not()
			.eq("")
			.attributes(["sfox_id", "user_id"])
			.exec();

		console.log(userDetails);

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

			let usertokens = response?.data?.data;

			if (usertokens.length > 0) {
				for (let i = 0; i < usertokens.length; i++) {
					const partnerUserId = usertokens[i].partner_user_id;

					for (let j = 0; j < userDetails.count; j++) {
						if (partnerUserId === userDetails[j].sfox_id) {
							usertokens[i].user_id = userDetails[j].user_id;
							break; // Break the inner loop once a match is found
						}
					}
				}


				const transactionOperations = usertokens.map((user) => {
					return User.transaction.update(
						{ user_id: user.user_id },
						{ userToken: user.token }
					);
				});

				await dynamoose.transaction(transactionOperations);
				logger.info("Token Updated", transactionOperations)
			}
		}
	} catch (error) {
		logger.error("this is error", { error: error?.response?.data })
	}
}
// cron.schedule("0 17 * * *", () => {
//   regeneration();
// });
("2023-11-04T18:19:29.506Z");
("2023-11-04T18:33:40.999Z");
("2023-11-08T13:51:50.647Z");