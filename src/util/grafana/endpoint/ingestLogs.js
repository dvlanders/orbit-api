

const lokiPush = async (logEntry) => {

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${process.env.GRAFANA_USER_ID}` + ':' + `${process.env.GRAFANA_API_KEY}`).toString('base64')}`
        },
        body: JSON.stringify(logEntry)
    };

    const response = await fetch(`${process.env.GRAFANA_LOKI_PUSH_URL}`, options);
    if (!response.ok) {
        console.error(`HTTP Error Response: ${response.status} ${response.statusText}`);
    }

}


module.exports = {
    lokiPush
}