const erc20ApproveWithFunctionName = (currency, spender, unitsAmount) => {
    if (currency == "usdc" || currency == "usdt") {
        return {
            functionName: "approve(address,uint256)",
            params: [
                spender,
                unitsAmount
            ]
        }
    }else {
        return {
            functionName: "approve(address,uint256)",
            params: [
                spender,
                unitsAmount
            ]
        }
    }
}

module.exports = {
    erc20ApproveWithFunctionName
}
