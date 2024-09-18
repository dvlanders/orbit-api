const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry")

const AcceptedFileTypes = [
	'application/pdf',
	'image/jpeg',
	'image/png',
	'image/heic',
	'image/tiff'
];
const MAX_FILE_SIZE_MB = 8;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const fileUploadErrorType = {
	FILE_TOO_LARGE: "FILE_TOO_LARGE",
	INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	FAILED_TO_FETCH: "FAILED_TO_FETCH"
};

class fileUploadError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, fileUploadError.prototype);
	}
}


async function uploadFileFromUrl(fileUrl, bucketName, filePath, acceptedFileTypes = AcceptedFileTypes) {
	// Fetch the file from the URL
	const response = await fetch(fileUrl);
	if (!response.ok) {
		throw new fileUploadError(fileUploadErrorType.FAILED_TO_FETCH, `Failed to fetch file: ${fileUrl}`);
	}
	// Convert the response to a Blob
	const fileBlob = await response.blob();
	// Check if the file type is in the accepted file types array
	if (!acceptedFileTypes.includes(fileBlob.type)) {
		throw new fileUploadError(fileUploadErrorType.INVALID_FILE_TYPE, `File type ${fileBlob.type} is not accepted. Accepted types are: ${acceptedFileTypes.join(', ')}.`);
	}

	// Check the file size
	if (fileBlob.size > MAX_FILE_SIZE_BYTES) {
		throw new fileUploadError(fileUploadErrorType.FILE_TOO_LARGE, `File size ${fileBlob.size / (1024 * 1024)}MB exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB.`);
	}
	try {
		// Upload the Blob to Supabase Storage
		const { data, error } = await supabase.storage
			.from(bucketName)
			.upload(
				filePath, fileBlob, {
				contentType: fileBlob.type, // Optional: set the content type
				upsert: true
			});

		if (error) {
			throw new fileUploadError(fileUploadErrorType.INTERNAL_ERROR, `Failed to upload file: ${error.message}`, error);
		}

		return data.path
	} catch (error) {
		console.error(error)
		throw new fileUploadError(fileUploadErrorType.INTERNAL_ERROR, `Failed to upload file: ${fileUrl}`);
	}

}

module.exports = {
	fileUploadErrorType,
	uploadFileFromUrl
}