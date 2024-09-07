const { v4 } = require("uuid");
const { submitUserAction } = require("../../bastion/endpoints/submitUserAction");
const { USDHIFIContractAddressMap } = require("./utils");


const gasStation = '4fb4ef7b-5576-431b-8d88-ad0b962be1df'


const transferUSDHIFI = async (fromWalletAddress, toWalletAddress, amount, chain, requestId) => {
    const contractAddress = USDHIFIContractAddressMap[chain];
    const unitsAmount = amount * Math.pow(10, 6)
    
    //  function call to Bastion
    const bodyObject = {
        requestId: requestId,
        userId: gasStation,
        contractAddress: contractAddress,
        actionName: "ownerTransferOnBehalfUser",
        chain: chain,
        actionParams: [
            { name: "onBehalf", value: fromWalletAddress },
            { name: "to", value: toWalletAddress },
            { name: "amount", value: unitsAmount }
        ]
    };

    const response = await submitUserAction(bodyObject)
    const responseData = await response.json()
    console.log(responseData)
    return response
}  

module.exports = {
    transferUSDHIFI
}
