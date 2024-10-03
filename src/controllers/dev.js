const { v4 } = require("uuid");
const createJob = require("../../asyncJobs/createJob");
const {sendMessage} = require("../../webhooks/sendWebhookMessage");
const { submitUserAction } = require("../util/bastion/endpoints/submitUserAction");
const { Chain, currencyContractAddress } = require("../util/common/blockchain");
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../util/smartContract/approve/approveTokenBastion");
const supabase = require("../util/supabaseClient");
const jwt = require("jsonwebtoken");
const { erc20Approve } = require("../util/bastion/utils/erc20FunctionMap");
const { chargeFeeOnFundReceivedBastion } = require("../util/transfer/fiatToCrypto/transfer/chargeFeeOnFundReceived");
const { createStripeBill } = require("../util/billing/createBill");
const tutorialCheckList = require("../util/dashboard/tutorialCheckList");
const createLog = require("../util/logger/supabaseLogger");
const notifyCryptoToFiatTransfer = require("../../webhooks/transfer/notifyCryptoToFiatTransfer");
const notifyFiatToCryptoTransfer = require("../../webhooks/transfer/notifyFiatToCryptoTransfer");
const bridgeRailCheck = require("../util/transfer/cryptoToBankAccount/railCheck/bridgeRailCheckV2");
const { checkIsCryptoToFiatRequestIdAlreadyUsed } = require("../util/transfer/cryptoToBankAccount/utils/fetchRequestInformation");
const { getBastionWallet } = require("../util/bastion/utils/getBastionWallet");
const { regsiterFeeWallet } = require("../util/smartContract/registerWallet/registerFeeWallet");
const { isFeeWalletRegistered } = require("../util/smartContract/registerWallet/checkFeeWalletIsRegistered");
const supabaseSandbox = require("../util/sandboxSupabaseClient");
const { virtualAccountPaymentRailToChain } = require("../util/bridge/utils");
const getUserReapWalletAddress = require("../util/reap/main/getUserWallet");
const { mintUSDHIFI } = require("../util/smartContract/sandboxUSDHIFI/mint");
const { burnUSDHIFI } = require("../util/smartContract/sandboxUSDHIFI/burn");
const { transferUSDHIFI } = require("../util/smartContract/sandboxUSDHIFI/transfer");
const { toUnitsString } = require("../util/transfer/cryptoToCrypto/utils/toUnits");
const { approveToTokenMessenger } = require("../util/smartContract/cctp/approve");
const { burnUsdc } = require("../util/smartContract/cctp/burn");
const { fetchAttestation } = require("../util/smartContract/cctp/fetchAttestation");
const { receiveMessageAndMint } = require("../util/smartContract/cctp/receiveMessageAndMint");
const { createTransactionFeeRecord } = require("../util/billing/fee/transactionFeeBilling");
const stripe = require('stripe')(process.env.STRIPE_SK_KEY);

const uploadFile = async (file, path) => {
    
    const { data, error } = await supabase
        .storage
        .from('compliance_id')
        .upload(path, file.buffer, {
            contentType: file.mimetype
        });

    if (error) {
        throw error;
    }

    return data.path;
};

exports.testFileUpload = async(req, res) => {
 if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
    }

    try{
    const files = req.files;
    const { user_id } = req.body

    if (!user_id) {
        return res.status(400).json({ error: 'user_id is required.' });
    }

    if (!files['front'] || !files['back']) {
        return res.status(400).json({ error: 'Both front and back files are required.' });
    }

    const paths = {}

    await Promise.all(Object.keys(files).map(async(key) => {
        if (files[key] && files[key].length > 0){
            console.log(`upload ${key}`)
            paths[key] =  await uploadFile(files[key][0], `${user_id}/front`);
        }
    }))


    res.status(200).json({
        message: 'Files uploaded to Supabase successfully',
        files: paths
    });
    }catch (error){
        res.status(500).json({ error: 'Failed to upload files', details: error.message });
    }

}

exports.privateRoute = async(req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    
    return res.status(200).json({message: "ha"})
}

exports.testwebhook = async(req, res) => {
    if (req.method !== "POST"){
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        // return res.status(500).json({message: "test failed"})
        console.log("received")
        const token = req.headers['authorization'].split(' ')[1];
        const public_key = process.env.INTERNAL_WEBHOOK_PUBLICKEY
        if (!public_key) return res.status(500).json({message: "No public token found"})
        // Verify the token
        jwt.verify(token, public_key.replace(/\\n/g, '\n'), { algorithms: ['RS256'] },(err, decoded) => {
            if (err) {
                console.error('Failed to verify token:', err.message);
                throw new Error("wrong token")
            } else {
                console.log('Token is valid. Decoded payload:', decoded);
            }
        });
        return res.status(200).json({message: "Success"})
    }catch (error){
        return res.status(401).json({message: "Wrong token"})
    }
}

