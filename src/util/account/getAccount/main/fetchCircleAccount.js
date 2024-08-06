const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const selectFields = `
	id, 
	created_at,
	circle_status,
	account_type,
	iban,
	business_identifier_code,
	account_number, 
	routing_number, 
	account_holder_name, 
	account_holder_city, 
	account_holder_country, 
	account_holder_street_line_1, 
	account_holder_street_line_2, 
	account_holder_state_province_region, 
	account_holder_postal_code, 
	bank_name, 
	bank_city, 
	bank_country,
	bank_street_line_1,
	bank_street_line_2,
	bank_state_province_region,
	user_id
`;

const filledInfo = (circleAccountData) => {
  const resObject = {
    accountId: circleAccountData.id,
    createdAt: circleAccountData.created_at,
    status: circleAccountData.circle_status,
    accountType: circleAccountData.account_type,
    iban: circleAccountData.iban,
    businessIdentifierCode: circleAccountData.business_identifier_code,
    accountNumber: circleAccountData.account_number,
    routingNumber: circleAccountData.routing_number,
    accountHolderName: circleAccountData.account_holder_name,
    accountHolderCity: circleAccountData.account_holder_city,
    accountHolderCountry: circleAccountData.account_holder_country,
    accountHolderStreetLine1: circleAccountData.account_holder_street_line_1,
    accountHolderStreetLine2: circleAccountData.account_holder_street_line_2,
    accountHolderStateProvinceRegion:
      circleAccountData.account_holder_state_province_region,
    accountHolderPostalCode: circleAccountData.account_holder_postal_code,
    bankName: circleAccountData.bank_name,
    bankCity: circleAccountData.bank_city,
    bankCountry: circleAccountData.bank_country,
    bankStreetLine1: circleAccountData.bank_street_line_1,
    bankStreetLine2: circleAccountData.bank_street_line_2,
    bankStateProvinceRegion: circleAccountData.bank_state_province_region,
    userId: circleAccountData.user_id,
  };

  // Remove fields with null values
  Object.keys(resObject).forEach((key) => {
    if (resObject[key] === null || resObject[key] === undefined) {
      delete resObject[key];
    }
  });

  return resObject;
};

const fetchCircleAccount = async (
  accountType,
  profileId,
  accountId,
  userId,
  limit = 10,
  createdAfter = new Date("1900-01-01").toISOString(),
  createdBefore = new Date("2200-01-01").toISOString()
) => {
  let allBanksInfo;
  let bankInfo;

  if (!accountId) {
    if (userId) {
      // fetch all record of an user
      let { data: circleAccountData, error: circleAccountError } =
        await supabaseCall(() =>
          supabase
            .from("circle_accounts")
            .select(selectFields)
            .eq("account_type", accountType)
            .eq("user_id", userId)
            .lt("created_at", createdBefore)
            .gt("created_at", createdAfter)
            .order("created_at", { ascending: false })
            .limit(limit)
        );
      if (circleAccountError) throw circleAccountError;
      allBanksInfo = circleAccountData;
    } else {
      // fetch all records of an org
      let { data: circleAccountData, error: circleAccountError } =
        await supabaseCall(() =>
          supabase
            .from("circle_accounts")
            .select(`users: user_id!inner(id, profile_id), ${selectFields}`)
            .eq("account_type", accountType)
            .eq("users.profile_id", profileId)
            .lt("created_at", createdBefore)
            .gt("created_at", createdAfter)
            .order("created_at", { ascending: false })
            .limit(limit)
        );
      if (circleAccountError) throw circleAccountError;
      allBanksInfo = circleAccountData;
    }
  } else {
    // fetch single record
    let { data: circleAccountData, error: circleAccountError } =
      await supabaseCall(() =>
        supabase
          .from("circle_accounts")
          .select(selectFields)
          .eq("id", accountId)
          .eq("account_type", accountType)
          .maybeSingle()
      );
    if (circleAccountError) throw circleAccountError;
    bankInfo = circleAccountData;
  }

  if (accountId && !bankInfo) return null;
  if (bankInfo) {
    return filledInfo(bankInfo);
  } else if (allBanksInfo) {
    return {
      count: allBanksInfo.length,
      banks: allBanksInfo.map((bank) => filledInfo(bank)),
    };
  }

  return null;
};

module.exports = fetchCircleAccount;
