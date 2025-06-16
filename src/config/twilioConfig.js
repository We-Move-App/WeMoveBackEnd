const twilio = require("twilio");

const { twilio_account_sid, twilio_auth_token } = require("./config");

const twilioClient = new twilio(twilio_account_sid, twilio_auth_token);

module.exports = twilioClient;
