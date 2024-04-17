/**
 * Fetches an image from a given URL and converts it to a Base64-encoded data URI.
 * @param {string} imageUrl - URL of the image to convert.
 * @returns {Promise<string>} - A promise that resolves to the Base64-encoded data URI.
 */
async function fileToBase64(imageUrl) {
	try {
		// Fetch the image from the URL
		const response = await fetch(imageUrl);
		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}
		// Retrieve the image blob
		const blob = await response.blob();

		// Return a new promise that resolves with the Base64 string
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				// Create a data URI, excluding the prefix "data:" and the base64 indicator ";base64,"
				const base64data = reader.result;
				resolve(base64data);
			};
			reader.onerror = (error) => {
				reject(error);
			};
			// Read the blob as a data URL
			reader.readAsDataURL(blob);
		});
	} catch (error) {
		console.error("Error converting file to Base64:", error);
		throw error;
	}
}

module.exports = fileToBase64;
