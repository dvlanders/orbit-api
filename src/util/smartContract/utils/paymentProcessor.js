const paymentProcessorProcessPaymentFunction = (tokenContractAddress, destinationWalletAddress, feeWalletAddress, amount, fee, paymentProcessType) => {

    if (paymentProcessType == "EXACT_IN"){
        return {
            functionName: "processPaymentExactIn(address,address,address,uint256,uint256)",
        params: [
            tokenContractAddress,
            destinationWalletAddress,
            feeWalletAddress,
            amount,
            fee
            ]
        }
    }else if (paymentProcessType == "EXACT_OUT"){
        return {
            functionName: "processPaymentExactOut(address,address,address,uint256,uint256,address)",
            params: [
                tokenContractAddress,
                destinationWalletAddress,
                feeWalletAddress,
                amount,
                fee
            ]
        }
    }
}

module.exports = {
    paymentProcessorProcessPaymentFunction
}