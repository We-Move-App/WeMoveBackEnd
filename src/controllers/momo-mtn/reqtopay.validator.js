const Joi = require("joi");
const { WalletCurrencyEnum } = require("../../utils/constants/ENUM");

const requestToPayValidation = Joi.object({
  userId: Joi.string().required(),
  phone: Joi.string().required(), 
  amount: Joi.number().positive().required(),
  currency: Joi.string().valid(...Object.values(WalletCurrencyEnum)).required(),
  description: Joi.string().optional(),
});

module.exports = { requestToPayValidation };
