const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const { v4: uuidv4 } = require("uuid");
const { request } = require('express');
const fundMaticPolygon = require('../util/bastion/fundMaticPolygon');
const { bastion } = require('.');
const createUser = require('../util/bastion/endpoints/createUser');


exports.getPing = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	return res.status(200).json({ message: 'pong' });
};

exports.createHifiUser = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	console.log('got here');


	const { userId } = req.body;


	if (!userId) {
		return res.status(400).json({ error: 'userId is required' });
	}

	// create bastion user (comes with wallets)
	try {
		createUser(userId)
	} catch (error) {
		res.status(500).json({
			error: `${JSON.stringify(error)}`
		});
	}

	// create checkbook user

	// create bridge Customer via customers api

	// bridge virtual account

	try {
		const data = await createUserCore(merchantId);
		res.status(201).json(data);
	} catch (error) {
		logger.error(`Something went wrong while creating user: ${error.toString()}`);
		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error.toString(),
				merchant_id: merchantId,
				endpoint: '/bastion/createUser'
			})
		res.status(500).json({ error: `Something went wrong: ${error}` });
	}
};
