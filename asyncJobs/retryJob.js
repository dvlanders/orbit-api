/**
 * Get retry config
 * @param {boolean} shouldRetry 
 * @param {number} delay - default 60000ms
 * @param {string} reason 
 * @returns {object} retryConfig
 */
const getRetryConfig = (shouldRetry, delay=60000, reason="") => {
    return {
        retry: shouldRetry,
        delay,
        reason
    }
}

module.exports = {
    getRetryConfig
}