exports.testSendMessage = async(req, res) => {
    try{
        const now = new Date()
        const profileId = "e37f17be-1369-4853-8026-65e9903bd430"
        const message = {
            "data": {
              "transferType": "FIAT_TO_CRYPTO",
              "transferDetails": {
                "id": "d2bab9bf-4d77-42dc-9802-0e21613155da",
                "fee": null,
                "chain": "POLYGON_MAINNET",
                "amount": 1,
                "status": "FIAT_CONFIRMED",
                "createdAt": "2024-09-08T20:28:13.382987+00:00",
                "requestId": "0fb5e0c2-aa64-4606-9ae0-ffa15714543b",
                "updatedAt": "2024-09-13T12:45:01.081+00:00",
                "sourceUser": {
                  "businessName": null,
                  "legalLastName": "YANG",
                  "legalFirstName": "William",
                  "complianceEmail": "william@hifibridge.com"
                },
                "sourceUserId": "75d7c01f-5f93-4490-8b93-a62fd8020358",
                "sourceAccount": {
                  "id": "0de2ae79-737d-4266-8c7d-ec82df476d3a",
                  "bankName": "Bank of America",
                  "accountNumber": "7874",
                  "routingNumber": "021000322"
                },
                "sourceCurrency": "usd",
                "destinationUser": {
                  "businessName": null,
                  "legalLastName": "YANG",
                  "legalFirstName": "William",
                  "complianceEmail": "william@hifibridge.com"
                },
                "sourceAccountId": "0de2ae79-737d-4266-8c7d-ec82df476d3a",
                "transactionHash": null,
                "destinationUserId": "75d7c01f-5f93-4490-8b93-a62fd8020358",
                "destinationCurrency": "usdc"
              }
            },
            "eventId": "3d1f5348-2339-45f4-b339-4947e45e6f72",
            "eventType": "TRANSFER.FIAT_TO_CRYPTO",
            "timestamp": "2024-09-13T12:45:01.901Z",
            "eventAction": "UPDATE"
          }
        await sendMessage(profileId, message, "3d1f5348-2339-45f4-b339-4947e45e6f72")
        return res.status(200).json({message: "success"})
    }catch (error){
        console.error(error)
        return res.status(500).json({error: "error"})
    }
}

exports.testCreateJob = async(req, res) => {
    if (req.method !== "POST"){
        return res.status(405).json({ error: 'Method not allowed' });
    }

    await createJob("testJob", {userid: "123", amount: "123"}, undefined, undefined)

    return res.status(200).json({message: "success"})

}

