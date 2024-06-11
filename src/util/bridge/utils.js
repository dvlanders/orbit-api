exports.bridgeFieldsToDatabaseFields = {
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


exports.BridgeCustomerStatus = {
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

exports.virtualAccountPaymentRailToChain = {
	ethereum: "ETHEREUM_MAINNET",
	optimism: "OPTIMISM_MAINNET",
	polygon: "POLYGON_MAINNET"
}


exports.getEndorsementStatus = (endorsements, name) => {
	const endorsement = endorsements.find(e => e.name === name);
	return endorsement ? endorsement.status : undefined;
}
