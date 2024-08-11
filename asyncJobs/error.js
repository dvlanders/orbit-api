const JobErrorType = {
	INTERNAL_ERROR: "INTERNAL_ERROR",
	RESCHEDULE: "RESCHEDULE"
};

class JobError extends Error {
	constructor(type, message, rawResponse, json, needToReschedule, logging=true) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
        this.json = json
        this.needToReschedule = needToReschedule
		this.logging = logging
		Object.setPrototypeOf(this, JobError.prototype);
	}
}

module.exports = {
    JobError,
    JobErrorType
}