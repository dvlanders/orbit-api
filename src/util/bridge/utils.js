const NODE_ENV = process.env.NODE_ENV

const bridgeFieldsToDatabaseFields = {
	first_name: "legal_first_name",
	last_name: "legal_last_name",
	email: "compliance_email",
	phone: "compliance_phone",
	birth_date: "date_of_birth",
	tax_identification_number: "tax_identification_number",
	gov_id_country: "gov_id_country",
	gov_id_image_front: "gov_id_front",
	gov_id_image_back: "gov_id_back",
	proof_of_address_document: "proof_of_residency",
	"address.country": "country",
	"street_line_1": "address_line_1",
	"street_line_2": "address_line_2",
	"city": "city",
	"address.postal_code": "postal_code",
	"address.state": "state_state_region",
};


const BridgeCustomerStatus = {
	ACTIVE: "active",
	NOT_STARTED: "not_started",
	UNDER_REVIEW: "under_review",
	REJECTED: "rejected",
	UNKNOWN: "unknown",
	PENDING: "pending",
	MANUAL_REVIEW: "manual_review",
	INCOMPLETE: "incomplete",
	AWAITING_UBO: "awaiting_ubo",
}

const virtualAccountPaymentRailToChain = NODE_ENV == "development" ?
	{
		ethereum: "ETHEREUM_TESTNET",
		optimism: "OPTIMISM_TESTNET",
		polygon: "POLYGON_AMOY"
	}
	: 
	{
		ethereum: "ETHEREUM_MAINNET",
		optimism: "OPTIMISM_MAINNET",
		polygon: "POLYGON_MAINNET"
	}

const AccountActions = {
	MANUAL_REVIEW: {
		fieldsToResubmit: [],
		actions: ["manual_review"]
	},
	RESEND : {
		fieldsToResubmit: [],
		actions: ["update"]
	},
	UPDATE_AGE: {
		fieldsToResubmit: ["date_of_birth"],
		actions: ["update"]
	},
	UPDATE_TIN: {
		fieldsToResubmit: ["tax_identification_number"],
		actions: ["update"]
	},
	UPDATE_ADDRESS: {
		fieldsToResubmit: ["address"],
		actions: ["update"]
	},
	ID_UPLOAD: {
		fieldsToResubmit: ["gov_id"],
		actions: ["update"]
	},
	POR_UPLOAD: {
		fieldsToResubmit: ["proof_of_residency"],
		actions: ["update"]
	},
	RE_ONBOARD: {
		fieldsToResubmit: [],
		actions: ["invalid_customer_info"]
	},
}

