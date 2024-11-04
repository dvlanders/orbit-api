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

const yellowcardSupportedKindsMap = {
    development: {
        momo_kes: [],
        momo_xof: [],
        momo_rwf: [],
        momo_zmw: [],
        momo_mwk: ["MOMO_AIRTEL", "MOMO_TNM"],
        momo_tzs: [],
        momo_xaf: [],
        bank_ngn: ["BANK_Stanbic Ibtc Bank", "BANK_Zenith Bank", "BANK_Guaranty Trust Bank", "BANK_Heritage Bank", "BANK_Enterprise Bank", "BANK_Sterling Bank", "BANK_Access Bank", "BANK_Keystone Bank", "BANK_Union Bank of Nigeria", "BANK_Wema Bank", "BANK_First City Monument Bank", "BANK_United Bank for Africa", "BANK_Skye Bank", "BANK_Ecobank Nigeria", "BANK_Unity Bank", "BANK_Diamond Bank", "BANK_Citibank Nigeria", "BANK_Standard Chartered Bank", "BANK_Fidelity Bank", "BANK_First Bank of Nigeria", "BANK_Mainstreet Bank"],
        bank_ugx: [],
    },
    production: {
        momo_kes: ["MOMO_MPESA"],
        momo_xof: ["MOMO_WAVE", "MOMO_ORANGE", "MOMO_MTN", "MOMO_VISA", "MOMO_MOOV"],
        momo_rwf: [],
        momo_zmw: ["MOMO_MTN", "MOMO_ZAMTEL", "MOMO_AIRTEL"],
        momo_mwk: ["MOMO_AIRTEL", "MOMO_TNM"],
        momo_tzs: ["MOMO_AIRTEL", "MOMO_TIGO", "MOMO_VODACOM", "MOMO_AZAMPESA", "MOMO_HALOPESA"],
        momo_xaf: ["MOMO_WALLET"],
        bank_ngn: ["BANK_Standard Chartered Bank", "BANK_Citibank Nigeria", "BANK_Wema Bank", "BANK_Unity Bank", "BANK_United Bank for Africa", "BANK_Access Bank (Diamond)", "BANK_Union Bank of Nigeria", "BANK_Ecobank Nigeria", "BANK_Providus Bank", "BANK_Access Bank", "BANK_Stanbic Ibtc Bank", "BANK_Polaris Bank", "BANK_Keystone Bank", "BANK_Fidelity Bank", "BANK_Zenith Bank", "BANK_Heritage Bank", "BANK_Enterprise Bank", "BANK_Guaranty Trust Bank", "BANK_GT Bank", "BANK_Paga", "BANK_Sterling Bank", "BANK_Mainstreet Bank", "BANK_First City Monument Bank", "BANK_First Bank of Nigeria"],
        bank_ugx: [],
    }
}

const yellowcardPhoneNumberFormatPatternMap = {  
    kes: /^\+254[0-9]{9}$/,
    xof: /^\+221[0-9]{9}$/,
    rwf: /^\+250[0-9]{9}$/,
    zmw: /^\+260[0-9]{9}$/,
    mwk: /^\+265[0-9]{10}$/,
    tzs: /^\+255\d{8,9}$/,
    xaf: /^\+237[0-9]{9}$/,
    ngn: /^\+234[0-9]{10}$/,
    ugx: /^\+256[0-9]{9}$/,
};

const yellowcardAccountNumberFormatPatternMap = {
    kes: /^\+254[0-9]{9}$/,
    xof: /^\+221[0-9]{9}$/,
    rwf: /^\+250[0-9]{9}$/,
    zmw: /^\+260[0-9]{9}$/,
    mwk: /^\+265[0-9]{10}$/,
    tzs: /^\+255\d{8,9}$/,
    xaf: /^\+237[0-9]{9}$/,
    ngn: /^[0-9]{10}$/,
    ugx: /^\+256[0-9]{9}$/,
}

