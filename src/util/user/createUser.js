
exports.isRequiredFieldsForIndividualCustomerProvided = (fields) => {

    const required = [
        "user_type",
        "legal_first_name",
        "legal_last_name",
        "compliance_email",
        "compliance_phone",
        "date_of_birth",
        "tax_identification_number",
        "gov_id_country",
        "country",
        "address_line_1",
        "city",
        "postal_code",
        "state_province_region",
        "signed_agreement_id",
        "ip_address"
    ];
    const missingFields = []

    required.map((key) => {
        if (!fields[key] || fields[key] == "") {
            missingFields.push(key)
        }
    })

    return missingFields


}

// Function to validate KYC data
exports.isFieldsForIndividualCustomerValid = (fields) => {
    // Check if all columns are present in the data object
    const userKYCColumns = new Set([
        "id",
        "created_at",
        "user_id",
        "legal_first_name",
        "legal_last_name",
        "date_of_birth",
        "compliance_email",
        "compliance_phone",
        "address_line_1",
        "address_line_2",
        "city",
        "state_province_region",
        "postal_code",
        "country",
        "address_type",
        "tax_identification_number",
        "id_type",
        "proof_of_residency",
        "gov_id_front",
        "gov_id_back",
        "gov_id_country",
        "proof_of_ownership",
        "formation_doc",
        "business_name",
        "business_description",
        "business_type",
        "website",
        "source_of_funds",
        "is_dao",
        "transmits_customer_funds",
        "compliance_screening_explanation",
        "ip_address",
        "signed_agreement_id",
        "user_type"
    ]);

    for (const key of Object.keys(fields)) {
        if (!userKYCColumns.has(key)) {
            return key
        }
    }


    return null;
}
