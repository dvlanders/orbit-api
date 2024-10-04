const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const notifyTransaction = require("../../src/util/logger/transactionNotifier");
const { rampTypes } = require("../../src/util/transfer/utils/ramptType");


const notifyOnrampTransactions = async () => {
    let now = new Date();
    now.setSeconds(now.getSeconds() - 10);

    const { data: onrampTrasactionData, error: onrampTransactionError } = await supabase
        .from("onramp_transactions")
        .select("*")
        .or("status.eq.REFUNDED, status.eq.FAILED")
        .gt("updated_at", now.toISOString())
        .order("updated_at", { ascending: true });
    
    if (onrampTransactionError) {
        await createLog("pollHifiTransactionStatus/notifyOnrampTransactions", null, onrampTransactionError.message, onrampTransactionError);
        return;
    }

    await Promise.all(
        onrampTrasactionData.map(async (transaction) => {
            notifyTransaction(
                transaction.user_id,
                rampTypes.ONRAMP,
                transaction.id,
                {
                    transactionStatus: transaction.status,
                    checkbookStatus: transaction.checkbook_status,
                    bridgeStatus: transaction.bridge_status,
                    failedReason: transaction.failed_reason,
                }
            );
        })
    );
};

const notifyOfframpTransactions = async () => {
    let now = new Date();
    now.setSeconds(now.getSeconds() - 10);

    const { data: offrampTransactionData, error: offrampTransactionError } =
        await supabase
            .from("offramp_transactions")
            .select("*")
            .or(
                "transaction_status.eq.NOT_INITIATED, transaction_status.eq.FAILED_ONCHAIN, transaction_status.eq.FAILED_FIAT_RETURNED, transaction_status.eq.FAILED_FIAT_REFUNDED, transaction_status.eq.FAILED_UNKNOWN"
            )
            .neq("bridge_transaction_status", "canceled")
            .gt("updated_at", now.toISOString())
            .order("updated_at", { ascending: true });

    if (offrampTransactionError) {
        await createLog("pollHifiTransactionStatus/notifyOfframpTransactions", null, offrampTransactionError.message, offrampTransactionError);
        return;
    }

    await Promise.all(
        offrampTransactionData.map(async (transaction) => {
            notifyTransaction(
                transaction.user_id,
                rampTypes.OFFRAMP,
                transaction.id,
                {
                    transactionStatus: transaction.transaction_status,
                    bastionTransactionStatus:
                        transaction.bastion_transaction_status,
                    bridgeTransactionStatus:
                        transaction.bridge_transaction_status,
                    circleStatus: transaction.circle_status,
                    blindpayPayroutStatus: transaction.blindpay_payout_status,
                    reapPaymentStatus: transaction.reap_payment_status,
                    failedReason: transaction.failed_reason,
                }
            );
        })
    );
};

const notifyCryptoToCryptoTransactions = async () => {
    let now = new Date();
    now.setSeconds(now.getSeconds() - 10);

    const { data: cryptoToCryptoTransactionData, error: cryptoToCryptoTransactionDataError } =
    await supabase
        .from("crypto_to_crypto")
        .select("*")
        .or("status.eq.NOT_INITIATED, status.eq.FAILED")
        .gt("updated_at", now.toISOString())
        .order("updated_at", { ascending: true });
    
    if (cryptoToCryptoTransactionDataError) {
        await createLog("pollHifiTransactionStatus/notifyCryptoToCryptoTransactions", null, offrampTransactionError.message, offrampTransactionError);
        return;
    }

    await Promise.all(
        cryptoToCryptoTransactionData.map(async (transaction) => {
            notifyTransaction(
                transaction.sender_user_id,
                rampTypes.CRYPTOTOCRYPTO,
                transaction.id,
                {
                    transactionStatus: transaction.status,
                    failedReason: transaction.failed_reason,
                }
            );
        })
    );
}

const pollHifiTrnsactionStatusNotification = async () => {
    await Promise.all([
        notifyOnrampTransactions(),
        notifyOfframpTransactions(),
        notifyCryptoToCryptoTransactions(),
    ]);
};

module.exports = pollHifiTrnsactionStatusNotification;
