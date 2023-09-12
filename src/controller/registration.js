const axios = require('axios')
const { v4: uuidv4 } = require('uuid');


exports.register = async(req,res) => {
  let token = process.env.SFOX_ENTERPRISE_API_KEY
  let data ={
    "account_type": "individual",
          "first_name": "Sean",
          "last_name": "Fox",
          "email": "dzqooe@email.com",
          "phone_country_code": "US",
          "phone_number": "+12223334444",
          "account_role": "client",
          "user_id": "cebsfmms1",
          "advisor_user_id": "advisor_account_1",
          "account_purpose": "Investing",
          "individual": 
              {
                  "dob": "1990-10-15",
                  "residential_country_code": "US",
                  "residential_address": "123 sFOX Lane",
                  "residential_city": "Los Angeles",
                  "residential_state": "CA",
                  "residential_postal_code": "90403",
                  "id_type": "passport",
                  "id_number": "123456789",
                  "id_country_code": "US"
              }
    }
    const apiPath = "https://api.staging.sfox.com/v1/enterprise/register-account"
    await axios({
        method: 'post',
        url: apiPath,
        headers: {
          'Authorization': 'Bearer ' + token
        },
        data: data
          
      }).then(response => {
        res.status(response.status).send(response.data)
      }).catch(err => {
        res.status(err.response.status).send(err.response.data)
        
      });

}
