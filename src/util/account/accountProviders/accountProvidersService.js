const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");
const createLog = require("../../logger/supabaseLogger");

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
    await createLog(
      "account/accountRailsMapping/fetchAccountRailsMapping",
      null,
      `Something went wrong when fetching account rails mapping for account ${accountId}`,
      error,
      profileId
    );
    throw new Error(
      "Something went wrong when performing fetchAccountRailsMapping"
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
    const { error } = await supabaseCall(() =>
      supabase.from("account_providers").insert({
        id: accountId,
        currency: currency,
        rail_type: railType,
        payment_rail: paymentRail,
        provider: provider?.toUpperCase(),
        user_id: userId,
      })
    );
    if (error) throw error;
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
  insertAccountProviders,
};
