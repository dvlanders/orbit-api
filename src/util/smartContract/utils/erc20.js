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

const erc20TransferWithFunctionName = (currency, destinationAddress, unitsAmount) => {
    if (currency == "usdc" || currency == "usdt") {
        return {
            functionName: "transfer(address,uint256)",
            params: [
                destinationAddress,
                unitsAmount
            ]
        }
    }else {
        return {
            functionName: "transfer(address,uint256)",
            params: [
                destinationAddress,
                unitsAmount
            ]
        }
    }
}

module.exports = {
    erc20ApproveWithFunctionName,
    erc20TransferWithFunctionName
}
