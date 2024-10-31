const { insertAccountProviders } = require("../account/accountProviders/accountProvidersService");
const { fieldsValidation, isUUID } = require("../common/fieldsValidation");
const { inStringEnum } = require("../common/filedValidationCheckFunctions");
const { YcAccountInfoError, YcAccountInfoErrorType } = require("./utils/errors");
const { insertYellowcardAccount, yellowcardPhoneNumberFormatPatternMap, yellowcardAccountNumberFormatPatternMap, yellowcardSupportedKindsMap } = require("./utils/utils");

const env = process.env.NODE_ENV;

const createYellowcardAccount = async(config) => {
    const {fields, currency, paymentRail} = config;

    const requiredFields = [
        "userId",
        "accountNumber",
        "accountHolderName",
        "accountHolderPhone",
        "kind"
    ];
    const acceptedFields = {
        userId: (value) => isUUID(value),
        accountNumber: (value) => { return yellowcardAccountNumberFormatPatternMap[currency].test(value) },
        accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
        accountHolderPhone: (value) => { return yellowcardPhoneNumberFormatPatternMap[currency].test(value) },
        kind: (value) => inStringEnum(value, yellowcardSupportedKindsMap[env][paymentRail]),
    };

    // check if required fields are uploaded and validate field values
    const { missingFields, invalidFields } = fieldsValidation(
        fields,
        requiredFields,
        acceptedFields
    );

    if (missingFields.length > 0 || invalidFields.length > 0) {
        throw new YcAccountInfoError(
            YcAccountInfoErrorType.INVALID_FIELD,
            400,
            "",
            {
                error: `fields provided are either missing or invalid`,
                missing_fields: missingFields,
                invalid_fields: invalidFields,
            }
        );
    }

    // insert record
    const ycAccount = await insertYellowcardAccount(`yellowcard_${paymentRail}_accounts`, fields);

    if (!ycAccount) {
        throw new YcAccountInfoError(YcAccountInfoErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" });
    }

    const accountProviderRecord = await insertAccountProviders(ycAccount.id, currency, "offramp", paymentRail, "YELLOWCARD", fields.userId)
    if (!accountProviderRecord) {
        throw new YcAccountInfoError(YcAccountInfoErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" });
    }

    return accountProviderRecord
}

module.exports = {
    createYellowcardAccount
};