const yellowcardMethodFieldsMap = {
    // parirs (env, currency, kind)
    development: {
        kes: {},
        xof: {},
        rwf: {},
        zmw: {},
        mwk: {
            MOMO_AIRETEL: {
                kind: "MOMO_Airtel+3b589b9a-65d4-4246-b33a-f095dfc2977d",
                name: "Airtel",
                group: "MOMO",
            },
            MOMO_TNM: {
                kind: "MOMO_TNM+ac522946-3d5d-488e-bf73-583b8d8de908",
                name: "TNM",
                group: "MOMO",
            },
        },
        tzs: {},
        xaf: {},
        ngn: {
            "BANK_Stanbic Ibtc Bank": {
                kind: "BANK_Stanbic Ibtc Bank+3d4d08c1-4811-4fee-9349-a302328e55c1",
                name: "Stanbic Ibtc Bank",
                group: "BANK",
            },
            "BANK_Zenith Bank": {
                kind: "BANK_Zenith Bank+6df48502-1ebe-473f-be17-e2cae4dd67ee",
                name: "Zenith Bank",
                group: "BANK",
            },
            "BANK_Guaranty Trust Bank": {
                kind: "BANK_Guaranty Trust Bank+31cfcc77-8904-4f86-879c-a0d18b4b9365",
                name: "Guaranty Trust Bank",
                group: "BANK",
            },
            "BANK_Heritage Bank": {
                kind: "BANK_Heritage Bank+8ff2ece4-3a97-4f86-9c21-db6db8c477b4",
                name: "Heritage Bank",
                group: "BANK",
            },
            "BANK_Enterprise Bank": {
                kind: "BANK_Enterprise Bank+d1843b02-d571-4959-82ab-071ff0db237e",
                name: "Enterprise Bank",
                group: "BANK",
            },
            "BANK_Sterling Bank": {
                kind: "BANK_Sterling Bank+8e1bd085-5ed0-4adf-a16d-be819e599940",
                name: "Sterling Bank",
                group: "BANK",
            },
            "BANK_Access Bank": {
                kind: "BANK_Access Bank+5f1af11b-305f-4420-8fce-65ed2725a409",
                name: "Access Bank",
                group: "BANK",
            },
            "BANK_Keystone Bank": {
                kind: "BANK_Keystone Bank+125df772-0bd9-4ad2-8b10-ff377f8cfad1",
                name: "Keystone Bank",
                group: "BANK",
            },
            "BANK_Union Bank of Nigeria": {
                kind: "BANK_Union Bank of Nigeria+fa316206-dacc-4e87-a80a-5f539a719c56",
                name: "Union Bank of Nigeria",
                group: "BANK",
            },
            "BANK_Wema Bank": {
                kind: "BANK_Wema Bank+135e8f0b-3c9a-404c-9b98-65c4d3af4d0f",
                name: "Wema Bank",
                group: "BANK",
            },
            "BANK_First City Monument Bank": {
                kind: "BANK_First City Monument Bank+600a5df5-c28c-435c-b3be-19dbed0ee402",
                name: "First City Monument Bank",
                group: "BANK",
            },
            "BANK_United Bank for Africa": {
                kind: "BANK_United Bank for Africa+75faa922-8a18-4c54-a357-6d6a670379a3",
                name: "United Bank for Africa",
                group: "BANK",
            },
            "BANK_Skye Bank": {
                kind: "BANK_Skye Bank+6ef18cb4-1c34-4129-84c4-e626a6a73d10",
                name: "Skye Bank",
                group: "BANK",
            },
            "BANK_Ecobank Nigeria": {
                kind: "BANK_Ecobank Nigeria+754202b6-da04-5f18-a86a-e5b2dd86bbb5",
                name: "Ecobank Nigeria",
                group: "BANK",
            },
            "BANK_Unity Bank": {
                kind: "BANK_Unity Bank+5dcfa62b-5cfa-4e59-aae4-95f7fecdeaa6",
                name: "Unity Bank",
                group: "BANK",
            },
            "BANK_Diamond Bank": {
                kind: "BANK_Diamond Bank+b1a1bf8a-15fa-4454-a0fa-38a813a56c5a",
                name: "Diamond Bank",
                group: "BANK",
            },
            "BANK_Citibank Nigeria": {
                kind: "BANK_Citibank Nigeria+d5212d1c-e9bb-4db6-8dc0-aefe3a925a65",
                name: "Citibank Nigeria",
                group: "BANK",
            },
            "BANK_Standard Chartered Bank": {
                kind: "BANK_Standard Chartered Bank+98b219a0-2f80-4f2a-9d7d-487d348f9ea4",
                name: "Standard Chartered Bank",
                group: "BANK",
            },
            "BANK_Fidelity Bank": {
                kind: "BANK_Fidelity Bank+d2bbb2b8-0db8-4b33-bd7e-3fe792839fb7",
                name: "Fidelity Bank",
                group: "BANK",
            },
            "BANK_First Bank of Nigeria": {
                kind: "BANK_First Bank of Nigeria+790567b6-da04-5f18-a86a-e5b2dd86bbb5",
                name: "First Bank of Nigeria",
                group: "BANK",
            },
            "BANK_Mainstreet Bank": {
                kind: "BANK_Mainstreet Bank+d659aee4-674a-40dc-b5b3-31387d4b5d1c",
                name: "Mainstreet Bank",
                group: "BANK",
            },
        },
        ugx: {}
    },
    production: {
        kes: {
            MOMO_MPESA: {
                kind: "MOMO_Mobile Wallet (M-PESA)+7ea6df5c-6bba-46b2-a7e6-f511959e7edb",
                name: "Mobile Wallet (M-PESA)",
                group: "MOMO",
            }
        },
        xof: {
            MOMO_WAVE: {
                kind: "MOMO_Wave+8d18204e-b51f-4554-815d-71586d0dac13",
                name: "Wave",
                group: "MOMO",
            },
            MOMO_ORANGE: {
                kind: "MOMO_Orange Money+ffb414e2-a7f9-49e4-aaf1-e26ea6d93465",
                name: "Orange Money",
                group: "MOMO",
            },
            MOMO_MTN: {
                kind: "MOMO_Mtn Mobile Money+a25d6c19-752e-4807-82ab-a60909c0c68e",
                name: "Mtn Mobile Money",
                group: "MOMO",
            },
            MOMO_VISA: {
                kind: "MOMO_VISA/MasterCard+2e77f520-8d70-4863-9f42-9dd675cc826c",
                name: "VISA/MasterCard",
                group: "MOMO",
            },
            MOMO_MOOV: {
                kind: "MOMO_Moov money+e60702a6-76ab-4736-8b87-2f2fdad01eb8",
                name: "Moov money",
                group: "MOMO",
            },
        },
        rwf: {},
        zmw: {
            MOMO_MTN: {
                kind: "MOMO_MTN+69affaa2-fbec-4e28-abd0-7444232721be",
                name: "MTN",
                group: "MOMO",
            },
            MOMO_ZAMTEL: {
                kind: "MOMO_Zamtel+ffe64502-1ee7-4ee3-86e1-04f1737f1d7b",
                name: "Zamtel",
                group: "MOMO",
            },
            MOMO_AIRTEL: {
                kind: "MOMO_Airtel+20823163-f55c-4fa5-8cdb-d59c5289a137",
                name: "Airtel",
                group: "MOMO",
            },
        },
        mwk: {
            MOMO_AIRTEL: {
                kind: "MOMO_Airtel+3a03d846-8918-4964-b09e-fc3169e77504",
                name: "Airtel",
                group: "MOMO",
            },
            MOMO_TNM: {
                kind: "MOMO_TNM+07bdc2a0-a964-406c-9763-41af8deae2af",
                name: "TNM",
                group: "MOMO",
            },
        },
        tzs: {
            MOMO_AIRTEL: {
                kind: "MOMO_AIRTELMONEYTZ+0dae3b0d-4074-406b-aede-790c0be061cc",
                name: "AIRTELMONEYTZ",
                group: "MOMO",
            },
            MOMO_TIGO: {
                kind: "MOMO_TIGO+f131ff5b-3518-4f9f-b151-cd76bb2f43f2",
                name: "TIGO",
                group: "MOMO",
            },
            MOMO_VODACOM: {
                kind: "MOMO_VODACOM+b54a0fae-b9c5-43bd-aedd-db897945c18d",
                name: "VODACOM",
                group: "MOMO",
            },
            MOMO_AZAMPESA: {
                kind: "MOMO_AZAMPESA+267eb36e-b572-4d82-a412-b650d894b313",
                name: "AZAMPESA",
                group: "MOMO",
            },
            MOMO_HALOPESA: {
                kind: "MOMO_HALOPESA+6de725c9-254e-4e89-a6d5-7f83501c23e9",
                name: "HALOPESA",
                group: "MOMO",
            },
        },
        xaf: {
            MOMO_WALLET: {
                kind: "MOMO_Mobile Wallet+cc2883ed-e431-444d-9264-8b7c1684b998",
                name: "Mobile Wallet",
                group: "MOMO",
            }
        },
        ngn: {
            "BANK_Standard Chartered Bank": {
                kind: "BANK_Standard Chartered Bank+e6c5c835-894d-4bed-adf8-75ba766e87f9",
                name: "Standard Chartered Bank",
                group: "BANK",
            },
            "BANK_Citibank Nigeria": {
                kind: "BANK_Citibank Nigeria+8a1234a7-b530-49fd-b795-7d29972f3e36",
                name: "Citibank Nigeria",
                group: "BANK",
            }, "BANK_Wema Bank": {
                kind: "BANK_Wema Bank+495b282b-9306-431f-a55f-47e4f298faa6",
                name: "Wema Bank",
                group: "BANK",
            },
            "BANK_Unity Bank": {
                kind: "BANK_Unity Bank+9454baf4-4255-436d-a800-b99ca64b0cbf",
                name: "Unity Bank",
                group: "BANK",
            },
            "BANK_United Bank for Africa": {
                kind: "BANK_United Bank for Africa+7b1cc629-10d8-439c-ba5a-3b79a0f4c22f",
                name: "United Bank for Africa",
                group: "BANK",
            },
            "BANK_Access Bank (Diamond)": {
                kind: "BANK_Access Bank (Diamond)+434c590a-9e25-4235-b7e9-cf5c98d6035f",
                name: "Access Bank (Diamond)",
                group: "BANK",
            },
            "BANK_Union Bank of Nigeria": {
                kind: "BANK_Union Bank of Nigeria+51868f2b-07ce-49c7-a0c6-7a3f6056c5a2",
                name: "Union Bank of Nigeria",
                group: "BANK",
            },
            "BANK_Ecobank Nigeria": {
                kind: "BANK_Ecobank Nigeria+3ee64551-8ca5-47ba-8ec9-5f6337227bdf",
                name: "Ecobank Nigeria",
                group: "BANK",
            },
            "BANK_Providus Bank": {
                kind: "BANK_Providus Bank+696adf1d-41ce-4538-beab-76205df10f2d",
                name: "Providus Bank",
                group: "BANK",
            },
            "BANK_Access Bank": {
                kind: "BANK_Access Bank+4e3c7a90-c6a2-4ce2-b484-dc8386bbdee0",
                name: "Access Bank",
                group: "BANK",
            },
            "BANK_Stanbic Ibtc Bank": {
                kind: "BANK_Stanbic Ibtc Bank+4a693036-b427-407d-b394-74694f67fcc4",
                name: "Stanbic Ibtc Bank",
                group: "BANK",
            },
            "BANK_Polaris Bank": {
                kind: "BANK_Polaris Bank+72058ce3-7642-41b6-a887-187c510f3604",
                name: "Polaris Bank",
                group: "BANK",
            },
            "BANK_Keystone Bank": {
                kind: "BANK_Keystone Bank+f01ab752-8ff4-4fd8-92c7-5f3f75c30d67",
                name: "Keystone Bank",
                group: "BANK",
            },
            "BANK_Fidelity Bank": {
                kind: "BANK_Fidelity Bank+552bf419-9e82-42a7-9ada-08fb47e07966",
                name: "Fidelity Bank",
                group: "BANK",
            },
            "BANK_Zenith Bank": {
                kind: "BANK_Zenith Bank+278f4a85-e5c2-49ac-882f-6887cdd5bb69",
                name: "Zenith Bank",
                group: "BANK",
            },
            "BANK_Heritage Bank": {
                kind: "BANK_Heritage Bank+6de45f63-34eb-4440-882c-7a3123cb2154",
                name: "Heritage Bank",
                group: "BANK",
            },
            "BANK_Enterprise Bank": {
                kind: "BANK_Enterprise Bank+d8388d03-a7b9-48fd-b2b5-e93ec6826f36",
                name: "Enterprise Bank",
                group: "BANK",
            },
            "BANK_Guaranty Trust Bank": {
                kind: "BANK_Guaranty Trust Bank+32d37e46-5ff4-44ca-b459-535eb250d220",
                name: "Guaranty Trust Bank",
                group: "BANK",
            },
            "BANK_GT Bank": {
                kind: "BANK_GT Bank+97413aea-5f83-4010-8248-caca3ca5b9dc",
                name: "GT Bank",
                group: "BANK",
            },
            "BANK_Paga": {
                kind: "BANK_Paga+e5d96690-40d3-48f4-a745-b9e74566edc4",
                name: "Paga",
                group: "BANK",
            },
            "BANK_Sterling Bank": {
                kind: "BANK_Sterling Bank+9e6648b4-cb2d-490d-b721-4920c35f36d5",
                name: "Sterling Bank",
                group: "BANK",
            },
            "BANK_Mainstreet Bank": {
                kind: "BANK_Mainstreet Bank+57153ec9-0ec7-4ec1-a3ed-28c13139a2d9",
                name: "Mainstreet Bank",
                group: "BANK",
            },
            "BANK_First City Monument Bank": {
                kind: "BANK_First City Monument Bank+bc45ba7f-858f-4352-b476-750015f09986",
                name: "First City Monument Bank",
                group: "BANK",
            },
            "BANK_First Bank of Nigeria": {
                kind: "BANK_First Bank of Nigeria+a3e89e00-87d8-4d2b-9dbc-be81d5d93db4",
                name: "First Bank of Nigeria",
                group: "BANK",
            }
        },
        ugx: {}
    }
}

const insertYellowcardAccount = async(tableName, fields) => {
    const { data: yellowcardAccountData, error: yellowcardAccountError } = await supabase.from(tableName).insert({
        account_number: fields.accountNumber,              // it will be filled as phone number if account number is empty
        account_holder_phone: fields.accountHolderPhone,        // it will be filled as NULL if account number is empty
        account_holder_name: fields.accountHolderName,
        bank_name: fields.bankName,
        kind: fields.kind,
        user_id: fields.userId
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
    insertYellowcardAccount,
    yellowcardNetworkToChain,
    yellowcardPhoneNumberFormatPatternMap,
    yellowcardAccountNumberFormatPatternMap,
    yellowcardSupportedKindsMap,
    hifiOfframpTransactionStatusMap,
    yellowcardMethodFieldsMap,
    failedReasonMap,
    mapCloseReason
}