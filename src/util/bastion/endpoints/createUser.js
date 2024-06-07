const supabase = require("../../supabaseClient");
const fundMaticPolygon = require("../fundMaticPolygon");

const BASTION_URL = process.env.BASTION_URL;
const BASTION_API_KEY = process.env.BASTION_API_KEY;

/**
 * Core function to create a user in Bastion and handle associated wallet records.
 * @param merchantId - Identifier for the merchant in the external system.
 */
async function createUserCore(userId) {
	const { data: userData, error: userError } = await supabase
		.from("user_kyc")
		.select("*")
		.eq("id", userId);

	if (userError) {
		throw new Error("Failed to fetch user data");
	}

	const chains = [
		"ETHEREUM_MAINNET",
		"POLYGON_MAINNET",
		"OPTIMISM_MAINNET",
		"BASE_MAINNET",
	];
	const bodyObject = { id: userId, chains };
	const url = `${BASTION_URL}/v1/users`;
	const options = {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			Authorization: `Bearer ${BASTION_API_KEY}`,
		},
		body: JSON.stringify(bodyObject),
	};

	const response = await fetch(url, options);
	const data = await response.json();

	if (response.status !== 201) {
		throw new Error(
			{
				error: ` ${JSON.stringify(data)}`,
			}
		);
	}

	if (!data.addresses || data.addresses.length === 0) {
		throw new Error("No addresses found in Bastion response");
	}

	// Processing and logging for each address and chain
	for (const addressEntry of data.addresses) {
		await supabase.from("bastion_wallets").insert({
			userId: userId,
			chain: addressEntry.chain,
			address: addressEntry.address,
		});
	}

	// fund the user's polygon wallet with some gas for future transactions
	try {
		await fundMaticPolygon(userId, "0.25");
	} catch (error) {
		// throw the error to the caller with the specific error message


	}
	return data;
}

/**
 * Process each address from the Bastion response, inserting them into the Supabase database
 * and optionally funding them based on the chain.
 * @param addresses - Array of address objects from the Bastion response.
 * @param merchantId - Identifier for the merchant in the external system.
 */
// async function processWalletAddresses(addresses, userId) {
// 	for (const addressEntry of addresses) {
// 		await supabase.from("bastion_wallets").insert({
// 			userId: userId,
// 			chain: addressEntry.chain,
// 			address: addressEntry.address,
// 		});

// 		// if (addressEntry.chain === "POLYGON_MAINNET") {
// 		// 	// Assume fundMaticPolygon is a function that funds the wallet

// 		// 	try {
// 		// 		await fundMaticPolygon(userId, addressEntry.address, "0.25");
// 		// 	} catch (error) {
// 		// 		throw new Error("Failed to fund Polygon wallet");
// 		// 	}
// 		// }
// 	}
// }

async function createUser(userId) {
	try {
		const data = await createUserCore(userId);
		return data;
	} catch (error) {
		// await supabase.from("logs").insert({
		//   log: error.toString(),
		//   merchant_id: merchantId,
		//   endpoint: "/bastion/createUser",
		// });
		return error;
	}
}

module.exports = createUser;
