const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Transfer = require("./../models/transfer");
const User = require("./../models/userAuth");
let baseUrl = process.env.SFOX_BASE_URL;
let token = process.env.SFOX_ENTERPRISE_API_KEY;
let uuid = uuidv4();
const { sendEmail, common } = require("../util/helper");
const { responseCode, rs } = require("../util");
//Transfer


exports.deposite = async (req,res) => {
    try{
        const {currency} = req.query;
        const {user_id} = req.params;
    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
        let apiPath = `${baseUrl}/v1/user/deposit/address/${currency}`;
        let response = await axios({
          method: "get",
          url: apiPath,
          headers: {
            Authorization: "Bearer " + userDetails.userToken,
          },
          query: currency,
        });
        return res
        .status(response.status)
        .json({ message: response.data.data });

    }catch(error){
        return res.status(error.response.status).send(error.response.data);
    }

},


exports.walletTransfer = async (req, res) => {
  try {
    let data = {
        currency: req.body.currency,
        quantity: req.body.quantity,
        from_wallet: req.body.from_wallet,
        to_wallet: req.body.to_wallet
    };
    const {user_id} = req.params;
    const userDetails = await User.get(user_id);
    if (userDetails == undefined) {
      common.eventBridge("USER NOT FOUND", responseCode.badRequest);
      return res
        .status(responseCode.badRequest)
        .json(rs.incorrectDetails("USER NOT FOUND", {}));
    }
    // if (req.body.quantity < 11)
    //   return res
    //     .status(responseCode.serverError)
    //     .json(rs.errorResponse("QUANTITY MUST BE GREATER THAN 11", {}));
    data.transfer_id = uuidv4();
    let apiPath = `${baseUrl}/v1/account/transfer`;
    let response = await axios({
      method: "post",
      url: apiPath,
      headers: {
        Authorization: "Bearer " + userDetails.userToken,
      },
      data: data,
    });
    if (response.data) {
      const transfers = new Transfer({
        user_id: response.data.data.user_id,
        type: response.data.data.type,
        purpose: response.data.data.purpose,
        description: response.data.data.description,
        currency: response.data.data.currency,
        quantity: response.data.data.quantity,
        rate: response.data.data.rate,
        transfer_id: response.data.data.transfer_id,
        transfer_status_code: response.data.data.transfer_status_code,
        atx_id_charged: response.data.data.atx_id_charged,
        atx_id_credited: response.data.data.atx_id_credited,
        atx_status_charged: response.data.data.atx_status_charged,
        atx_status_credited: response.data.data.atx_status_credited,
        transfer_date: response.data.data.transfer_date,
      });
    //   let transferAdded = await transfers.save();
    //   if (transferAdded)
        return res
          .status(response.status)
          .json({ message: response.data.data });
    }
  } catch (error) {
    common.eventBridge(error?.message.toString(), responseCode.serverError);
    return res.status(error.response.status).send(error.response.data);
  }
};