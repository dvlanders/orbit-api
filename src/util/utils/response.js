const safeParseBody = async(response) => {
    try{
        return await response.json()
    }catch (error){
        return {
            message: "No response body found for the response",
            status: response.status
        }
    }
}

module.exports = {
    safeParseBody
}