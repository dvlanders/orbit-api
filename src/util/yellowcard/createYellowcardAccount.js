const { insertAccountProviders } = require("../account/accountProviders/accountProvidersService");
const { fieldsValidation } = require("../common/fieldsValidation");
const { YcAccountInfoError, YcAccountInfoErrorType } = require("./utils/errors");
const { ycAccountRequiredFieldsMap, ycAccountAcceptedFieldsMap, insertYcAccountFunctionMap } = require("./utils/utils");


const createYellowcardAccount = async(config) => {
    const {fields, currency, paymentRail} = config;

    const requiredFields = ycAccountRequiredFieldsMap[paymentRail][fields.kind];
    const acceptedFields = ycAccountAcceptedFieldsMap[paymentRail][fields.kind];

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

    // insert record
    const ycAccount = await insertYcAccountFunctionMap[paymentRail](`yellowcard_${paymentRail}_accounts`, fields);

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