const { updateUserRecord } = require("./userService")

const fieldsToCheck = ["senderUserId", "recipientUserId", "sourceUserId", "destinationUserId", "userId"]

const updateLastUserActivity = async (req) => {
    const {userId} = req.query

    const updatePromises = [
        // Update based on userId from query
        userId ? updateUserRecord(userId, {last_activity_time: new Date().toISOString()}) : null,
        
        // Update based on fields in the body
        ...fieldsToCheck.map(field => 
            req.body[field] ? updateUserRecord(req.body[field], {last_activity_time: new Date().toISOString()}) : null
        )
    ].filter(Boolean) // Remove null promises
    await Promise.all(updatePromises)

}

module.exports = updateLastUserActivity