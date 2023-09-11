const { responseCode, messages } = require("./index");

const {success, update, dataNotAdded, deleted, conflict} = require("./Constants");

exports.response = (status, message, data) => {
    return {
      status,
      message,
      response: data || {},
    };
  };

//________________ ERROR RESPONSE _____________________________//
exports.errorResponse = (err) => {
  return this.response(
    responseCode.serverError,
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
  return this.response(responseCode.unauthorized, messages.unauthorized);
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

exports.conflict = (name) =>{
  return this.response(responseCode.conflict, conflict(name))
};

exports.incorrectDetails = () => {
  return this.response(responseCode.unauthorized, messages.incorrectDetails);
};