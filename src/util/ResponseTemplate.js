const { responseCode, messages } = require("./index");

const {
  success,
  update,
  dataNotAdded,
  deleted,
  conflict,
  dataNotExist,
} = require("./Constants");

exports.response = (statusCode, message, data) => {
  return {
    statusCode,
    message,
    data: data || {},
  };
};

//________________ ERROR RESPONSE _____________________________//
exports.errorResponse = (err, resCode) => {
  return this.response(
    resCode || responseCode.serverError,
    messages.serverError,
    err
  );
};
// _______________ MIDDLEWARE RESPONSE ________________________//
exports.authErr = (err) => {
  return this.response(responseCode.unauthorized, messages.unauthorized, err);
};
//_____________________ INCORRECT ____________________//
exports.incorrectPassword = () => {
  return this.response(
    responseCode.unauthenticated,
    messages.incorrectPassword
  );
};

//_____________________TOKEN RESPONSE __________________________//
exports.tokenResponse = (token) => {
  return this.response(responseCode.success, messages.tokenGenerate, token);
};

//_____________________ SUCCESS RESPONSE _________________________//
exports.successResponse = (name, data) => {
  return this.response(responseCode.success, success(name), data);
};

exports.dataNotAdded = (name) => {
  return this.response(responseCode.successNoRecords, dataNotAdded(name));
};

exports.dataNotExist = (name) => {
  return this.response(responseCode.successNoRecords, dataNotExist(name));
};

exports.conflict = (name) => {
  return this.response(responseCode.conflict, conflict(name));
};

exports.incorrectDetails = (message, data) => {
  return this.response(responseCode.badRequest, message, data);
};
