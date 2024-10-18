const { isUUID } = require("../../common/fieldsValidation");
const supabase = require("../../supabaseClient");
const { YcAccountInfoError, YcAccountInfoErrorType } = require("./errors");

// MOMO_MPESA
const momoMpesaRequiredFields = [
    "user_id",
    "accountHolderPhone",
    "accountHolderName",
    "kind"
]
const momoMpesaAcceptedFields = {
    user_id: (value) => isUUID(value),
    accountHolderPhone: (value) => { return /^\+\d{11,15}$/.test(value) },
    accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
    kind: "string",
}

// MOMO_MTN
const momoMtnRequiredFields = [
    "user_id",
    "accountHolderPhone",
    "accountHolderName",
    "kind"
]
const momoMtnAcceptedFields = {
    user_id: (value) => isUUID(value),
    accountHolderPhone: (value) => { return /^\+\d{11,15}$/.test(value) },
    accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
    kind: "string",
}

// BANK_ACCESS BANK
const bankAccessRequiredFields = [
    "user_id",
    "accountNumber",
    "accountHolderName",
    "accountHolderPhone",
    "kind"
]
const bankAccessAcceptedFields = {
    user_id: (value) => isUUID(value),
    accountNumber: (value) => { return /^[0-9]{10}$/.test(value) },
    accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
    accountHolderPhone: (value) => { return /^\+\d{11,15}$/.test(value) },
    kind: "string",
}

// BANK_Manul Entry
const bankManulRequiredFields = [
    "user_id",
    "accountNumber",
    "accountHolderPhone",
    "accountHolderName",
    "bankName",
    "kind"
]
const bankManulAcceptedFields = {
    user_id: (value) => isUUID(value),
    accountNumber: (value) => { return /^[0-9]{10}$/.test(value) },
    accountHolderPhone: (value) => { return /^\+\d{11,15}$/.test(value) },
    accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
    bankName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
    kind: "string",
}

// BANK_GT Bank
const bankGtRequiredFields = [
    "user_id",
    "accountNumber",
    "accountHolderName",
    "kind"
]
const bankGtAcceptedFields = {
    user_id: (value) => isUUID(value),
    accountNumber: (value) => { return /^[0-9]{10}$/.test(value) },
    accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
    kind: "string",
}

// BANK_United Bank for Africa
const bankUnitedRequiredFields = [
    "user_id",
    "accountNumber",
    "accountHolderName",
    "kind"
]
const bankUnitedAcceptedFields = {
    user_id: (value) => isUUID(value),
    accountNumber: (value) => { return /^[0-9]{10}$/.test(value) },
    accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
    kind: "string",
}


const ycAccountRequiredFieldsMap = {
    momo_kes: {
        MOMO_MPESA: momoMpesaRequiredFields
    },
    momo_xof: {
        MOMO_MTN: momoMtnRequiredFields
    },
    momo_rwf: {
        MOMO_MTN: momoMtnRequiredFields
    },
    momo_zmw: {
        MOMO_MTN: momoMtnRequiredFields
    },
    bank_ngn: {
        "BANK_Access Bank": bankAccessRequiredFields,
        "BANK_GT Bank": bankGtRequiredFields,
        "BANK_United Bank for Africa": bankUnitedRequiredFields,
    },
    bank_ugx: {
        "BANK_Manul Entry": bankManulRequiredFields,
    },
    bank_tzs: {
        "BANK_Manul Entry": bankManulRequiredFields,
    },
    bank_mwk: {
        "BANK_Manul Entry": bankManulRequiredFields,
    },
    bank_xaf: {
        "BANK_Manul Entry": bankManulRequiredFields,
    },
}

const ycAccountAcceptedFieldsMap = {
    momo_kes: {
        MOMO_MPESA: momoMpesaAcceptedFields,
    },
    momo_xof: {
        MOMO_MTN: momoMtnAcceptedFields,
    },
    momo_rwf: {
        MOMO_MTN: momoMtnAcceptedFields,
    },
    momo_zmw: {
        MOMO_MTN: momoMtnAcceptedFields,
    },
    bank_ngn: {
        "BANK_Access Bank": bankAccessAcceptedFields,
        "BANK_GT Bank": bankGtAcceptedFields,
        "BANK_United Bank for Africa": bankUnitedAcceptedFields,
    },
    bank_ugx: {
        "BANK_Manul Entry": bankManulAcceptedFields,
    },
    bank_tzs: {
        "BANK_Manul Entry": bankManulAcceptedFields,
    },
    bank_mwk: {
        "BANK_Manul Entry": bankManulAcceptedFields,
    },
    bank_xaf: {
        "BANK_Manul Entry": bankManulAcceptedFields,
    },
}

const insertYcMomoAccount = async(tableName, fields) => {
    const { data: momoAccountData, error: momoAccountError } = await supabase.from(tableName).insert({
        account_number: fields.accountHolderPhone,
        account_holder_name: fields.accountHolderName,
        kind: fields.kind,
        user_id: fields.user_id
    })
        .select()
        .single();

    if (momoAccountError) {
        throw new YcAccountInfoError(YcAccountInfoErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" });
    }

    return momoAccountData;
}

const insertYcBankAccount = async(tableName, fields) => {
    const { data: bankAccountData, error: bankAccountError } = await supabase.from(tableName).insert({
        account_number: fields.accountNumber,
        account_holder_phone: fields.accountHolderPhone,
        account_holder_name: fields.accountHolderName,
        bank_name: fields.bankName,
        kind: fields.kind,
        user_id: fields.user_id
    })
        .select()
        .single();

    if (bankAccountError) {
        throw new YcAccountInfoError(YcAccountInfoErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" });
    }

    return bankAccountData;
}


const insertYcAccountFunctionMap = {
    momo_kes: insertYcMomoAccount,
    momo_xof: insertYcMomoAccount,
    momo_rwf: insertYcMomoAccount,
    momo_zmw: insertYcMomoAccount,
    bank_ngn: insertYcBankAccount,
    bank_ugx: insertYcBankAccount,
    bank_tzs: insertYcBankAccount,
    bank_mwk: insertYcBankAccount,
    bank_xaf: insertYcBankAccount,
}

module.exports = {
    ycAccountRequiredFieldsMap,
    ycAccountAcceptedFieldsMap,
    insertYcAccountFunctionMap,
}