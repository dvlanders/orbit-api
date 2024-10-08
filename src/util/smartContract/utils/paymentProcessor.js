const paymentProcessorProcessPaymentFunction = (tokenContractAddress, destinationWalletAddress, feeWalletAddress, amount, fee) => {
    return {
        functionName: "processPayment(address,address,address,uint256,uint256)",
        params: [
            tokenContractAddress,
            destinationWalletAddress,
            feeWalletAddress,
            amount,
            fee
        ]
    }
}

module.exports = {
    paymentProcessorProcessPaymentFunction
}