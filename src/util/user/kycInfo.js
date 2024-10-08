const { CustomerStatus } = require('./common');

const KycLevel = {
    ZERO: 0,
    ONE: 1,
    TWO: 2,
}

const createStatusStruct = (status = CustomerStatus.INACTIVE, actions = [], fieldsToResubmit = [], message= '') => ({
    status,
    actionNeeded: {
        actions,
        fieldsToResubmit,
    },
    message,  
})

const oldKycInfo = () => ({
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
})

const defaultKycInfo = (userId, kycLevel = KycLevel.ZERO) => {
    const defaultStructure = {
        ...oldKycInfo(),
        onChain: {
            wallet: {
                ...createStatusStruct(),
                walletAddress: {}
            }
        },
        onRamp: {
            usd: {
                achPush:{
                    ...createStatusStruct()
                },
                achPull:{
                    ...createStatusStruct()
                },
            },
            euro: {
                sepa:{
                    ...createStatusStruct(CustomerStatus.INACTIVE, [], [], 'SEPA onRamp will be available in near future')
                }
            }
        },
        offRamp: {
            usd: {
                ach:{
                    ...createStatusStruct()
                }
    
            },
            euro: {
                sepa:{
                    ...createStatusStruct()
                }
            }
        },
        user: {
            id: userId,
            kyc: {
                level: kycLevel ? kycLevel : KycLevel.ZERO,
                ...createStatusStruct()
            }
        }
    
    }

    return defaultStructure;
}

const updateKycInfo = (kycInfo, walletResult, bridgeResult, checkbookResult) => {
    const kycLevel = kycInfo.user.kyc.level;
    const userId = kycInfo.user.id;
    // wallet status
    const wallet = {
        walletStatus: walletResult.walletStatus,
        walletMessage: walletResult.message,
        actionNeeded: {
            actions: walletResult.actions,
            fieldsToResubmit: walletResult.invalidFileds
        },
        walletAddress: walletResult.walletAddress
    }
    kycInfo.wallet = wallet

    // These are new kyc info structures we want to migrate to
    const walletUpdates = {
        status: walletResult.walletStatus,
        message: walletResult.message,
        actionNeeded: {
            actions: walletResult.actions,
            fieldsToResubmit: walletResult.invalidFileds
        },
        walletAddress: walletResult.walletAddress
    }
    kycInfo.onChain.wallet = walletUpdates;

    // kyc
    const userKyc = {
        status: kycLevel === KycLevel.ONE ? walletResult.walletStatus : bridgeResult.customerStatus.status,
        actionNeeded: {
            actions: kycLevel === KycLevel.ONE ? walletResult.actions : bridgeResult.customerStatus.actions,
            fieldsToResubmit: kycLevel === KycLevel.ONE ? walletResult.invalidFileds : bridgeResult.customerStatus.fields,
        },
        message: kycLevel === KycLevel.ONE ? walletResult.message : bridgeResult.message,
    }
    kycInfo.user_kyc = userKyc

    // These are new kyc info structures we want to migrate to
    const userStatusUpdates = {
        id: userId,
        kyc: {
            level: kycLevel,
            ...userKyc
        }		
    }

    kycInfo.user = userStatusUpdates;

    //checkbook status
    const achPull = {
        achPullStatus: checkbookResult.usOnRamp.status == CustomerStatus.INACTIVE || checkbookResult.usOnRamp.status == CustomerStatus.PENDING ? checkbookResult.usOnRamp.status : bridgeResult.usRamp.status,
        actionNeeded: {
            actions: [...checkbookResult.usOnRamp.actions, ...bridgeResult.usRamp.actions],
            fieldsToResubmit: [...checkbookResult.usOnRamp.fields, ...bridgeResult.usRamp.fields]
        },
        message: checkbookResult.message
    }

    // usRamp
    const usdAch = {
        onRamp: {
            status: bridgeResult.usRamp.status,
            actionNeeded: {
                actions: bridgeResult.customerStatus.actions,
                fieldsToResubmit: bridgeResult.customerStatus.fields
            },
            message: bridgeResult.message,
            achPull: achPull
        },
        offRamp: {
            status: bridgeResult.usRamp.status,
            actionNeeded: {
                actions: bridgeResult.usRamp.actions,
                fieldsToResubmit: bridgeResult.usRamp.fields
            },
            message: bridgeResult.message,
        }
    }
    kycInfo.ramps.usdAch = usdAch

    const usdAchOnrampPushUpdates = {
        status: bridgeResult.usRamp.status,
        actionNeeded: {
            actions: bridgeResult.customerStatus.actions,
            fieldsToResubmit: bridgeResult.customerStatus.fields,		
        },
        message: bridgeResult.message,
    }
    kycInfo.onRamp.usd.achPush = usdAchOnrampPushUpdates;

    const usdAchPullUpdates = {
        status: checkbookResult.usOnRamp.status == CustomerStatus.INACTIVE || checkbookResult.usOnRamp.status == CustomerStatus.PENDING ? checkbookResult.usOnRamp.status : bridgeResult.usRamp.status,
        actionNeeded: {
            actions: [...checkbookResult.usOnRamp.actions, ...bridgeResult.usRamp.actions],
            fieldsToResubmit: [...checkbookResult.usOnRamp.fields, ...bridgeResult.usRamp.fields]	
        },
        message: checkbookResult.message
    }
    kycInfo.onRamp.usd.achPull = usdAchPullUpdates;
    kycInfo.offRamp.usd.ach = usdAch.offRamp;

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
                actions: bridgeResult.euRamp.actions,
                fieldsToResubmit: bridgeResult.euRamp.fields,
            },
            message: ''
        },
    }
    kycInfo.ramps.euroSepa = euroSepa
    kycInfo.onRamp.euro.sepa = euroSepa.onRamp;
    kycInfo.offRamp.euro.sepa = euroSepa.offRamp;
}

module.exports = {
    KycLevel,
    defaultKycInfo,
    updateKycInfo
}


