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
        // console.log(req.headers)
        const token = req.headers['authorization'].split(' ')[1];

        // Verify the token
        jwt.verify(token, "this-is-a-webhook-secret", (err, decoded) => {
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
        const walletAddress = await getBastionWallet(userId, chain, "FEE_COLLECTION")
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
        const profileId = "3b8be475-1b32-4ff3-9384-b6699c139869"
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