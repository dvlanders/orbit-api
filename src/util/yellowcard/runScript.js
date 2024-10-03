const createDecentralizedIdentifier = require('./createDecentralizedIdentifier');

async function run() {
	try {
		const userId = "75d7c01f-5f93-4490-8b93-a62fd8020358";
		const result = await createDecentralizedIdentifier(userId);
		console.log('DID creation result:', result);
	} catch (error) {
		console.error('Error in DID creation:', error);
	}
}

run();
