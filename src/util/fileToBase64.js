const fetch = require('node-fetch'); // Ensure you have node-fetch if not already installed

/**
 * Fetches an image from a given URL and converts it to a Base64-encoded data URI.
 * @param {string} imageUrl - URL of the image to convert.
 * @returns {Promise<string>} - A promise that resolves to the Base64-encoded data URI.
 */
async function fileToBase64(imageUrl) {
	try {
		const response = await fetch(imageUrl);
		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}

		// Retrieve the image as a buffer
		const buffer = await response.buffer();


		// Convert buffer to Base64 string
		const base64 = `data:${response.headers.get('content-type')};base64,` + buffer.toString('base64');

		return base64;
	} catch (error) {
		console.error("Error converting file to Base64:", error);
		throw error;
	}
}

module.exports = fileToBase64;
