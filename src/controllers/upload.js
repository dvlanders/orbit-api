const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const path = require("path");
const { responseCode, rs, messages } = require("../util");
const User = require("./../models/userAuth");
const { common } = require("../util/helper");

// const AWSCREDS = {
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESSKEYID,
//     secretAccessKey: process.env.AWS_SECRETACCESSKEY,
//   },
//   region: process.env.AWS_REGION,
// };

// const s3 = new S3Client(AWSCREDS);

// const s3Storage = multerS3({
// 	s3: s3,
// 	bucket: process.env.AWS_S3_BUCKETNAME,
// 	metadata: (req, file, cb) => {
// 		cb(null, { fieldname: file.fieldname });
// 	},
// 	key: (req, file, cb) => {
// 		const fileName =
// 			Date.now() + "_" + file.fieldname + "_" + file.originalname;
// 		cb(null, fileName);
// 	},
// 	contentType: (req, file, cb) => {
// 		cb(null, file.mimetype);
// 	},
// });

function sanitizeFile(file, cb) {
	const fileExts = [".png", ".jpg", ".jpeg"];

	let fileextension = path.extname(file.originalname.toLowerCase());
	const isAllowedExt = fileExts.includes(fileextension);
	const isAllowedMimeType = file.mimetype.startsWith("image/");
	if (isAllowedExt && isAllowedMimeType) {
		return cb(null, true);
	} else {
		cb(`File TYPE ${fileextension.replace(".", "")} IS NOT THE IMAGE`);
	}
}

// const uploadImage1 = multer({
// 	storage: s3Storage,
// 	fileFilter: (req, file, callback) => {
// 		sanitizeFile(file, callback);
// 	},
// 	limits: {
// 		fileSize: 1024 * 1024 * 5, // 5mb file size
// 	},
// });

exports.uploadImage = async (req, res) => {
	const { user_id } = req.params;
	const userDetails = await User.get(user_id);
	if (userDetails == undefined) {
		common.eventBridge("USER NOT FOUND", responseCode.badRequest);
		return res
			.status(responseCode.badRequest)
			.json(rs.incorrectDetails("USER NOT FOUND", {}));
	}

	uploadImage1.single("image")(req, res, async function (err) {
		try {
			if (err) {
				return res
					.status(responseCode.badRequest)
					.json(rs.incorrectDetails(err));
			}

			if (!(await req.file)) {
				return res
					.status(responseCode.badRequest)
					.json(rs.errorResponse(null, "IMAGE UPLOAD FAILED"));
			}

			let url = await req.file.location;
			await User.update({ user_id: userDetails.user_id }, { logoUrl: url });

			return res
				.status(responseCode.success)
				.json(rs.successResponse("IMAGE UPLOADED"));
		} catch (error) {
			return res
				.status(responseCode.serverError)
				.json(rs.errorResponse(error?.message?.toString()));
		}
	});
};

exports.getLogo = async (req, res) => {
	try {
		const { user_id } = req.params;
		const userDetails = await User.get(user_id);
		if (userDetails == undefined) {
			common.eventBridge("USER NOT FOUND", responseCode.badRequest);
			return res
				.status(responseCode.badRequest)
				.json(rs.incorrectDetails("USER NOT FOUND", {}));
		}

		let logo = userDetails?.logoUrl;
		return res
			.status(responseCode.success)
			.json(rs.successResponse("LOGO RETRIVED", { url: logo }));
	} catch (error) {
		return res.status(responseCode.serverError).json(rs.errorResponse(error));
	}
};
