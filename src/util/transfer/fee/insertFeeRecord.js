const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

exports.insertFeeRecord = async(record) => {
        const {data: feeRecord, error: feeRecordError} = await  supabaseCall(() => supabase
        .from("developer_fees")
        .insert(record)
        .select("*")
        .single()
    )
    if (feeRecordError) throw feeRecordError
    return feeRecord
}