exports.testApproveAsset = async(req, res) => {
    if (req.method !== "POST"){
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try{
        const userId = "75d7c01f-5f93-4490-8b93-a62fd8020358"
        const currencyContract = currencyContractAddress.POLYGON_MAINNET.usdc
        // await approveMaxTokenToPaymentProcessor(userId, Chain.POLYGON_MAINNET, "usdc")
        const paymentProcessorContract = paymentProcessorContractMap.production.POLYGON_MAINNET
        const bodyObject = {
            requestId: v4(),
            userId: userId,
            contractAddress: currencyContract,
            actionName: "approve",
            chain: Chain.POLYGON_MAINNET,
            actionParams: erc20Approve("usdc", paymentProcessorContract, 0)
        };
    
        const response = await submitUserAction(bodyObject)
        const responseBody = await response.json()
        return res.status(200).json(responseBody)
    }catch(error){
        console.error(error)
        return res.status(500).json({message: "Internal server error"})
    }
}

exports.registerFeeWallet = async(req, res) => {
    if (req.method !== "POST"){
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try{
        const chain = Chain.POLYGON_MAINNET
        const userId = "80fdf48c-42b2-4bf8-b4a9-d00817bae912"
        const {walletAddress} = await getBastionWallet(userId, chain, "FEE_COLLECTION")
        await regsiterFeeWallet(userId, walletAddress, chain)
        return res.status(200).json({message: "success"})
    }catch(error){
        console.error(error)
        return res.status(500).json({message: "Internal server error"})
    }
}

exports.triggerOnRampFeeCharge = async(req, res) => {
    try{
        await chargeFeeOnFundReceivedBastion("ae1a8634-4c7c-4c7c-b3f1-c090411340b1")
        return res.status(200).json({message: "ok"})
    }catch (error){
        console.error(error)
        return res.status(500).json({error: "Internal server error"})
    }
}

exports.testCreateBill = async(req, res) => {
    try{
        const profileId = "e37f17be-1369-4853-8026-65e9903bd430"
        const {data: billingInformation, error: billingInformationError} = await supabase
            .from("billing_information")
            .select("*")
            .eq("profile_id", profileId)
            .single()
        
        await createStripeBill(billingInformation)
        return res.status(200).json({message: "success"})
    }catch (error){
        return res.status(500).json({error: "Internal server error"})

    }
}

exports.testStripeWebwook = async(req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: 'Method not allowed' });
    try{
        let event
        // Only verify the event if you have an endpoint secret defined.
        // Otherwise use the basic event deserialized with JSON.parse
        const endpointSecret = "whsec_7dd400d1ec3938f7e2b30882db39edbdac84d978df9137f6595a4f1576a4bfae"
        const signature = req.headers['stripe-signature'];

        try {
            event = stripe.webhooks.constructEvent(
                req.body,
                signature,
                endpointSecret
            );
        } catch (err) {
            console.log(`⚠️  Webhook signature verification failed.`, err.message);
            return res.status(400).json({error: "Failed to verify"})
        }

        if (event.type == "invoice.paid"){
            console.log(`Invoice Id: ${event.data.object.id}, isPaid: ${event.data.object.paid}`)
        }
        return res.status(200).json({status: "OK"})
    }catch(error){
        console.error(error)
        return res.status(500).json({error: "Internal server error"})
    }


}

exports.testCheckList = async (req, res) => {
    try{
        const profileId = "3b8be475-1b32-4ff3-9384-b6699c139869"
        const defaultCheckList = {
            sandboxKeyCreated: false,
            userCreated: false,
            BankAccountAdded: false,
            transfered: false,
        }
        const newCheckList = await tutorialCheckList(profileId, defaultCheckList)
        return res.status(200).json(newCheckList)
    }catch (error){
        return res.status(500).json({error: error.message})
    }
}

exports.testDevLogging = async (req, res) => {
    try{
        await createLog("test", null, "test", {error: "test"}, "3b8be475-1b32-4ff3-9384-b6699c139869")
        return res.status(200).json({message: "success"})
    }catch(error){
        console.error(error)
        return res.status(500).json({error: "Internal server error"})
    }
}

exports.testIp = async(req, res) => {
    const ip = "192.168.0.1"
    const locationRes = await fetch(`https://ipapi.co/${ip}/json/?key=${process.env.IP_API_SECRET}`);
	const locaionData = await locationRes.json();

    return res.status(200).json(locaionData)
}

exports.testNotifyCryptoToFiat = async(req, res) => {
    try{
        const {data, error} = await supabase
        .from("onramp_transactions")
        .select("*")
        .eq("id", "b78dc7ee-f20f-4321-a14f-b48d624505f2")
        .single()
        if (error) throw error
        await notifyFiatToCryptoTransfer(data)
        return res.status(200).json({message: "success"})
    }catch(error){
        console.log(error)
        return res.status(500).json({message: "failed"})
    }
}

exports.testCheckFeeWalletRegistered = async(req, res) => {
    try{
        const isRegistered = await isFeeWalletRegistered(Chain.POLYGON_MAINNET, "0x9Bf9Bd42Eb098C3fB74F37d2A3BA8141B5785a5f")
        return res.status(200).json(isRegistered)
    }catch (error){
        console.error(error)
        return res.status(500).json({error: "error"})
    }
}

exports.testBastionUserTable = async(req, res) => {
    try{
        const {data, error: usersError} = await supabase
            .from("users")
            .select("id, created_at, user_type, user_kyc (legal_first_name, legal_last_name, date_of_birth, compliance_email, compliance_phone, business_name), bridge_customers (status), bastion_users (kyc_passed, jurisdiction_check_passed), bastion_wallets (address, chain)")
            .eq("profile_id", "3b8be475-1b32-4ff3-9384-b6699c139869")
            .eq("is_developer", false)
            .not("user_kyc", "is", null)
            .order("created_at", {ascending: false})
            .limit(1)
        return res.status(200).json({data, usersError})
    }catch (error){
        console.error(error)
        return res.status(500).json({error: "error"})
    }
}

