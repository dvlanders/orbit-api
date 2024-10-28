const { insertAccountProviders } = require("../account/accountProviders/accountProvidersService");
const { fieldsValidation } = require("../common/fieldsValidation");
const { YcAccountInfoError, YcAccountInfoErrorType } = require("./utils/errors");
const { ycAccountRequiredFieldsMap, ycAccountAcceptedFieldsMap, insertYellowcardAccount, yellowcardPhoneNumberFormatPatterMap } = require("./utils/utils");

const env = process.env.NODE_ENV;

const createYellowcardAccount = async(config) => {
    const {fields, currency, paymentRail} = config;

    const requiredFields = ycAccountRequiredFieldsMap[env][paymentRail][fields.kind];
    const acceptedFields = ycAccountAcceptedFieldsMap[env][paymentRail][fields.kind];

    if (!requiredFields || !acceptedFields) {
        throw new YcAccountInfoError(YcAccountInfoErrorType.INVALID_FIELD, 400, "", { error: "kind is invalid" });
    }

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

    // validate phoneNumber
    const phoneNumberRequiredPattern = yellowcardPhoneNumberFormatPatterMap[currency];
    if (phoneNumberRequiredPattern) {
        if (!phoneNumberRequiredPattern.test(fields.accountHolderPhone))
            throw new YcAccountInfoError(YcAccountInfoErrorType.INVALID_FIELD, 400, "", { error: `Invalid accountHolderPhone format, please follow the pattern ${phoneNumberRequiredPattern}` });
    }

    // insert record
    const ycAccount = await insertYellowcardAccount(`yellowcard_${paymentRail}_accounts`, fields);

    if (!ycAccount) {
        throw new YcAccountInfoError(YcAccountInfoErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" });
    }

    const accountProviderRecord = await insertAccountProviders(ycAccount.id, currency, "offramp", paymentRail, "YELLOWCARD", fields.user_id)
    if (!accountProviderRecord) {
        throw new YcAccountInfoError(YcAccountInfoErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" });
    }

    return accountProviderRecord
}

module.exports = {
    createYellowcardAccount
};