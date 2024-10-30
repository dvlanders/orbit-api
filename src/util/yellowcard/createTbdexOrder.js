async function createOrder(quote, did) {
	const { Order } = await import('@tbdex/http-client');
	const orderMetadata = {
		from: did,                // Customer's DID
		to: quote.metadata.from,  // PFI's DID
		exchangeId: quote.exchangeId,  // Exchange ID from the Quote
		protocol: "1.0"           // Version of tbDEX protocol you're using
	};

	const order = Order.create({ metadata: orderMetadata });
	await order.sign(did);  // Assuming 'did' here is a suitable object for signing
	return order;
}