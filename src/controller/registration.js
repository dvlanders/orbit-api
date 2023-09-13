const axios = require('axios')
const { v4: uuidv4 } = require('uuid');

let uuid = uuidv4()
let token = process.env.SFOX_ENTERPRISE_API_KEY

exports.register = async(req,res) => {
 
  // let data ={
  //   "account_type": "business",
  //         "first_name": "Sean",
  //         "last_name": "Fox",
  //         "email": "kaushit049@abesit.edu.in",
  //         "phone_country_code": "US",
  //         "phone_number": "+12223334444",
  //         "account_role": "advisor",
  //         "user_id": uuid,
  //         "advisor_user_id": "advisor_account_1",
  //         "account_purpose": "Investing",
  //         "individual": 
  //             {
  //                 "dob": "1990-10-15",
  //                 "residential_country_code": "US",
  //                 "residential_address": "123 sFOX Lane",
  //                 "residential_city": "Los Angeles",
  //                 "residential_state": "CA",
  //                 "residential_postal_code": "90403",
  //                 "id_type": "passport",
  //                 "id_number": "123456789",
  //                 "id_country_code": "US"
  //             }
  //   }

    let data = req.body
    data.user_id = uuid
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





exports.requestOTP = async(req,res) => {
  let userId = req.params.userId;
  let apiPath = `https://api.staging.sfox.com/v1/enterprise/users/send-verification/${userId}`;
  // let data = {
  //   "type" : "email"
  // }
  await axios({
    method: 'post',
    url: apiPath,
    headers: {
      'Authorization': 'Bearer ' + token
    },
    data: req.body
      
  }).then(response => {
    res.status(response.status).send(response.data)
  }).catch(err => {
    res.status(err.response.status).send(err.response.data)
    
  });
}

exports.verify = async(req,res) => {
  let userId = req.params.userId;
  let apiPath = `https://api.staging.sfox.com/v1/enterprise/users/verify/${userId}`;
  // let data = {
  //   "type" : "email",
  //   "otp" : "192953"
  // } 
  await axios({
    method: 'post',
    url: apiPath,
    headers: {
      'Authorization': 'Bearer ' + token
    },
    data: req.body
      
  }).then(response => {
    res.status(response.status).send(response.data)
  }).catch(err => {
    res.status(err.response.status).send(err.response.data)
    
  });

}
