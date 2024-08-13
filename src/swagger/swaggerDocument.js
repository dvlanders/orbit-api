const fs = require("fs")
const path = require('path');
const YAML = require('yaml')

const mergeYAMLFiles = (dirPath) => {
  const filesDir = path.join(__dirname, dirPath);
  const files = fs.readdirSync(filesDir);
  let combinedDoc = {};
  files.forEach(file => {
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const filePath = path.join(filesDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const parsedContent = YAML.parse(fileContent);
      combinedDoc = { ...combinedDoc, ...parsedContent };
    }
  });
  return combinedDoc;
}

const saveOpenAPIFile = (swaggerDocument) => {
  const outputFilePath = path.join(__dirname, 'openapi.json');
  fs.writeFileSync(outputFilePath, JSON.stringify(swaggerDocument, null, 2), 'utf8');
  console.log(`OpenAPI document has been exported to ${outputFilePath}`);
}

const combinedDoc = mergeYAMLFiles("./docs")
const combinedParameters = mergeYAMLFiles("./parameters")
const combinedRequestBodies = mergeYAMLFiles("./requestBodies")
const combinedResponses = mergeYAMLFiles("./responses")
const combinedSchemas = mergeYAMLFiles("./schemas")

// Swagger definition
const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Hifi API",
    version: "1.0.0",
    description: "API documentation for Hifi",
  },
  servers: [
    {
      url: "https://production.hifibridge.com",
      description: "Production server",
    },
    {
      url: "https://sandbox.hifibridge.com",
      description: "Sandbox server",
    },
  ],
  tags: [
    {
      name: "Common",
      description: "Common endpoints"
    },
    {
      name: "User",
      description: "User endpoints"
    },
    {
      name: "Account",
      description: "Account endpoints"
    },
    {
      name: "Transfer",
      description: "Transfer endpoints"
    },
    {
      name: "Quotes",
      description: "Quotes endpoints"
    }
  ],
  components: {
    securitySchemes:
    {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      },
    },
    parameters: combinedParameters,
    requestBodies: combinedRequestBodies,
    responses: combinedResponses,
    schemas: combinedSchemas
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: combinedDoc
};

saveOpenAPIFile(swaggerDocument);

module.exports = swaggerDocument;
