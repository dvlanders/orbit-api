const cron = require('cron');
const User = require("../../models/userAuth");
const axios = require("axios");
let time = new Date();
const hours = time.getHours()
const minutes = time.getMinutes()


async function regeneration(){
  let data
  const count = await User.scan().exec()
  for(let i=0;i <count.length;i++){
    data = count[i]
  }
  
        let apiPath = `${process.env.SFX_BASE_URL}/v1/enterprise/user-tokens/${data.sfox_id}`;
        let response = axios({
          method: "post",
          url: apiPath,
          headers: {
            Authorization: `Bearer ${process.env.SFOX_ENTERPRISE_API_KEY}`,
          },
        });
        
        let update_user_authtoken = User.update(
          { user_id: data.user_id },
          { userToken: response?.data?.data?.token }
        );
    
        if(update_user_authtoken) console.log("Token updated successfully")
      
    }
// const job = new cron.CronJob('48 18 * * *', () => {
 regeneration()

// })

// job.start();
