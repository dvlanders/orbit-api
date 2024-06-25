const supabase = require("../util/supabaseClient");

const uploadFile = async (file, path) => {
    
    const { data, error } = await supabase
        .storage
        .from('compliance_id')
        .upload(path, file.buffer, {
            contentType: file.mimetype
        });

    if (error) {
        throw error;
    }

    return data.path;
};

exports.testFileUpload = async(req, res) => {
 if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
    }

    try{
    const files = req.files;
    const { user_id } = req.body

    if (!user_id) {
        return res.status(400).json({ error: 'user_id is required.' });
    }

    if (!files['front'] || !files['back']) {
        return res.status(400).json({ error: 'Both front and back files are required.' });
    }

    const paths = {}

    await Promise.all(Object.keys(files).map(async(key) => {
        if (files[key] && files[key].length > 0){
            console.log(`upload ${key}`)
            paths[key] =  await uploadFile(files[key][0], `${user_id}/front`);
        }
    }))


    res.status(200).json({
        message: 'Files uploaded to Supabase successfully',
        files: paths
    });
    }catch (error){
        res.status(500).json({ error: 'Failed to upload files', details: error.message });
    }

}

exports.privateRoute = async(req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    
    return res.status(200).json({message: "ha"})
}

exports.testSupabaseWebhook = async(req, res) => {
    if (req.method !== "POST"){
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log(req.body.record)
    return res.status(200).json({message: "Success"})
}
