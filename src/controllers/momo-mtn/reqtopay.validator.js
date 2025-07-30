const Joi = require("joi");
const { WalletCurrencyEnum } = require("../../utils/constants/ENUM");

const requestToPayValidation = Joi.object({
  amount: Joi.number().positive().required(),
  description: Joi.string().optional(),
});

module.exports = { requestToPayValidation };
