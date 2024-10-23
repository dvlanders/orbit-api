const { logThirdPartyApi } = require('../grafana/grafanaLogger');

const fetchWithLogging = async (url, options, tag = "") => {

    // we can disable third party api logging by setting LOG_THIRD_PARTY_API to anything other than TRUE
    if(process.env.LOG_THIRD_PARTY_API !== "TRUE") return await fetch(url, options);

    let response;
    try{
        response = await fetch(url, options);
        await logThirdPartyApi(url, tag, options.method, options.body, response.clone());
    }catch(error){
        await logThirdPartyApi(url, tag, options.method, options.body, null, error);
        throw error;
    }
    return response;
}

module.exports = {
    fetchWithLogging,
}