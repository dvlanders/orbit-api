const fetch = require('node-fetch');
const NodeCache = require('node-cache');

// cache for an hour
const cache = new NodeCache({ stdTTL: 60 * 60 }); 
const exchangeRateApiKey = process.env.EXCHANGE_RATE_API_KEY

exports.exchangeRate = async (req, res) => {
	try {
        const cacheKey = 'exchangeRate';
          // Check if data is in cache
        let cachedData = cache.get(cacheKey);
        if (cachedData) {
            return res.status(200).json(cachedData);
        }

        const response = await fetch(`https://api.freecurrencyapi.com/v1/latest?apikey=${exchangeRateApiKey}`);
        const data = await response.json();

        // Store data in cache
        cache.set(cacheKey, data);
        return res.status(200).json(data);

	} catch (error) {
        console.error(error)
		return res
			.status(responseCode.serverError)
			.json(rs.errorResponse(error.toString()));
	}
};