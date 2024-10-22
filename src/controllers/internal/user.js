const {
	isUUID,
	fieldsValidation,
} = require("../../util/common/fieldsValidation");
const supabase = require("../../util/supabaseClient");
const { supabaseCall } = require("../../util/supabaseWithRetry");

exports.freeze = async (req, res) => {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const { profileId } = req.query;
	const fields = req.body;
	const { pid: freezeProfileId, route } = fields;

	const requiredFields = ["pid", "route"];
	const acceptedFields = {
		pid: (value) => isUUID(value),
		route: "string",
	};

	try {
		const { missingFields, invalidFields } = fieldsValidation(
			fields,
			requiredFields,
			acceptedFields
		);
		if (missingFields.length > 0 || invalidFields.length > 0)
			return res.status(400).json({
				error: `fields provided are either missing or invalid`,
				missingFields: missingFields,
				invalidFields: invalidFields,
			});

		const { data: frozenUser, error: frozenError } = await supabaseCall(() =>
			supabase
				.from("frozen_users")
				.insert(
					{
						profile_id: freezeProfileId,
						route: route,
					},
				)
				.select()
				.single()
		);

		if (frozenError) throw frozenError;

		return res.status(200).json({
			message: `You have successfully frozen profile id (${frozenUser.profile_id}) on route (${frozenUser.route})`,
		});
	} catch (error) {
		return res.status(500).json({ error: "Unexpected error happened" });
	}
};

exports.unfreeze = async (req, res) => {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const { profileId } = req.query;
	const fields = req.body;
	const { pid: unfreezeProfileId, route } = fields;

	const requiredFields = ["pid", "route"];
	const acceptedFields = {
		pid: (value) => isUUID(value),
		route: "string",
	};

	try {
		const { missingFields, invalidFields } = fieldsValidation(
			fields,
			requiredFields,
			acceptedFields
		);
		if (missingFields.length > 0 || invalidFields.length > 0)
			return res.status(400).json({
				error: `fields provided are either missing or invalid`,
				missingFields: missingFields,
				invalidFields: invalidFields,
			});

		const { data: unfrozenUser, error: unfrozenError } = await supabaseCall(
			() =>
				supabase
					.from("frozen_users")
					.delete()
					.eq("profile_id", unfreezeProfileId)
					.eq("route", route)
					.select()
					.maybeSingle()
		);

		if (unfrozenError) throw unfrozenError;

		if (!unfrozenUser) return res.status(400).json({
			message: `Profile id (${unfreezeProfileId}) was never frozen on route (${route})`,
		});

		return res.status(200).json({
			message: `You have successfully unfrozen profile id (${unfrozenUser.profile_id}) on route (${unfrozenUser.route})`,
		});
	} catch (error) {
		return res.status(500).json({ error: "Unexpected error happened" });
	}
};
