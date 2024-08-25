const erc20Transfer = (currency, chain, recipientAddress, unitsAmount) => {
    if (currency == "usdc") {
        return [
			{ name: "to", value: recipientAddress },
			{ name: "value", value: unitsAmount }
		]
    }else if (currency == "usdt"){
        if (chain == "POLYGON_MAINNET"){
            return [
                { name: "recipient", value: recipientAddress },
                { name: "amount", value: unitsAmount }
            ]
        }else if (chain == "ETHEREUM_MAINNET"){
            return [
                { name: "_to", value: recipientAddress },
                { name: "_value", value: unitsAmount }
            ]
        }
    }
}

const erc20Approve = (currency, spender, unitsAmount) => {
    if (currency == "usdc") {
        return [
			{ name: "spender", value: spender },
			{ name: "value", value: unitsAmount }
		]
    }else{
        return [
			{ name: "spender", value: spender },
			{ name: "amount", value: unitsAmount }
		]
    }
}

module.exports = {
    erc20Transfer,
    erc20Approve
}