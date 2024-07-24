const erc20Transfer = (currency, recipientAddress, unitsAmount) => {
    if (currency == "usdc") {
        return [
			{ name: "to", value: recipientAddress },
			{ name: "value", value: unitsAmount }
		]
    }else{
        return [
			{ name: "to", value: recipientAddress },
			{ name: "amount", value: unitsAmount }
		]
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