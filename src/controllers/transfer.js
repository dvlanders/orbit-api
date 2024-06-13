const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const { fieldsValidation } = require("../util/common/fieldsValidation");
const createAndFundBastionUser = require('../util/bastion/fundMaticPolygon');
const createLog = require('../util/logger/supabaseLogger');
const { createBridgeExternalAccount } = require('../util/bridge/endpoint/createBridgeExternalAccount')
const { createCheckbookBankAccount } = require('../util/checkbook/endpoint/createCheckbookBankAccount')
const { getBridgeExternalAccount } = require('../util/bridge/endpoint/getBridgeExternalAccount');
const { supabaseCall } = require('../util/supabaseWithRetry');
const { v4 } = require('uuid');


// exports.transferUsdFromWalletToBankAccount = async (req, res) => {
// 	if (req.method !== 'POST') {
// 		return res.status(405).json({ error: 'Method not allowed' });
// 	}
// 	const { userId, destinationAccountId } = req.body;

// 	// Validate the request body

// 	// get the external account record

// 	//

// 	return res.status(status).json(createUsdOnrampSourceWithPlaidResponse);

// }
