const JobErrorType = {
	INTERNAL_ERROR: "INTERNAL_ERROR",
	RESCHEDULE: "RESCHEDULE"
};

class JobError extends Error {
	constructor(type, message, rawResponse, json, needToReschedule) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
        this.json = json
        this.needToReschedule = needToReschedule
		Object.setPrototypeOf(this, JobError.prototype);
	}
}

module.exports = {
    JobError,
    JobErrorType
}