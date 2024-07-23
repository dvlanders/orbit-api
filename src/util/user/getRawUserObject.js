const jobMapping = require("../../../asyncJobs/jobMapping")
const getBastionUser = require("../bastion/main/getBastionUser")
const getBridgeCustomer = require("../bridge/endpoint/getBridgeCustomer")
const getCheckbookUser = require("../checkbook/endpoint/getCheckbookUser")
const createLog = require("../logger/supabaseLogger")
const { CustomerStatus } = require("./common")


exports.getRawUserObject = async(userId, profileId) => {
    try{
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

		// check if the userCreation is in the job queue, if yes return pending response
		const canScheduled = await jobMapping.createUser.scheduleCheck("createUser", {}, userId, profileId)
		if (!canScheduled) return {status: 200 , getHifiUserResponse}
        
        // get status
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
		if (checkbookResult.status === 200 && bridgeResult.status === 200 && bastionResult.status === 200) {
			status = 200
		} else if (checkbookResult.status === 500 || bridgeResult.status === 500 || bastionResult.status == 500) {
			status = 500;
		} else {
			status = 400;
		}

        return {status, getHifiUserResponse}


    }catch (error){
        await createLog("user/getRawUserObject", userId, error.message, error)
        throw new Error("Error happened in getRawUserObject")
    }

}