exports.testGetVirtualAccountAmount = async(req, res) => {
    try{

        const profileId = "3b8be475-1b32-4ff3-9384-b6699c139869"
        const {count, error} = await supabase
            .from("bridge_virtual_accounts")
            .select("*, users!inner(profile_id)", {count: 'exact', head: true})
            .eq("users.profile_id", profileId)
            .gt("last_activity_time", "2024-08-21")
            .lt("last_activity_time", "2024-08-30")
        
        if (error) throw error
        return res.status(200).json({count: count})
    }catch (error){
        console.error(error)
        return res.status(500).json({error: "error"})
    }

}

exports.testReapAccount = async(req, res) => {
    try{
        // const responseBody = await getUserReapWalletAddress("", process.env.REAP_API_KEY, process.env.REAP_BUSINESS_UUID)
        const requestBody = {
            "receivingParty": {
                "type": "company",
                "name": {
                    "name": "HK testing company"
                },
                "accounts": [
                    {
                        "type": "bank",
                        "identifier": {
                            "standard": "fps_id",
                            "value": "8882312"
                        },
                        "network": "FPS",
                        "currencies": [
                            "HKD"
                        ],
                        "provider": {
                            "name": "HSBC HK",
                            "country": "HK",
                            "networkIdentifier": "004"
                        },
                        "addresses": [
                            {
                                "type": "postal",
                                "street": "Flat A, 2/F, Beauty Avenue",
                                "city": "Quarry Bay",
                                "state": "HK Island",
                                "country": "HK",
                                "postalCode": "999077"
                            }
                        ]
                    }
                ]
            },
            "payment": {
                "receivingAmount": 200.007,
                "receivingCurrency": "HKD",
                "senderCurrency": "USDC",
                "description": "Test payment",
                "purposeOfPayment": "payment_for_goods"
            }
        }

        const url = `${process.env.REAP_URL}/payments`
        console.log(url)
        const headers = {
            "accept": "application/json",
            "content-type": "application/json;schema=PAAS",
            "x-reap-api-key": process.env.REAP_API_KEY,
            "x-reap-entity-id": process.env.REAP_BUSINESS_UUID
        }
        const options = {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody)
        }
        const response = await fetch(url, options)
        const responseBody = await response.json()
    
        return res.status(200).json(responseBody)

    }catch (error){
        console.error(error)
        return res.status(500).json({error: "error"})
    }
}

exports.testSelectOnEnum = async(req, res) => {
    try{
        const {data, error} = await supabase
            .from("bridge_customers")
            .select("*")
            .or("status.eq.active")
            .limit(10)
            
        return res.status(200).json({data, error})
    }catch (error){
        console.error(error)
        return res.status(500).json({error: "error"})
    }
}

exports.testBridgeUsdc = async(req, res) => {
    try{
        const userId = "adf65db6-38b7-4bc7-95aa-9c8e9c59481a"
        const sourceChain = Chain.ETHEREUM_TESTNET
        const destinationChain = Chain.POLYGON_AMOY
        const {walletAddress: sourceAddress, bastionUserId: sourceBastionUserId} = await getBastionWallet(userId, sourceChain)
        const {walletAddress: destinationAddress, bastionUserId: destinationBastionUserId} = await getBastionWallet(userId, destinationChain)
        
        const resultCircle = await fetchAttestation(sourceChain, "0xb04433f917b566034a3e9ec8d619b0e371f1df528a82bc8b72c49ca992cfd28a")
        const result = await receiveMessageAndMint(userId, destinationBastionUserId, destinationChain, resultCircle.messageBytes, resultCircle.attestationSignature, destinationAddress)

        return res.status(200).json(result)

    }catch (error){
        console.error(error)
        return res.status(500).json({error: "error"})
    }
}

exports.insertAllFeeRecords = async (req, res) => {


    try{
        // const {data: allTransactions, error: allTransactionsError} = await supabase
        //     .from("crypto_to_crypto")
        //     .select("*")
        //     .eq("status", "CONFIRMED");
        
        // if (allTransactionsError) throw allTransactionsError
        // console.log(allTransactions.length)
        // await Promise.all(allTransactions.map(async(transaction) => {
        //     await createTransactionFeeRecord(transaction.id, "CRYPTO_TO_CRYPTO")
        // }))

        return res.status(200).json({message: "success"})
    }catch (error){
        console.error(error)
        return res.status(500).json({error: "Internal server error"})
    }

}