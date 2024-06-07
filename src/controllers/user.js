const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const { v4: uuidv4 } = require("uuid");
const { request } = require('express');
const fundMaticPolygon = require('../util/bastion/fundMaticPolygon');
const { bastion } = require('.');
const createUser = require('../util/bastion/endpoints/createUser');
const createLog = require('../util/logger/supabaseLogger');


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
	createLog('source here', userId, 'log here', 'response here');

	// create bastion user (comes with wallets)
	// try {
	// 	createUser(userId)
	// } catch (error) {
	// 	res.status(500).json({
	// 		error: `${JSON.stringify(error)}`
	// 	});
	// }

	// create checkbook user

	// create bridge Customer via customers api

	// bridge virtual account

	return res.status(200).json({ message: 'user created' });
};
