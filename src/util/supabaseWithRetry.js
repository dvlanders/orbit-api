exports.supabaseCall = async (queryFunction) => {
	const maxRetries = 3;
	let attempt = 0;

	while (attempt < maxRetries) {
		try {
			const { data, error } = await queryFunction();

			if (error) throw error

			// If the call is successful, return the response data
			return { data, error };

		} catch (error) {
			if (error.code === 504) {
				attempt++;
				console.log(`Attempt ${attempt} failed with 504. Retrying...`);
				if (attempt === maxRetries) {
					console.error('Maximum retries reached. Operation failed.');
					return { data: null, error }
				}
			} else {
				console.error('Operation failed:', error.message);
				return { data: null, error }
			}
		}
	}

	return { data: null, error: null }
}

