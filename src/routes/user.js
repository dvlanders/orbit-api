const { user } = require("../controllers");
const multer = require('multer');
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {

	/**
	 * @swagger
	 * /get_ping:
	 *   get:
	 *     summary: Ping endpoint
	 *     description: This endpoint returns a ping response.
	 *     responses:
	 *       200:
	 *         description: Successful response
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: 'pong'
	 */
	router.get("/get_ping", user.getPing);
	// TODO: router.get("/wallet_address", user.getPing);

/**
 * @swagger
 * /user/create:
 *   post:
 *     summary: Create user
 *     description: This endpoint creates a new user in Hifi.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               user_type:
 *                 type: string
 *               signed_agreement_id:
 *                 type: string
 *               legal_first_name:
 *                 type: string
 *               legal_last_name:
 *                 type: string
 *               compliance_email:
 *                 type: string
 *               compliance_phone:
 *                 type: string
 *               address_line_1:
 *                 type: string
 *               address_line_2:
 *                 type: string
 *               city:
 *                 type: string
 *               state_province_region:
 *                 type: string
 *               postal_code:
 *                 type: string
 *               country:
 *                 type: string
 *               address_type:
 *                 type: string
 *               tax_identification_number:
 *                 type: string
 *               id_type:
 *                 type: string
 *               gov_id_country:
 *                 type: string
 *               business_name:
 *                 type: string
 *               business_description:
 *                 type: string
 *               business_type:
 *                 type: string
 *               website:
 *                 type: string
 *               source_of_funds:
 *                 type: string
 *               is_dao:
 *                 type: boolean
 *               transmits_customer_funds:
 *                 type: boolean
 *               compliance_screening_explanation:
 *                 type: string
 *               ip_address:
 *                 type: string
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *               gov_id_front:
 *                 type: string
 *               gov_id_back:
 *                 type: string
 *               proof_of_residency:
 *                 type: string
 *     responses:
 *       200:
 *         description: User created successfully
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: object
 *                 properties:
 *                   walletStatus: string
 *                   actionNeeded: 
 *                     type: object
 *                     properties:
 *                       actions: 
 *                         type: array
 *                         items:
 *                           type: string
 *                       fieldsToResubmit: 
 *                         type: array
 *                         items:
 *                           type: string
 *                   walletMessage: string
 *               user_kyc:
 *                 type: object
 *                 properties:
 *                   status: string
 *                   actionNeeded: 
 *                     type: object
 *                     properties:
 *                       actions: 
 *                         type: array
 *                         items:
 *                           type: string
 *                       fieldsToResubmit: 
 *                         type: array
 *                         items:
 *                           type: string
 *                   message: string
 *               ramps:
 *                 type: object
 *                 properties:
 *                   usdAch:
 *                     type: object
 *                     properties:
 *                       onramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                           achPull:
 *                             type: object
 *                             properties:
 *                               achPullStatus: string
 *                               actionNeeded: 
 *                                 type: object
 *                                 properties:
 *                                   actions: 
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                                   fieldsToResubmit: 
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                               achPullMessage: string
 *                       offramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                   euroSepa:
 *                     type: object
 *                     properties:
 *                       onramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                       offramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *               user:
 *                 type: object
 *                 properties:
 *                   id: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 missing_fields:
 *                   type: array
 *                   items:
 *                     type: string
 *       405:
 *         description: Method not allowed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
	router.post("/user/create", user.createHifiUser);

/**
 * /user
 * get:
 *   summary: Get user status
 *   description: Get all user status including KYC, ramp, wallet transfer
 *   queryParams:
 *     user_id: string
 *   responses:
 *     200, 400, 500:
 *       description: User status retrieved successfully
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: object
 *                 properties:
 *                   walletStatus: string
 *                   actionNeeded: 
 *                     type: object
 *                     properties:
 *                       actions: 
 *                         type: array
 *                         items:
 *                           type: string
 *                       fieldsToResubmit: 
 *                         type: array
 *                         items:
 *                           type: string
 *                   walletMessage: string
 *               user_kyc:
 *                 type: object
 *                 properties:
 *                   status: string
 *                   actionNeeded: 
 *                     type: object
 *                     properties:
 *                       actions: 
 *                         type: array
 *                         items:
 *                           type: string
 *                       fieldsToResubmit: 
 *                         type: array
 *                         items:
 *                           type: string
 *                   message: string
 *               ramps:
 *                 type: object
 *                 properties:
 *                   usdAch:
 *                     type: object
 *                     properties:
 *                       onramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                           achPull:
 *                             type: object
 *                             properties:
 *                               achPullStatus: string
 *                               actionNeeded: 
 *                                 type: object
 *                                 properties:
 *                                   actions: 
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                                   fieldsToResubmit: 
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                               achPullMessage: string
 *                       offramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                   euroSepa:
 *                     type: object
 *                     properties:
 *                       onramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                       offramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *               user:
 *                 type: object
 *                 properties:
 *                   id: string
 *     500:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: "Unexpected error happened, please contact HIFI for more information"
 */
	router.get("/user", user.getHifiUser);

/**
 * @swagger
 * /user:
 *   put:
 *     summary: update user
 *     description: This endpoint update user information and kyc in Hifi.
 *     queryParams:
 *       user_id: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               user_type:
 *                 type: string
 *               signed_agreement_id:
 *                 type: string
 *               legal_first_name:
 *                 type: string
 *               legal_last_name:
 *                 type: string
 *               compliance_email:
 *                 type: string
 *               compliance_phone:
 *                 type: string
 *               address_line_1:
 *                 type: string
 *               address_line_2:
 *                 type: string
 *               city:
 *                 type: string
 *               state_province_region:
 *                 type: string
 *               postal_code:
 *                 type: string
 *               country:
 *                 type: string
 *               address_type:
 *                 type: string
 *               tax_identification_number:
 *                 type: string
 *               id_type:
 *                 type: string
 *               gov_id_country:
 *                 type: string
 *               business_name:
 *                 type: string
 *               business_description:
 *                 type: string
 *               business_type:
 *                 type: string
 *               website:
 *                 type: string
 *               source_of_funds:
 *                 type: string
 *               is_dao:
 *                 type: boolean
 *               transmits_customer_funds:
 *                 type: boolean
 *               compliance_screening_explanation:
 *                 type: string
 *               ip_address:
 *                 type: string
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *               gov_id_front:
 *                 type: string
 *               gov_id_back:
 *                 type: string
 *               proof_of_residency:
 *                 type: string
 *     responses:
 *       200:
 *         description: User created successfully
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: object
 *                 properties:
 *                   walletStatus: string
 *                   actionNeeded: 
 *                     type: object
 *                     properties:
 *                       actions: 
 *                         type: array
 *                         items:
 *                           type: string
 *                       fieldsToResubmit: 
 *                         type: array
 *                         items:
 *                           type: string
 *                   walletMessage: string
 *               user_kyc:
 *                 type: object
 *                 properties:
 *                   status: string
 *                   actionNeeded: 
 *                     type: object
 *                     properties:
 *                       actions: 
 *                         type: array
 *                         items:
 *                           type: string
 *                       fieldsToResubmit: 
 *                         type: array
 *                         items:
 *                           type: string
 *                   message: string
 *               ramps:
 *                 type: object
 *                 properties:
 *                   usdAch:
 *                     type: object
 *                     properties:
 *                       onramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                           achPull:
 *                             type: object
 *                             properties:
 *                               achPullStatus: string
 *                               actionNeeded: 
 *                                 type: object
 *                                 properties:
 *                                   actions: 
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                                   fieldsToResubmit: 
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                               achPullMessage: string
 *                       offramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                   euroSepa:
 *                     type: object
 *                     properties:
 *                       onramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *                       offramp:
 *                         type: object
 *                         properties:
 *                           status: string
 *                           actionNeeded: 
 *                             type: object
 *                             properties:
 *                               actions: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               fieldsToResubmit: 
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           message: string
 *               user:
 *                 type: object
 *                 properties:
 *                   id: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 missing_fields:
 *                   type: array
 *                   items:
 *                     type: string
 *       405:
 *         description: Method not allowed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
	router.put("/user", user.updateHifiUser);
};
