const { v4: uuidv4 } = require('uuid');
const { logger } = require('../util/logger/logger');

const Web3 = require('web3');

// Assuming you're using Infura; replace with your actual provider URL
const provider = 'https://polygon-mumbai.infura.io/v3/f2fe89874d5841f7a39f26b291ee8873';

const web3 = new Web3(provider);

// contract ABI and smart contract address
const contractData = require('../config/ocppMumbaiTestnetABI.json');
const contractAddress = '0xe810B03C6a930A3A04F93a1Eb5B77Fa958522c98'; // mumbai testnet ocppp contract address
const contractABI = JSON.parse(contractData.result);

const operatorAddress = '0x3942708dc00F350483695e4C0e57f910280588E4'; // sam operator wallet on metamask

exports.registerOperator = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { chain, paymentAsset, requestId } = req.body;
	console.log('req.body', req.body);

	// Validate the input
	if (!chain || !paymentAsset || !requestId) {
		return res.status(400).json({ error: 'Missing required fields' });
	}

	console.log('requestId is: ', requestId);

	// Set up the contract
	const contract = new web3.eth.Contract(contractABI, contractAddress);

	try {
		const account = web3.eth.accounts.privateKeyToAccount('2999546a0bad20679f0a658ecb3d12adbdc0c3d95abea845a297a91da75226e6'); // sam operator wallet on metamask
		web3.eth.accounts.wallet.add(account);

		// Estimate gas for the transaction
		const gasEstimate = await contract.methods.registerOperator().estimateGas({ from: operatorAddress });

		// Send the transaction
		const tx = await contract.methods.registerOperator().send({
			from: operatorAddress,
			gas: gasEstimate
		});

		console.log('Transaction:', tx);
		return res.status(200).json({ message: 'Operator registered successfully', transaction: tx });
	} catch (error) {
		logger.error(`Error registering operator: ${error}`);
		return res.status(500).json({ error: 'Failed to register operator' });
	}
}


exports.createSwapAndTransferUniswapV3Native = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	// Extract required fields from the request body
	const { amountMatic, signedTransaction, recipientAddress } = req.body;

	if (!amountMatic || !signedTransaction || !recipientAddress) {
		return res.status(400).json({ error: 'Missing required fields' });
	}

	try {
		// Assuming we have the USDC contract address for Mumbai testnet
		const usdcAddress = 'USDC_CONTRACT_ADDRESS_HERE'; // Replace with actual USDC testnet contract address

		// Set up the contract
		const contract = new web3.eth.Contract(contractABI, contractAddress);

		// Specify the swap details
		const swapDetails = {
			recipient: recipientAddress,
			amountIn: web3.utils.toWei(amountMatic, 'ether'), // Convert MATIC amount to Wei
			amountOutMin: '0', // Specify minimum amount of USDC expected to prevent slippage
			path: [web3.utils.toChecksumAddress('NATIVE_MATIC_ADDRESS'), web3.utils.toChecksumAddress(usdcAddress)], // Path from MATIC to USDC
			deadline: Math.floor(Date.now() / 1000) + 60 * 20, // Transaction deadline (20 minutes from now)
		};

		// Estimate gas for the swap transaction
		const gasEstimate = await contract.methods.swapAndTransferUniswapV3Native(swapDetails).estimateGas();

		// Execute the swap transaction using the signed transaction data
		const tx = await web3.eth.sendSignedTransaction(signedTransaction);

		console.log('Transaction:', tx);
		return res.status(200).json({ message: 'Swap and transfer executed successfully', transaction: tx });
	} catch (error) {
		console.error(`Error executing swap and transfer: ${error}`);
		return res.status(500).json({ error: 'Failed to execute swap and transfer' });
	}
};