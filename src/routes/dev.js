const { dev } = require("../controllers");
const multer = require('multer');
const { authorize } = require("../util/middleware");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const express = require('express');
const bodyParser = require('body-parser');


module.exports = (router) => {

	router.post("/dev/testFileUpload", upload.fields([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }]), dev.testFileUpload);
	router.post("/dev/privateRoute", authorize, dev.privateRoute)
	router.post("/dev/webhook-receiver", dev.testwebhook)
	router.post("/dev/testCreateJob", dev.testCreateJob)
	router.post("/dev/testApproveAsset", dev.testApproveAsset)
	router.post("/dev/registerFeeWallet", dev.registerFeeWallet)
	router.post("/dev/triggerOnRampFeeCharge", dev.triggerOnRampFeeCharge)
	router.post("/dev/testCreateBill", dev.testCreateBill)
	router.post("/dev/testStripeWebwook", dev.testStripeWebwook)
	router.get("/dev/testCheckList", dev.testCheckList)
	router.get("/dev/testDevLogging", dev.testDevLogging)
	router.get("/dev/testIp", dev.testIp)
	router.get("/dev/testCheckFeeWalletRegistered", dev.testCheckFeeWalletRegistered)
	router.get("/dev/testBastionUserTable", dev.testBastionUserTable)
	router.post("/dev/testSendMessage", dev.testSendMessage)
	router.get("/dev/testGetVirtualAccountAmount", dev.testGetVirtualAccountAmount)
	router.get("/dev/testReapAccount", dev.testReapAccount)
	router.get("/dev/testSelectOnEnum", dev.testSelectOnEnum)
	router.post("/dev/insertAllFeeRecord", dev.insertAllFeeRecords)
	router.get("/dev/insertFeeTag", dev.insertFeeTag)
};
