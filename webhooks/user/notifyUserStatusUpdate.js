const getBastionUser = require("../../src/util/bastion/main/getBastionUser");
const getBridgeCustomer = require("../../src/util/bridge/endpoint/getBridgeCustomer");
const getCheckbookUser = require("../../src/util/checkbook/endpoint/getCheckbookUser");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { CustomerStatus } = require("../../src/util/user/common");
const { getUserWalletStatus } = require("../../src/util/user/getUserWalletStatus");
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
			walletStatus: CustomerStatus.PENDING,
			actionNeeded: {
				actions: [],
				fieldsToResubmit: [],
			},
			walletMessage: "",
			walletAddress: {}
		},
		user_kyc: {
			status: CustomerStatus.PENDING, // represent bridge
			actionNeeded: {
				actions: [],
				fieldsToResubmit: [],
			},
			message: '',
		},
		ramps: {
			usdAch: {
				onRamp: {
					status: CustomerStatus.PENDING, // represent bridge
					actionNeeded: {
						actions: [],
						fieldsToResubmit: [],
					},
					message: '',
					achPull: {
						achPullStatus: CustomerStatus.PENDING, //represent bridge + checkbook
						actionNeeded: {
							actions: [],
							fieldsToResubmit: [],
						},
					},
				},
				offRamp: {
					status: CustomerStatus.PENDING, // represent bridge
					actionNeeded: {
						actions: [],
						fieldsToResubmit: [],
					},
					message: ''
				},
			},
			euroSepa: {
				onRamp: {
					status: CustomerStatus.INACTIVE, // represent bridge
					actionNeeded: {
						actions: [],
						fieldsToResubmit: [],
					},
					message: 'SEPA onRamp will be available in near future',
				},
				offRamp: {
					status: CustomerStatus.PENDING, // represent bridge
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
	
	// get status
	const [walletStatus, bridgeResult, checkbookResult] = await Promise.all([
		getUserWalletStatus(userId),
		getBridgeCustomer(userId),
		getCheckbookUser(userId)
	])

	// Bastion status
	const wallet = {
		walletStatus: walletStatus.walletStatus,
		walletMessage: walletStatus.message,
		actionNeeded: {
			actions: [...walletStatus.actions, ...getHifiUserResponse.wallet.actionNeeded.actions],
			fieldsToResubmit: [...walletStatus.invalidFileds, ...getHifiUserResponse.wallet.actionNeeded.fieldsToResubmit]
		},
		walletAddress: walletStatus.walletAddress
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
		},
		message: bridgeResult.message
	}
	getHifiUserResponse.user_kyc = userKyc
	// usRamp
	const usdAch = {
		onRamp: {
			status: bridgeResult.usRamp.status,
			actionNeeded: {
				actions: bridgeResult.usRamp.actions,
				fieldsToResubmit: bridgeResult.customerStatus.fields
			},
			message: bridgeResult.message,
			achPull: {
				achPullStatus: checkbookResult.usOnRamp.status == CustomerStatus.INACTIVE || checkbookResult.usOnRamp.status == CustomerStatus.PENDING ? checkbookResult.usOnRamp.status : bridgeResult.usRamp.status,
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
			status: CustomerStatus.INACTIVE,
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

	// determine the status code to return to the client -- copied from createHifiUser, make sure this logic still holds true
	let status
	if (checkbookResult.status === 200 && bridgeResult.status === 200 && walletStatus.status === 200) {
		status = 200
	} else if (checkbookResult.status === 500 || bridgeResult.status === 500 || walletStatus.status == 500) {
		status = 500;
	} else {
		status = 400;
	}

	return {status, getHifiUserResponse}
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
		await createLog("webhook/notifyUserStatusUpdate", userId, userError.message)
		return
	}

	if (user.is_developer) return

	const { status, getHifiUserResponse } = await getUserStatus(userId)
	const message = {
		eventAction: webhookEventActionType.UPDATE,
		eventType: webhookEventType["USER.STATUS"],
		data: getHifiUserResponse
	}

	await sendMessage(user.profile_id, message)

}

module.exports = notifyUserStatusUpdate