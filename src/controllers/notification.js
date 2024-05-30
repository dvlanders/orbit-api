const supabase = require('../util/supabaseClient');
const FormData = require('form-data');
const fetch = require('node-fetch');

// when requester create request
exports.sendRequestCreateEmail = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { onchainRequestId } = req.body;
	if (!onchainRequestId) {
		return res.status(400).json({ error: 'onchainRequestId is required' });
	}

	try {
        // get record
		const { data: requestData, error: RequestError } = await supabase
            .from('onchain_requests')
            .select(`*, from_merchant:requester_merchant_id (*,profiles (*))`)
			.eq('id', onchainRequestId)
			.maybeSingle();

        console.log(requestData)
        
        
        if (RequestError) throw RequestError
        if (!requestData) return res.status(404).json({ error: 'No transaction data found for the given request ID' });

		let fromName = requestData.from_merchant.business_name || requestData.from_merchant.profiles[0].full_name || requestData.from_merchant.profiles.email
		const usdAmount = requestData.amount

		const form = new FormData();
		form.append('from', `HIFI Notifications <noreply@${process.env.MAILGUN_DOMAIN}>`);
		form.append('to', requestData.requestee_email);
		form.append('template', 'onchain_request_create_template');
		form.append('v:request_id', `${requestData.id}`);
		form.append('v:from_name', `${fromName}`);
		form.append('v:usd_amount', `${usdAmount.toFixed(2)}`);

		const authHeader = 'Basic ' + Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64');
		const response = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
			method: 'POST',
			headers: {
				'Authorization': authHeader
			},
			body: form
		});

		if (!response.ok) {
			const textResponse = await response.text();
			console.error('Failed to send email:', textResponse);
			return res.status(500).json({ error: 'Failed to send email, server responded with: ' + textResponse });
		}

		const responseData = await response.json();
		return res.json(responseData);
	} catch (error) {
		console.error('An error occurred:', error);
		return res.status(500).json({ error: error.message });
	}
};


exports.sendTransactionConfirmationEmail = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { requestId } = req.body;
	if (!requestId) {
		return res.status(400).json({ error: 'requestId is required' });
	}

	try {
		const { data: transactionData, error: transactionError } = await supabase
			.from('onchain_transactions')
			.select(`*, from_merchant:from_merchant_id (*,profiles (*))`)
			.eq('request_id', requestId)
			.single();

		if (transactionError || !transactionData) {
			return res.status(404).json({ error: 'No transaction data found for the given request ID' });
		}

		console.log('transactionData', transactionData);
		let fromName;

		if (transactionData.from_merchant.business_name === '') {
			const { data: profileData, error: profileError } = await supabase
				.from('profiles')
				.select(`*`)
				.eq('merchant_id', transactionData.from_merchant_id);

			console.log('profileData', profileData)

			if (profileError || !profileData[0] || profileData.length === 0) {
				console.error('No profile data found for the "from" merchant id ');
				return res.status(404).json({ error: 'No profile data found for the associated merchant id' });
			}

			// console.log('profileData', profileData);
			fromName = profileData[0].full_name;
		} else {
			fromName = transactionData.from_merchant.business_name;
		}

		const usdAmount = transactionData.amount / 1e6;

		const form = new FormData();
		form.append('from', `HIFI Notifications <noreply@${process.env.MAILGUN_DOMAIN}>`);
		form.append('to', transactionData.destination_email);
		form.append('template', 'onchain_transaction_confirmation_template');
		form.append('v:transaction_id', `${transactionData.request_id}`);
		form.append('v:from_name', `${fromName}`);
		form.append('v:usd_amount', `${usdAmount.toFixed(2)}`);

		const authHeader = 'Basic ' + Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64');
		const response = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
			method: 'POST',
			headers: {
				'Authorization': authHeader
			},
			body: form
		});

		if (!response.ok) {
			const textResponse = await response.text();
			console.error('Failed to send email:', textResponse);
			return res.status(500).json({ error: 'Failed to send email, server responded with: ' + textResponse });
		}

		const responseData = await response.json();
		return res.json(responseData);
	} catch (error) {
		console.error('An error occurred:', error);
		return res.status(500).json({ error: error.message });
	}
};