const Joi = require("joi");
const { DriverDocEnum } = require("../../../utils/constants/ENUM");

const addBankDetailsValidation = Joi.object({
  accountNumber: Joi.string().pattern(/^\d+$/).required().messages({
    "string.pattern.base": "Account number must contain only digits",
    "string.empty": "Account number is required",
  }),

  holderName: Joi.string()
    .min(3)
    .max(100)
    .pattern(/^[A-Za-z\s]+$/)
    .required()
    .messages({
      "string.pattern.base": "Holder name must contain only letters and spaces",
      "string.empty": "Holder name is required",
      "string.min": "Holder name must be at least 3 characters",
      "string.max": "Holder name must be at most 100 characters",
    }),

  document: Joi.object({
    documentType: Joi.string()
      .valid(DriverDocEnum.PASSBOOK)
      .required()
      .messages({
        "any.only": "Document type must be 'passbook'",
      }),
    fileUrl: Joi.string().uri().required().messages({
      "string.uri": "File URL must be a valid URI",
    }),
    fileName: Joi.string().required().messages({
      "string.empty": "File name is required",
    }),
  }).required(),
});

module.exports = { addBankDetailsValidation };
