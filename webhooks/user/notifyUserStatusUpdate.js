const getBastionUser = require("../../src/util/bastion/main/getBastionUser");
const getBridgeCustomer = require("../../src/util/bridge/endpoint/getBridgeCustomer");
const getCheckbookUser = require("../../src/util/checkbook/endpoint/getCheckbookUser");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { sendMessage } = require("../sendWebhookMessage");
const { webhookEventActionType, webhookEventType } = require("../webhookConfig");

const Status = {
	ACTIVE: "ACTIVE",
	INACTIVE: "INACTIVE",
	PENDING: "PENDING",
}

const getUserStatus = async (userId) => {

	// base response
	let getHifiUserResponse = {
		wallet: {
			walletStatus: Status.INACTIVE,
			actionNeeded: {
				actions: [],
				fieldsToResubmit: [],
			},
			walletMessage: "",
			walletAddress: {}
		},
		user_kyc: {
			status: Status.INACTIVE, // represent bridge
			actionNeeded: {
				actions: [],
				fieldsToResubmit: [],
			},
			message: '',
		},
		ramps: {
			usdAch: {
				onRamp: {
					status: Status.INACTIVE, // represent bridge
					actionNeeded: {
						actions: [],
						fieldsToResubmit: [],
					},
					message: '',
					achPull: {
						achPullStatus: Status.INACTIVE, //represent bridge + checkbook
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
					},
				},
				offRamp: {
					status: Status.INACTIVE, // represent bridge
					actionNeeded: {
						actions: [],
						fieldsToResubmit: [],
					},
					message: ''
				},
			},
			euroSepa: {
				onRamp: {
					status: Status.INACTIVE, // represent bridge
					actionNeeded: {
						actions: [],
						fieldsToResubmit: [],
					},
					message: 'SEPA onRamp will be available in near future',
				},
				offRamp: {
					status: Status.INACTIVE, // represent bridge
					actionNeeded: {
						actions: [],
						fieldsToResubmit: [],
					},
					message: ''
				},
			},
		},
		user: {
			id: userId
		}
	}


	const [bastionResult, bridgeResult, checkbookResult] = await Promise.all([
		getBastionUser(userId),
		getBridgeCustomer(userId),
		getCheckbookUser(userId)
	])

	// Bastion status
	const wallet = {
		walletStatus: bastionResult.walletStatus,
		walletMessage: bastionResult.message,
		actionNeeded: {
			actions: [...bastionResult.actions, ...getHifiUserResponse.wallet.actionNeeded.actions],
			fieldsToResubmit: [...bastionResult.invalidFileds, ...getHifiUserResponse.wallet.actionNeeded.fieldsToResubmit]
		},
		walletAddress: bastionResult.walletAddress
	}
	getHifiUserResponse.wallet = wallet

	//checkbook status
	const achPull = {
		achPullStatus: checkbookResult.usOnRamp.status,
		actionNeeded: {
			actions: [...checkbookResult.usOnRamp.actions, ...getHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.actions],
			fieldsToResubmit: [...checkbookResult.usOnRamp.fields, ...getHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.fieldsToResubmit]
		}
	}
	getHifiUserResponse.ramps.usdAch.onRamp.achPull = achPull

	// bridge status
	// kyc
	const userKyc = {
		status: bridgeResult.customerStatus.status,
		actionNeeded: {
			actions: bridgeResult.customerStatus.actions,
			fieldsToResubmit: bridgeResult.customerStatus.fields,
		}
	}
	getHifiUserResponse.user_kyc = userKyc
	// usRamp
	const usdAch = {
		onRamp: {
			status: bridgeResult.usRamp.status,
			actionNeeded: {
				actions: bridgeResult.customerStatus.actions,
				fieldsToResubmit: bridgeResult.customerStatus.fields
			},
			message: bridgeResult.message,
			achPull: {
				achPullStatus: checkbookResult.usOnRamp.status == Status.INACTIVE || checkbookResult.usOnRamp.status == Status.PENDING ? checkbookResult.usOnRamp.status : bridgeResult.usRamp.status,
				actionNeeded: {
					actions: [...bridgeResult.usRamp.actions, ...getHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.actions],
					fieldsToResubmit: [...bridgeResult.usRamp.fields, ...getHifiUserResponse.ramps.usdAch.onRamp.achPull.actionNeeded.fieldsToResubmit]
				}
			}
		},
		offRamp: {
			status: bridgeResult.usRamp.status,
			actionNeeded: {
				actions: [...bridgeResult.usRamp.actions, ...getHifiUserResponse.ramps.usdAch.offRamp.actionNeeded.actions],
				fieldsToResubmit: [...bridgeResult.usRamp.fields, ...getHifiUserResponse.ramps.usdAch.offRamp.actionNeeded.fieldsToResubmit]
			},
		}
	}
	getHifiUserResponse.ramps.usdAch = usdAch
	// euRamp
	const euroSepa = {
		onRamp: {
			status: Status.INACTIVE,
			actionNeeded: {
				actions: [],
				fieldsToResubmit: [],
			},
			message: 'SEPA onRamp will be available in near future',
		},
		offRamp: {
			status: bridgeResult.euRamp.status,
			actionNeeded: {
				actions: [...bridgeResult.euRamp.actions, ...getHifiUserResponse.ramps.euroSepa.offRamp.actionNeeded.actions],
				fieldsToResubmit: [...bridgeResult.euRamp.fields, ...getHifiUserResponse.ramps.euroSepa.offRamp.actionNeeded.fieldsToResubmit],
			},
			message: ''
		},
	}
	getHifiUserResponse.ramps.euroSepa = euroSepa


	return getHifiUserResponse
}

const notifyUserStatusUpdate = async (userId) => {

	// get profileId

	let { data: user, error: userError } = await supabaseCall(() => supabase
		.from('users')
		.select('profile_id, is_developer')
		.eq("id", userId)
		.single()
	)

	if (userError) {
		createLog("webhook/notifyUserStatusUpdate", userId, userError.message)
		return
	}

	if (user.is_developer) return

	const userStatus = await getUserStatus(userId)
	const message = {
		eventAction: webhookEventActionType.UPDATE,
		eventType: webhookEventType["USER.STATUS"],
		data: userStatus
	}

	await sendMessage(user.profile_id, message)

}

module.exports = notifyUserStatusUpdate