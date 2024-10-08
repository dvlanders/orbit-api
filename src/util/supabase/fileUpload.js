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
const MIN_FILE_SIZE_BYTES = 10 * 1024;



const fileUploadErrorType = {
	FILE_TOO_LARGE: "FILE_TOO_LARGE",
	FILE_TOO_SMALL: "FILE_TOO_SMALL",
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
    let response;
    try {
        response = await fetch(fileUrl);
    } catch (error) {
        console.error(error);
        throw new fileUploadError(fileUploadErrorType.FAILED_TO_FETCH, `Failed to fetch file: ${fileUrl}`);
    }
    
	if (!response.ok) {
		throw new fileUploadError(fileUploadErrorType.FAILED_TO_FETCH, `Failed to fetch file: ${fileUrl}`);
	}
	// Convert the response to a Blob
	const fileBlob = await response.blob();
	// Check if the file type is in the accepted file types array
	if (!acceptedFileTypes.includes(fileBlob.type)) {
		throw new fileUploadError(fileUploadErrorType.INVALID_FILE_TYPE, `File type ${fileBlob.type} is not accepted. Accepted types are: ${acceptedFileTypes.join(', ')}.`);
	}

	// Check the file size for file > 10 mb
	if (fileBlob.size > MAX_FILE_SIZE_BYTES) {
		throw new fileUploadError(fileUploadErrorType.FILE_TOO_LARGE, `File size ${fileBlob.size / (1024 * 1024)}MB exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB.`);
	}

	// Check the file size for file < 10 kb
	if (fileBlob.size < MIN_FILE_SIZE_BYTES) {
		throw new fileUploadError(fileUploadErrorType.FILE_TOO_SMALL, `File size ${fileBlob.size / 1024}KB is less than the minimum allowed size of ${MIN_FILE_SIZE_BYTES / 1024}KB.`);
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