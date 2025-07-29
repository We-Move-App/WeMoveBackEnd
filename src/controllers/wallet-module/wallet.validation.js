const Joi = require("joi");
const { WalletCurrencyEnum } = require("../../utils/constants/ENUM");

const walletValidation = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().valid(...Object.values(WalletCurrencyEnum)).required(),
  description: Joi.string().optional(),
});

module.exports = { walletValidation };
