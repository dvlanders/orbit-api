

const fileSizeCheck = async (fileUrl, minMB, maxMB) => {
    try {
        const response = await fetch(fileUrl, { method: 'GET' });
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
    
        const contentLength = response.headers.get('Content-Length');
        if (contentLength) {
          const fileSizeInBytes = parseInt(contentLength, 10);
          const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
          console.log(fileUrl)
          console.log('File size:', fileSizeInMB);
          if (fileSizeInMB >= maxMB) return { isValid: false, error: `File size ${fileSizeInMB}MB exceeds the maximum allowed size of ${maxMB}MB.` };
          if (fileSizeInMB <= minMB) return { isValid: false, error: `File size ${fileSizeInMB}MB is less than the minimum allowed size of ${minMB}MB.` };
          return { isValid: true, error: null };

        } else {
          throw new Error('Content-Length header is missing');
        }
      } catch (error) {
        console.error('Error checking file size:', error);
        return { isValid: false, error: `Fail to fetch file: ${fileUrl}` };
      }

}

const filesValidation = async (fields, minMB = 0, maxMB = 3) => {

    const invalidFields = [];

    await Promise.all(
        Object.keys(fields).map(async (key) => {
            if (key.endsWith('file')) {
                const fileUrl = fields[key];
                const { isValid, error } = await fileSizeCheck(fileUrl, minMB, maxMB);
                if(!isValid) invalidFields.push({ fieldName: key, fileUrl: fileUrl, reason: error });  
            }
        })
      );

    return invalidFields;
}

module.exports = {
    filesValidation,
}