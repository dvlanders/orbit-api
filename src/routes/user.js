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
	 *     responses:
	 *       201:
	 *         description: User created successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 id:
	 *                   type: string
	 *                 username:
	 *                   type: string
	 */
	router.post("/user/create", user.createHifiUser);

	/**
	 * @swagger
	 * /user:
	 *   get:
	 *     summary: Get user
	 *     description: This endpoint returns user information.
	 *     parameters:
	 *       - name: id
	 *         in: query
	 *         required: true
	 *         description: User ID
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Successful response
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 id:
	 *                   type: string
	 *                 username:
	 *                   type: string
	 *                 email:
	 *                   type: string
	 */
	router.get("/user", user.getHifiUser);

	/**
	 * @swagger
	 * /user:
	 *   put:
	 *     summary: Update user
	 *     description: This endpoint updates user information.
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               id:
	 *                 type: string
	 *               username:
	 *                 type: string
	 *               email:
	 *                 type: string
	 *     responses:
	 *       200:
	 *         description: User updated successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 id:
	 *                   type: string
	 *                 username:
	 *                   type: string
	 *                 email:
	 *                   type: string
	 */
	router.put("/user", user.updateHifiUser);
};
