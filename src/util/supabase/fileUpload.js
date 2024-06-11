const supabase = require("../supabaseClient");
const {supabaseCall} = require("../supabaseWithRetry")

const AcceptedFileTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/tiff'
  ];
const MAX_FILE_SIZE_MB = 8;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;


async function uploadFileFromUrl(fileUrl, bucketName, filePath, acceptedFileTypes=AcceptedFileTypes) {
      // Fetch the file from the URL
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
  
      // Convert the response to a Blob
      const fileBlob = await response.blob();

    // Check if the file type is in the accepted file types array
    if (!acceptedFileTypes.includes(fileBlob.type)) {
        throw new Error(`File type ${fileBlob.type} is not accepted. Accepted types are: ${acceptedFileTypes.join(', ')}.`);
      }
      
    // Check the file size
    if (fileBlob.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File size ${fileBlob.size / (1024 * 1024)}MB exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB.`);
      }
  
      // Upload the Blob to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileBlob, {
          contentType: fileBlob.type, // Optional: set the content type
        });
  
      if (error) {
        throw new Error(`Failed to upload file: ${error.message}`);
      }
  
      return data.path
  }

module.exports = uploadFileFromUrl