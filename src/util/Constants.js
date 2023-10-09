  /* Defining the routes for the user. */
  exports.user = {
    addUser: "/employee/add",
    signup: "/auth/signup",
    signin: "/auth/signin",
  };

  exports.csv = {
    importCsv: "/csv/import"
  }

  exports.responseCodes = {
    continue: 100,
    success: 200, // OK
    successCreated: 201,
    accepted: 202,
    successNoRecords: 204, // No Content: The server successfully processed the request, but is not returning any content
    badRequest: 400, // if parameter missing
    unauthenticated: 401, // if token is invalid
    unauthorized: 403, // if token is invalid
    notFound: 404, // Not Found
    conflict: 409, // Conflict
    unsupportedMediaType: 412, //media format of requested data not supported by server, server rejects request
    tooManyRequest: 429, //too many request in the given amount of time ("rate limiting")
    sessionExpired: 440, // if the token is expired
    serverError: 500, // Server in the situation that it does not know how to handle.
    notImplemented: 501, // Request method not supported
    badGateway: 502, // Invalid Response.
    httpNotSupported: 505, // Version Not supported by the server
  };
  
  /* The message object which is used to store the messages that are to be displayed to the user. */
exports.messages = {
    success: "SUCCESS",
    failure: "FAILURE",
    unauthorized: "You Are Unauthorized!", 
    serverError: "INTERNAL SERVER ERROR", 
    sessionExpired: "SESSION EXPIRED",
    parameterMissing: "Parameter Missing", 
    unauthenticated: "You are not authenticated user.",
    tokenMissing: "TOKEN MISSING",
    tokenGenerate: "TOKEN GENERATED!", 
    conflict: "CONFLICT",
    userCreated: "USER CREATED",
    user: "USER",
    signin: "SIGNED",
    incorrectDetails: "PLEASE ENTER THE CORRECT EMAIL AND PASSWORD",
    incorrectPassword: "PLEASE ENTER THE CORRECT PASSWORD"
  };


/* This is a function which is used to display the success message. */
exports.success = (name) => `${name} SUCCESSFULLY!`;

/* This is a function which is used to update the data with success message . */
exports.update = (name) => `${name} UPDATED SUCCESSFULLY!`;

/* This is a function which is used to display the success message. */
exports.deleted = (name) => `${name} DELETED SUCCESSFULLY!`;

/* This is a function which is used to display the error message with no content. */
exports.dataNotAdded = (name) => `${name} NOT ADDED`;

exports.conflict = (name) => `${name} ALREADY EXIST`