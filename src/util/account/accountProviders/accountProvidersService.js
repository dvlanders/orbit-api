const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");
const createLog = require("../../logger/supabaseLogger");

const fetchAccountProvidersWithRail = async (currency, railType, paymentRail, userId, profileId, limit, createdAfter, createdBefore) => {
	try {

		let query = supabase
			.from("account_providers")
			.select("users: user_id!inner(profile_id), *")
			.eq("users.profile_id", profileId);

		query = currency ? query.eq("currency", currency) : query;
		query = railType ? query.eq("rail_type", railType) : query;
		query = paymentRail ? query.eq("payment_rail", paymentRail) : query;
		query = userId ? query.eq("user_id", userId) : query;

		query = query.lt("created_at", createdBefore ? createdBefore : new Date("2200-01-01").toISOString())
			.gt("created_at", createdAfter ? createdAfter : new Date("1900-01-01").toISOString())
			.order("created_at", { ascending: false })
			.limit(limit ? limit : 10);

		const { data, error } = await supabaseCall(() => query);
		if (error) throw error;

		return data;
	} catch (error) {
		await createLog(
			"account/accountRailsMapping/fetchAccountProvidersWithRail",
			userId ? userId : null,
			`Something went wrong when fetching accounts with currency ${currency}, railType ${railType}, paymentRail ${paymentRail}, 
			userId ${userId}, profileId ${profileId}, limit ${limit}, createdAfter ${createdAfter}, createdBefore ${createdBefore}`,
			error,
			profileId
		);
		throw new Error(
			"Something went wrong when looking up account"
		);
	}
}

const getAccountProviderIDWithInternalID = async (internalAccountId, currency = null) => {
	try {
		let query = supabase
			.from("account_providers")
			.select("id")
			.eq("account_id", internalAccountId);

		query = currency ? query.eq("currency", currency) : query;

		// TODO: there is no real way for us to know which id to return in the case when we get multiple results.
		const { data, error } = await supabaseCall(() => query.limit(1).single());
		if (error) throw error;

		return data.id;
	} catch (error) {
		await createLog(
			"account/accountRailsMapping/getAccountProviderIDWithInternalId",
			null,
			`Something went wrong when getting account ID for account with internal id ${internalAccountId}`,
			error
		);
		throw new Error(
			"Something went wrong when looking up account"
		);
	}
}

const fetchAccountProvidersWithInternalId = async (internalAccountId) => {
	try {
		const { data, error } = await supabaseCall(() =>
			supabase
				.from("account_providers")
				.select("*")
				.eq("account_id", internalAccountId)
		);
		if (error) throw error;

		return data;
	} catch (error) {
		await createLog(
			"account/accountRailsMapping/fetchAccountProvidersWithInternalId",
			null,
			`Something went wrong when fetching account for account with id ${internalAccountId}`,
			error
		);
		throw new Error(
			"Something went wrong when looking up account"
		);
	}
}

const fetchAccountProviders = async (accountId, profileId) => {
	try {

		const { data, error } = await supabaseCall(() =>
			supabase
				.from("account_providers")
				.select("users: user_id!inner(profile_id), *")
				.eq("id", accountId)
				.eq("users.profile_id", profileId)
				.maybeSingle()
		);
		if (error) throw error;

		return data;
	} catch (error) {
		console.log(error);
		await createLog(
			"account/accountRailsMapping/fetchAccountRailsMapping",
			null,
			`Something went wrong when fetching account for account with id ${accountId}`,
			error,
			profileId
		);
		throw new Error(
			"Something went wrong when looking up account"
		);
	}
};

const insertAccountProviders = async (
	accountId,
	currency,
	railType,
	paymentRail,
	provider,
	userId
) => {
	try {
		const { data, error } = await supabaseCall(() =>
			supabase.from("account_providers").insert({
				account_id: accountId,
				currency: currency,
				rail_type: railType,
				payment_rail: paymentRail,
				provider: provider?.toUpperCase(),
				user_id: userId,
			})
				.select("*")
				.single());
		if (error) throw error;

		return data;

	} catch (error) {
		await createLog(
			"account/accountRailsMapping/insertAccountRailsMapping",
			userId,
			`Something went wrong when inserting account rails mapping for account ${accountId}`,
			error
		);
		throw new Error(
			"Something went wrong when performing insertAccountRailsMapping"
		);
	}
};



module.exports = {
	fetchAccountProviders,
	fetchAccountProvidersWithInternalId,
	getAccountProviderIDWithInternalID,
	fetchAccountProvidersWithRail,
	insertAccountProviders,
};
