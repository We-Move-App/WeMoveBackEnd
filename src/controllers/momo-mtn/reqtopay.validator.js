const Joi = require("joi");

const requestToPayValidation = Joi.object({
  amount: Joi.number().positive().required(),
  description: Joi.string().optional(),
});

module.exports = { requestToPayValidation };
