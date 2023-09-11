exports.signup = {
    title: 'Signup request payload',
    type: "object",
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
    email: {
          type: "string"
        },
    password: {
            minLength: 3,
            type: "string"
        },
    },
  }

  exports.signin = {
    title: 'Signin request payload',
    type: "object",
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
      email: {
            type: "string"
          },
      password: {
            minLength: 3,
            type: "string"
        },
    },
  }