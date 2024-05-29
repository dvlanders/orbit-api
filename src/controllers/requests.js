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

		let fromName = requestData.from_merchant.business_name || requestData.from_merchant.profiles.full_name || requestData.from_merchant.profiles.email
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




