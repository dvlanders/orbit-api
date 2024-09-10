const { v4 } = require("uuid");
const { submitUserAction } = require("../../bastion/endpoints/submitUserAction");
const { USDHIFIContractAddressMap } = require("./utils");



const gasStation = '4fb4ef7b-5576-431b-8d88-ad0b962be1df'

const burnUSDHIFI = async (walletAddress, amount, chain, requestId) => {
    const contractAddress = USDHIFIContractAddressMap[chain];
    const unitsAmount = amount * Math.pow(10, 6)
    
    //  function call to Bastion
    const bodyObject = {
        requestId: requestId,
        userId: gasStation, 
        contractAddress: contractAddress,
        actionName: "ownerBurnOnBehalfUser",
        chain: chain,
        actionParams: [
            { name: "onBehalf", value: walletAddress },
            { name: "amount", value: unitsAmount }
        ]
    };

    const response = await submitUserAction(bodyObject)
    return response
}

module.exports = {
    burnUSDHIFI
}