let AWS = require('aws-sdk');
let express = require('express');
let router = express.Router();
let config = require('./config.json');
AWS.config.update({
 "region": "us-east-1",
 "accessKeyId": "AKIAWTCFUVBIEYZJDCWM",
 "secretAccessKey": "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"
});

let docClient = new AWS.DynamoDB.DocumentClient();
let table = "user_auth";

router.get('/fetch', (req, res) => {

let spid = '101';
let params = {
    TableName: table,
    Key: {
        spid: spid
    }
};

docClient.get(params, function (err, data) {
    if (err) {
        console.log(err);
        handleError(err, res);
    } else {
        handleSuccess(data.Item, res);
    }
 });
});
function handleError(err, res) {
    res.json({ 'message': 'server side error', statusCode: 500, error: 
    err });
}

function handleSuccess(data, res) {
    res.json({ message: 'success', statusCode: 200, data: data })
}