const RejectionReasons = {
	"Inconsistent information in the barcode.": [AccountActions.UPDATE_ADDRESS, AccountActions.ID_UPLOAD],
	"Inconsistent details in extraction": [AccountActions.RE_ONBOARD],
	"Likely fabrication detected": [AccountActions.RE_ONBOARD],
	"Submission cannot be processed.": [AccountActions.RESEND],
	"Identity cannot be verified against third-party databases": [AccountActions.RESEND],
	"Potential PEP": [AccountActions.RE_ONBOARD],
	"Customer information could not be verified": [AccountActions.RE_ONBOARD],
	"Inconsistent details in extraction.": [AccountActions.RE_ONBOARD],
	"Likely fabrication detected.":[AccountActions.RE_ONBOARD],
	"PO box address detected.": [AccountActions.UPDATE_ADDRESS],
	"Unsupported country": [AccountActions.UPDATE_ADDRESS],
	"Prohibited state/province": [AccountActions.UPDATE_ADDRESS],
	"Prohibited country": [AccountActions.UPDATE_ADDRESS],
	"Unsupported state/province":[ AccountActions.UPDATE_ADDRESS],
	"Cannot validate user age": [AccountActions.UPDATE_AGE],
	"ID cannot be verified against third-party databases": [AccountActions.ID_UPLOAD],
	"Missing or incomplete barcode on the ID.": [AccountActions.ID_UPLOAD],
	"Submission is blurry.": [AccountActions.ID_UPLOAD],
	"Inconsistent ID format": [AccountActions.ID_UPLOAD],
	"Compromised ID detected": [AccountActions.ID_UPLOAD],
	"ID from disallowed country.": [AccountActions.ID_UPLOAD],
	"Incorrect ID type selected.": [AccountActions.ID_UPLOAD],
	"Same side submitted as both front and back.": [AccountActions.ID_UPLOAD],
	"Electronic replica detected.": [AccountActions.ID_UPLOAD],
	"No government ID found in submission.": [AccountActions.ID_UPLOAD],
	"ID is expired.": [AccountActions.ID_UPLOAD],
	"Missing required ID details.": [AccountActions.ID_UPLOAD],
	"Glare detected in the submission.": [AccountActions.ID_UPLOAD],
	"Machine readable zone not detected": [AccountActions.ID_UPLOAD],
	"Inconsistent machine readable zone": [AccountActions.ID_UPLOAD],
	"Paper copy detected.": [AccountActions.ID_UPLOAD],
	"Blurry face portrait.": [AccountActions.ID_UPLOAD],
	"No face portrait found in the submission.": [AccountActions.ID_UPLOAD],
	"Face portrait matches a public figure.": [AccountActions.ID_UPLOAD],
	"Not a U.S. REAL ID.": [AccountActions.ID_UPLOAD],
	"ID details and face match previous submission.": [AccountActions.ID_UPLOAD],
	"Different faces in ID and selfie.": [AccountActions.ID_UPLOAD],
	"Dates on the ID are invalid.": [AccountActions.ID_UPLOAD],
	"Document could not be verified": [AccountActions.ID_UPLOAD],
	"No government ID detected": [AccountActions.ID_UPLOAD],
	"ID number format inconsistency.": [AccountActions.UPDATE_TIN],
	"Identity cannot be verified": [AccountActions.MANUAL_REVIEW],
	"Inconsistent details with previous submission.": [AccountActions.MANUAL_REVIEW],
	"Inconsistent details between submissions.": [AccountActions.MANUAL_REVIEW],
	"Tampering detected.": [AccountActions.MANUAL_REVIEW],
	"Person is deceased.": [AccountActions.MANUAL_REVIEW],
	"No database check was performed": [AccountActions.MANUAL_REVIEW],
	"Potential elder abuse": [AccountActions.MANUAL_REVIEW],
	"Inconsistent or incomplete information.": [AccountActions.MANUAL_REVIEW],
	"Missing or invalid proof of address": [AccountActions.POR_UPLOAD],
  };

const extractActionsAndFields = (reasons) => {
	const requiredActions = []
	const fieldsToResubmit = []
    if (reasons){
      reasons.map((reason) => {
        const actions = RejectionReasons[reason]
		console.log(actions)
        if (!actions){
			requiredActions = [...requiredActions, ...AccountActions.MANUAL_REVIEW.actions]
			fieldsToResubmit = [...fieldsToResubmit, ...AccountActions.MANUAL_REVIEW.fieldsToResubmit]
        }
    	else{
          actions.map((action) => {
            if (actions.indexOf(action) === -1){
				requiredActions = [...requiredActions, ...action.actions]
				fieldsToResubmit = [...fieldsToResubmit, ...action.fieldsToResubmit]
            }
          })
        }
      })
    }
	return {requiredActions, fieldsToResubmit}
  }

const additionalRequirementsMap = {
	"kyc_approval": {
		actions: ["update"],
		fields: []
	},
	"tos_acceptance": {
		actions: ["update"],
		fields: ["signed_agreement_id"]
	},
	"kyc_with_proof_of_address":{
		actions: ["update"],
		fields: ["proof_of_residency"]
	}
}

const getEndorsementStatus = (endorsements, name) => {
	if (!endorsements) return {status:undefined, actions:[], fields:[]}
	const endorsement = endorsements.find(e => e.name === name);
	const status = endorsement ? endorsement.status : undefined;
	const additionalRequirements = endorsement && endorsement.additional_requirements ? endorsement.additional_requirements : [];
	let actions = []
	let fields = []

	additionalRequirements.map((r) => {
		const action = additionalRequirementsMap[r]
		if (action){
			actions = [...actions, ...action.actions]
			fields= [...fields, ...action.fields]
		}
	})

	return {status, actions, fields}
}

module.exports = {
	bridgeFieldsToDatabaseFields,
	getEndorsementStatus,
	AccountActions,
	RejectionReasons,
	BridgeCustomerStatus,
	virtualAccountPaymentRailToChain,
	extractActionsAndFields,
}
