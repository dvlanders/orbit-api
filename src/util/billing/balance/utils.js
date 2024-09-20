
const BalanceTopupType = {
    AUTOPAY : "AUTOPAY",
    CHECKOUT : "CHECKOUT",
    ACCOUNT_MINIMUM : "ACCOUNT_MINIMUM",
}

const BalanceTopupStatus = {
    PENDING : "PENDING",
    SUCCEEDED : "SUCCEEDED",
    FAILED : "FAILED",
    CANCELLED : "CANCELLED"
}

const generateHIFICreditId = () => {
    const timestamp = Date.now().toString(16);
    const randomPart = Math.floor(Math.random() * 1e8).toString(16);
    return `HIFI_cr_${timestamp}${randomPart}`;
  }

module.exports = {
    BalanceTopupType,
    BalanceTopupStatus,
    generateHIFICreditId
}