const NODE_ENV = process.env.NODE_ENV

const bridgeFieldsToRequestFields = {
	first_name: "legalFirstName",
	last_name: "legalLastName",
	email: "complianceEmail",
	phone: "compliancePhone",
	birth_date: "dateOfBirth",
	tax_identification_number: "taxIdentificationNumber",
	gov_id_country: "govIdCountry",
	gov_id_image_front: "govIdFront",
	gov_id_image_back: "govIdBack",
	proof_of_address_document: "proofOfResidency",
	"address.country": "country",
	street_line_1: "addressLine1",
	street_line_2: "addressLine2",
	city: "city",
	"address.postal_code": "postalCode",
	"address.state": "stateStateRegion",
	signed_agreement_id: "signedAgreementId"
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

const chainToVirtualAccountPaymentRail = NODE_ENV == "development" ?
{
	"ETHEREUM_TESTNET": "ethereum",
	"OPTIMISM_TESTNET": "optimism",
	"POLYGON_AMOY": "polygon"
}
: 
{
	"ETHEREUM_MAINNET": "ethereum",
	"OPTIMISM_MAINNET": "optimism",
	"POLYGON_MAINNET": "polygon"
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
		fieldsToResubmit: ["dateOfBirth"],
		actions: ["update"]
	},
	UPDATE_TIN: {
		fieldsToResubmit: ["taxIdentificationNumber"],
		actions: ["update"]
	},
	UPDATE_ADDRESS: {
		fieldsToResubmit: ["address"],
		actions: ["update"]
	},
	ID_UPLOAD: {
		fieldsToResubmit: ["govId"],
		actions: ["update"]
	},
	POR_UPLOAD: {
		fieldsToResubmit: ["proofOfResidency"],
		actions: ["update"]
	},
	RE_ONBOARD: {
		fieldsToResubmit: [],
		actions: ["invalid_customer_info"]
	},
	SIGNED_AGREEMENT_ID:{
		fieldsToResubmit: ["signedAgreementId"],
		actions: ["update"]
	}
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
	"The customer has not accepted the terms of service": [AccountActions.SIGNED_AGREEMENT_ID]
  };

const extractActionsAndFields = (reasons) => {
	const requiredActions = new Set([])
	const fieldsToResubmit = new Set([])
    if (reasons){
      reasons.map((reason) => {
        const actions = RejectionReasons[reason]
        if (!actions){
			AccountActions.MANUAL_REVIEW.actions.map((requiredAction) => requiredActions.add(requiredAction))
			AccountActions.MANUAL_REVIEW.fieldsToResubmit.map((requiredField) => fieldsToResubmit.add(requiredField))
        }
    	else{
          actions.map((action) => {
			action.actions.map((requiredAction) => requiredActions.add(requiredAction))
			action.fieldsToResubmit.map((requiredField) => fieldsToResubmit.add(requiredField))
          })
        }
      })
    }
	return {requiredActions: Array.from(requiredActions), fieldsToResubmit: Array.from(fieldsToResubmit)}
  }

const additionalRequirementsMap = {
	"kyc_approval": {
		actions: ["update"],
		fields: []
	},
	"tos_acceptance": {
		actions: ["update"],
		fields: ["signedAgreementId"]
	},
	"kyc_with_proof_of_address":{
		actions: ["update"],
		fields: ["proofOfResidency"]
	}
}

const getEndorsementStatus = (endorsements, name) => {
	if (!endorsements) return {status:undefined, actions:[], fields:[]}
	const endorsement = endorsements.find(e => e.name === name);
	const status = endorsement ? endorsement.status : undefined;
	const additionalRequirements = endorsement && endorsement.additional_requirements ? endorsement.additional_requirements : [];
	const actions = new Set([])
	const fields = new Set([])
	
	additionalRequirements.map((r) => {
		const action = additionalRequirementsMap[r]
		if (action){
			action.actions.map((requiredAction) => actions.add(requiredAction))
			action.fields.map((requiredAField) => fields.add(requiredAField))
		}
	})
	return {status, actions: Array.from(actions), fields: Array.from(fields)}
}

module.exports = {
	bridgeFieldsToRequestFields,
	getEndorsementStatus,
	AccountActions,
	RejectionReasons,
	BridgeCustomerStatus,
	virtualAccountPaymentRailToChain,
	extractActionsAndFields,
	chainToVirtualAccountPaymentRail
}
