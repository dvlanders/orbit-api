const { isUUID } = require("../../common/fieldsValidation");
const supabase = require("../../supabaseClient");
const { YcAccountInfoError, YcAccountInfoErrorType } = require("./errors");

// yellowcard network to blockchain network
const yellowcardNetworkToChain = process.env.NODE_ENV === "development" ? {
    "POLYGON": "POLYGON_AMOY",
    "ERC20": "ETHEREUM_TESTNET"
} : {
    "POLYGON": "POLYGON_MAINNET",
    "ERC20": "ETHEREUM_MAINNET"
}

// MOMO_MPESA
const momoMpesaRequiredFields = {
    production: [
        "user_id",
        "accountHolderPhone",
        "accountHolderName",
        "kind"
    ],
    development: [
        "user_id",
        "accountNumber",
        "accountHolderPhone",
        "accountHolderName",
        "kind"
    ]
}
const momoMpesaAcceptedFields = {
    production: {
        user_id: (value) => isUUID(value),
        accountHolderPhone: (value) => { return /^\+\d{11,15}$/.test(value) },
        accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
        kind: "string",
    },
    development: {
        user_id: (value) => isUUID(value),
        accountNumber: (value) => { return /^\+\d{11,15}$/.test(value) },
        accountHolderPhone: (value) => { return /^\+\d{11,15}$/.test(value) },
        accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
        kind: "string",
    }
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

// MOMO_Airtel
const momoAirtelRequiredFields = {
    production: [
        "user_id",
        "accountHolderPhone",
        "accountHolderName",
        "kind"
    ],
    development: [
        "user_id",
        "accountNumber",
        "accountHolderPhone",
        "accountHolderName",
        "kind"
    ]
}
const momoAirtelAcceptedFields = {
    production: {
        user_id: (value) => isUUID(value),
        accountHolderPhone: (value) => { return /^\+\d{11,15}$/.test(value) },
        accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
        kind: "string",
    },
    development: {
        user_id: (value) => isUUID(value),
        accountNumber: (value) => { return /^\+\d{11,15}$/.test(value) },
        accountHolderPhone: (value) => { return /^\+\d{11,15}$/.test(value) },
        accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
        kind: "string",
    }
}

// MOMO_TNM
const momoTnmRequiredFields = {
    production: [
        "user_id",
        "accountHolderPhone",
        "accountHolderName",
        "kind"
    ],
    development: [
        "user_id",
        "accountNumber",
        "accountHolderPhone",
        "accountHolderName",
        "kind"
    ]
}
const momoTnmAcceptedFields = {
    production: {
        user_id: (value) => isUUID(value),
        accountHolderPhone: (value) => { return /^\+\d{11,15}$/.test(value) },
        accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
        kind: "string",
    },
    development: {
        user_id: (value) => isUUID(value),
        accountNumber: (value) => { return /^\+\d{11,15}$/.test(value) },
        accountHolderPhone: (value) => { return /^\+\d{11,15}$/.test(value) },
        accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
        kind: "string",
    }
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

// YellowCard Common Fields
const yellowcardCommonRequiredFields = [
    "user_id",
    "accountNumber",
    "accountHolderName",
    "accountHolderPhone",
    "kind"
]
const yellowcardCommonAcceptedFields = {
    user_id: (value) => isUUID(value),
    accountNumber: (value) => { return /^[0-9]{10}$/.test(value) },
    accountHolderName: (value) => { return /^(?=.{1,32}$)[A-Za-z'-]+ [A-Za-z'-]+$/.test(value) },
    accountHolderPhone: (value) => { return /^\+\d{11,15}$/.test(value) },
    kind: "string",
}


const ycAccountRequiredFieldsMap = {
    production: {
        momo_kes: {
            MOMO_MPESA: momoMpesaRequiredFields.production
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
    },
    development: {
        momo_kes: {
            MOMO_MPESA: momoMpesaRequiredFields.development,
        },
        momo_xof: {
        //     MOMO_MTN: momoMtnRequiredFields
        },
        momo_rwf: {
            // MOMO_MTN: momoMtnRequiredFields
        },
        momo_zmw: {
            // MOMO_MTN: momoMtnRequiredFields
        },
        momo_mwk: {
            MOMO_AIRETEL: momoAirtelRequiredFields.development,
            MOMO_TNM: momoTnmRequiredFields.development,
        },
        bank_ngn: {
            "BANK_Stanbic Ibtc Bank": yellowcardCommonRequiredFields,
            "BANK_Zenith Bank": yellowcardCommonRequiredFields,
            "BANK_Guaranty Trust Bank": yellowcardCommonRequiredFields,
            "BANK_Heritage Bank": yellowcardCommonRequiredFields,
            "BANK_Enterprise Bank": yellowcardCommonRequiredFields,
            "BANK_Sterling Bank": yellowcardCommonRequiredFields,
            "BANK_Access Bank": yellowcardCommonRequiredFields,
        },
        bank_ugx: {
            "BANK_Manual Input": yellowcardCommonRequiredFields,
        },
        bank_tzs: {
            // "BANK_Manul Entry": bankManulRequiredFields,
        },
        bank_mwk: {
            // "BANK_Manul Entry": bankManulRequiredFields,
        },
        bank_xaf: {
            // "BANK_Manul Entry": bankManulRequiredFields,
        },
    }
}

const ycAccountAcceptedFieldsMap = {
    production: {
        momo_kes: {
            MOMO_MPESA: momoMpesaAcceptedFields.production
        },
        momo_xof: {
            MOMO_MTN: momoMtnAcceptedFields
        },
        momo_rwf: {
            MOMO_MTN: momoMtnAcceptedFields
        },
        momo_zmw: {
            MOMO_MTN: momoMtnAcceptedFields
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
    },
    development: {
        momo_kes: {
            MOMO_MPESA: momoMpesaAcceptedFields.development,
        },
        momo_xof: {
            // MOMO_MTN: momoMtnAcceptedFields
        },
        momo_rwf: {
            // MOMO_MTN: momoMtnAcceptedFields
        },
        momo_zmw: {
            // MOMO_MTN: momoMtnAcceptedFields
        },
        momo_mwk: {
            MOMO_AIRETEL: momoAirtelAcceptedFields.development,
            MOMO_TNM: momoTnmAcceptedFields.development,
        },
        bank_ngn: {
            "BANK_Stanbic Ibtc Bank": yellowcardCommonAcceptedFields,
            "BANK_Zenith Bank": yellowcardCommonAcceptedFields,
            "BANK_Guaranty Trust Bank": yellowcardCommonAcceptedFields,
            "BANK_Heritage Bank": yellowcardCommonAcceptedFields,
            "BANK_Enterprise Bank": yellowcardCommonAcceptedFields,
            "BANK_Sterling Bank": yellowcardCommonAcceptedFields,
            "BANK_Access Bank": yellowcardCommonAcceptedFields,
        },
        bank_ugx: {
            "BANK_Manual Input": yellowcardCommonAcceptedFields,
        },
        bank_tzs: {
            // "BANK_Manul Entry": bankManulAcceptedFields,
        },
        bank_mwk: {
            // "BANK_Manul Entry": bankManulAcceptedFields,
        },
        bank_xaf: {
            // "BANK_Manul Entry": bankManulAcceptedFields,
        },
    }
}

const yellowcardPhoneNumberFormatPatterMap = {  
    kes: /^\+254[0-9]{9}$/,
    ngn: /^\+234[0-9]{10}$/,
    ugx: /^\+256[0-9]{9}$/,
    mwk: /^\+265[0-9]{10}$/,
};

const insertYellowcardAccount = async(tableName, fields) => {
    const { data: yellowcardAccountData, error: yellowcardAccountError } = await supabase.from(tableName).insert({
        account_number: fields.accountNumber || fields.accountHolderPhone,              // it will be filled as phone number if account number is empty
        account_holder_phone: fields.accountNumber && fields.accountHolderPhone,        // it will be filled as NULL if account number is empty
        account_holder_name: fields.accountHolderName,
        bank_name: fields.bankName,
        kind: fields.kind,
        user_id: fields.user_id
    })
        .select()
        .single();

    if (yellowcardAccountError) {
        throw new YcAccountInfoError(YcAccountInfoErrorType.INTERNAL_ERROR, 500, "", { error: "Unexpected error happened, please contact HIFI for more information" });
    }

    return yellowcardAccountData;
}

const hifiOfframpTransactionStatusMap = {
    "PAYIN_PENDING": "COMPLETED_ONCHAIN",
    "PAYIN_INITIATED": "COMPLETED_ONCHAIN",
    "PAYIN_SETTLED": "COMPLETED_ONCHAIN",
	'PAYIN_FAILED': 'FAILED_FIAT_RETURNED',
    "PAYIN_EXPIRED": "FAILED_ONCHAIN",
	'PAYOUT_PENDING': 'IN_PROGRESS_FIAT',
	"PAYOUT_INITIATED": "INITIATED_FIAT",
	'PAYOUT_SETTLED': 'COMPLETED',
    "PAYOUT_FAILED": "FAILED_FIAT_RETURNED",
    "REFUND_PENDING": "FAILED_FIAT_RETURNED",
    "REFUND_INITIATED": "FAILED_FIAT_RETURNED",
    "REFUND_SETTLED": "FAILED_FIAT_REFUNDED",
    "REFUND_FAILED": "FAILED_UNKNOWN", //customer should contact support
}

const failedReasonMap = {
    "PAYIN_FAILED": "Failed to fulfilled order. Please contact HIFI for more information",
    "PAYIN_EXPIRED": "Order expired. Please contact HIFI for more information",
    "PAYOUT_FAILED": "Failed to initiate fiat payout. Please contact HIFI for more information",
    "REFUND_FAILED": "Failed to refund. Please contact HIFI for more information",
}

const mapCloseReason = (errorMessage) => {
    const minAmountRegex = /transaction amount less than the minimum of (\d+)/i;
    const minAmountMatch = errorMessage.match(minAmountRegex);
    if (minAmountMatch) {
        const minimum = parseInt(minAmountMatch[1], 10)
        return {
            error: 'AMOUNT_TOO_LOW',
            failedReason: `Amount is less than the minimum destination amount: ${minimum}`,
        };
    }

    return {
        error: 'UNKNOWN',
        failedReason: "Unable to process transaction, please reach out for more information",
    };
}

module.exports = {
    ycAccountRequiredFieldsMap,
    ycAccountAcceptedFieldsMap,
    insertYellowcardAccount,
    yellowcardNetworkToChain,
    yellowcardPhoneNumberFormatPatterMap,
    hifiOfframpTransactionStatusMap,
    failedReasonMap,
    mapCloseReason
}