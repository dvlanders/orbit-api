// {
//     "openapi": "3.0.0",
//     "info": {
//       "version": "1.0.0",
//       "title": "OrderConfirmed"
//     },
//     "paths": {},
//     "components": {
//       "schemas": {
//         "AWSEvent": {
//           "type": "object",
//           "required": [
//             "detail-type",
//             "resources",
//             "detail",
//             "id",
//             "source",
//             "time",
//             "region",
//             "account"
//           ],
//           "x-amazon-events-detail-type": "Order Confirmed",
//           "x-amazon-events-source": "edu.svc.orders",
//           "properties": {
//             "detail": {
//               "$ref": "#/components/schemas/OrderConfirmed"
//             },
//             "account": {
//               "type": "string"
//             },
//             "detail-type": {
//               "type": "string"
//             },
//             "id": {
//               "type": "string"
//             },
//             "region": {
//               "type": "string"
//             },
//             "resources": {
//               "type": "array",
//               "items": {
//                 "type": "string"
//               }
//             },
//             "source": {
//               "type": "string"
//             },
//             "time": {
//               "type": "string",
//               "format": "date-time"
//             }
//           }
//         },
//         "OrderConfirmed": {
//           "type": "object",
//           "properties": {
//             "id": {
//               "type": "number",
//               "format": "int64"
//             },
//             "status": {
//               "type": "string"
//             },
//             "currency": {
//               "type": "string"
//             },
//             "customer": {
//               "$ref": "#/components/schemas/Customer"
//             },
//             "items": {
//               "type": "array",
//               "items": {
//                 "$ref": "#/components/schemas/Item"
//               }
//             }
//           }
//         },
//         "Customer": {
//           "type": "object",
//           "properties": {
//             "firstName": {
//               "type": "string"
//             },
//             "lastName": {
//               "type": "string"
//             },
//             "email": {
//               "type": "string"
//             }
//           }
//         },
//         "Item": {
//           "type": "object",
//           "properties": {
//             "sku": {
//               "type": "number",
//               "format": "int64"
//             },
//             "name": {
//               "type": "string"
//             },
//             "price": {
//               "type": "number",
//               "format": "double"
//             },
//             "quantity": {
//               "type": "number",
//               "format": "int32"
//             }
//           }
//         }
//       }
//     }
//   }