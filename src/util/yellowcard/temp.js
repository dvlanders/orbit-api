

exports.createExchangeTransfer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const { userId } = req.body

	// look up the did record for a given sourceUserId
	const { data: didRecord, error: didRecordError } = await supabaseCall(() => supabase
		.from('tbd_decentralized_identifiers')
		.select('*')
		.eq('user_id', userId)
		.maybeSingle())

	if (didRecordError || !didRecord) {
		console.error('Error fetching DID record:', didRecordError);
		return res.status(500).json({ error: "An unexpected error occurred" });
	}

	// console.log('didRecord:', didRecord);

	const { DidDht, BearerDid } = await import('@web5/dids');
	const { VerifiableCredential, PresentationExchange } = await import('@web5/credentials');


	const payinCurrencyCode = 'USDC';
	const payoutCurrencyCode = 'KES';
	let matchedOfferings = [];

	const { TbdexHttpClient, Rfq, Quote, Order, OrderStatus, Close, Message } = await import('@tbdex/http-client');

	const ycDid = "did:dht:ho3axp5pgp4k8a7kqtb8knn5uaqwy9ghkm98wrytnh67bsn7ezry";
	const offerings = await TbdexHttpClient.getOfferings({ pfiDid: ycDid });

	if (offerings) {
		const filteredOfferings = offerings.filter(offering =>
			offering.data.payin.currencyCode === payinCurrencyCode &&
			offering.data.payout.currencyCode === payoutCurrencyCode
		);
		matchedOfferings.push(...filteredOfferings);
	}
	// const presentationDefinition = matchedOfferings[0].data.requiredClaims;

	// matchedOfferings.forEach(offering => {
	// 	console.log(JSON.stringify(offering, null, 2)); // `null` and `2` are for formatting purposes
	// });

	// loop through matched offerings where the offering.metada.id is == offering_01j60vgcygettvse30t5vxr6zt
	const selectedOffering = matchedOfferings.find(offering => offering.metadata.id === 'offering_01j60vgcygettvse30t5vxr6zt');

	// console.log('selectedOffering.data.requiredClaims:', JSON.stringify(selectedOffering.data.requiredClaims, null, 2));


	const presentationDefinition = selectedOffering.data.requiredClaims;

	// construct the metadata object
	const metadata = {
		to: selectedOffering.metadata.from,
		from: didRecord.did,
		protocol: '1.0'
	}


	let ycRfq

	try {

		// Select the credentials to be used for the exchange
		const selectedCredentials = PresentationExchange.selectCredentials({
			vcJwts: ["eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDpkaHQ6aG8zYXhwNXBncDRrOGE3a3F0Yjhrbm41dWFxd3k5Z2hrbTk4d3J5dG5oNjdic243ZXpyeSMwIn0.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vdzNpZC5vcmcvdmMvc3RhdHVzLWxpc3QvMjAyMS92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIl0sImlkIjoidXJuOnV1aWQ6YzMwZTYxOWItNGYyZC00OGY2LTkzMmQtMDlkNTRkODVmN2EyIiwiaXNzdWVyIjoiZGlkOmRodDpobzNheHA1cGdwNGs4YTdrcXRiOGtubjV1YXF3eTlnaGttOTh3cnl0bmg2N2JzbjdlenJ5IiwiaXNzdWFuY2VEYXRlIjoiMjAyNC0wOS0wNlQwNzo0ODowM1oiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6ImRpZDpkaHQ6b244bzNyZWFkNnRrMWZ1ZWFkamVlM3IxOGJhbmI1dGozazh4YXRrZmpxMWc2cjllemR0byJ9fSwibmJmIjoxNzI1NjA4ODgzLCJqdGkiOiJ1cm46dXVpZDpjMzBlNjE5Yi00ZjJkLTQ4ZjYtOTMyZC0wOWQ1NGQ4NWY3YTIiLCJpc3MiOiJkaWQ6ZGh0OmhvM2F4cDVwZ3A0azhhN2txdGI4a25uNXVhcXd5OWdoa205OHdyeXRuaDY3YnNuN2V6cnkiLCJzdWIiOiJkaWQ6ZGh0Om9uOG8zcmVhZDZ0azFmdWVhZGplZTNyMThiYW5iNXRqM2s4eGF0a2ZqcTFnNnI5ZXpkdG8iLCJpYXQiOjE3MjU2MDg4ODN9.Cm-_3-TMmfRZFCVs0Xdt-YYTVwyBeYuR644_Ly4Svj3S5JmlrNGM4tT30G1hZRQl7po0WNsUNmYOEgX5sEItDQ"], // array of JWTs after YC actually issues the credentials
			presentationDefinition: selectedOffering.data.requiredClaims
		});

		console.log('selectedCredentials:', selectedCredentials);

		// construct the data object
		const data = {
			offeringId: selectedOffering.metadata.id,
			payin: {
				kind: "USDC_LEDGER",
				amount: "10",
			},
			payout: {
				kind: 'MOMO_MPESA',
				paymentDetails: {
					accountNumber: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
					reason: 'Test payout',
					accountHolderName: 'Sam Yoon',

				}
			},
			claims: selectedCredentials
		};

		// create the rfq
		ycRfq = Rfq.create({
			metadata: metadata,
			data: data,
		});



	} catch (error) {
		console.error('Error creating RFQ:', error);
		return res.status(500).json({ error: error });
	}

	// console.log('rfq:', ycRfq);
	const bearerDid = await BearerDid.import({ portableDid: didRecord.portable_did });
	// console.log('rfq:', rfq);
	await ycRfq.sign(bearerDid);
	try {
		// create the exchange
		await TbdexHttpClient.createExchange(ycRfq);

	} catch (error) {
		console.error('Error creating exchange:', error);
		//log details
		console.error("error details:", error.details);

		return res.status(500).json({ error: error });
	}

	//poll for quote
	let quote;
	let close;
	let exchange;
	console.log("ycRfq.exchangeId", ycRfq.exchangeId);
	//Wait for Quote message to appear in the exchange
	while (!quote) {
		try {
			exchange = await TbdexHttpClient.getExchange({
				pfiDid: ycRfq.metadata.to,
				did: bearerDid,
				exchangeId: ycRfq.exchangeId
			});

		} catch (error) {
			console.error('Error during getExchange:', error);
			return res.status(500).json({ error: error });
		}

		quote = exchange.find(msg => msg instanceof Quote);
		console.log('************found quote:', quote);

		if (!quote) {
			// Make sure the exchange is still open
			close = exchange.find(msg => msg instanceof Close);
			console.log('************found close:', close);
			if (close) { break; }
			else {
				// Wait 2 seconds before making another request
				await new Promise(resolve => setTimeout(resolve, 2000));
			}
		}
	}

	console.log('quote:', quote);



	// create order object
	const order = Order.create({
		metadata: {
			from: didRecord.did,         // Customer's DID
			to: quote.metadata.from,       // PFI's DID
			exchangeId: quote.exchangeId,  // Exchange ID from the Quote
			protocol: "1.0"                // Version of tbDEX protocol you're using
		}
	});


	await order.sign(bearerDid);

	console.log('order:', order);
	try {
		await TbdexHttpClient.submitOrder(order);

	} catch (error) {
		console.error('Error submitting order:', error);
		return res.status(500).json({ error: error });
	}

	let orderStatusUpdate;
	let orderClose;

	while (!orderClose) {
		const exchange = await TbdexHttpClient.getExchange({
			pfiDid: order.metadata.to,
			did: bearerDid,
			exchangeId: order.exchangeId
		});

		for (const message of exchange) {
			if (message instanceof OrderStatus) {
				// a status update to display to your customer
				orderStatusUpdate = message.data.orderStatus;
			}
			else if (message instanceof Close) {
				// final message of exchange has been written
				orderClose = message;
				break;
			}
		}
	}

	console.log('orderClose:', orderClose);

	return res.status(200).json({
		quote: quote,
		closeMessage: orderClose
	});
}


exports.createDid = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { userId } = req.body

	const { DidDht } = await import('@web5/dids');
	const didDht = await DidDht.create({ publish: true });
	console.log('didDht:', didDht);

	const portableDid = await didDht.export()

	// save the record to supabase
	const { data, error } = await supabaseCall(() => supabase
		.from('tbd_decentralized_identifiers')
		.insert({
			user_id: userId,
			did: didDht.uri,
			portable_did: portableDid,
			did_dht: didDht,
		}
		)
		.single())

	if (error) {
		console.error('Error creating DID:', error);
		return res.status(500).json({ error: "An unexpected error occurred" });
	}


	console.log('portableDid:', portableDid);

	const did = didDht.uri;
	const didDocument = JSON.stringify(didDht.document);
	// console.log('DID:', did);
	// console.log('DID Document:', didDocument);


	return res.status(200).json({ message: "return message goes here" });
}
