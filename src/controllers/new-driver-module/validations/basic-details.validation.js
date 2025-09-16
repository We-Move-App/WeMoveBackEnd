const Joi = require("joi");
const mongoose = require("mongoose");
const { DriverDocEnum, GenderEnum } = require("../../../utils/constants/ENUM");

const addBasicDetailsValidation = Joi.object({
  fullName: Joi.string()
    .min(3)
    .max(100)
    .pattern(/^[A-Za-z\s]+$/)
    .required()
    .messages({
      "string.pattern.base": "Full name must contain only letters and spaces",
    }),
  gender: Joi.string()
    .valid(...Object.values(GenderEnum))
    .required(),
  dob: Joi.date().iso().required(),
  age: Joi.number().integer().min(18).max(100).required(),
  experience: Joi.number().integer().min(0).max(80).required(),
  address: Joi.string().min(5).max(250).required(),
  termsAccepted: Joi.boolean().valid(true).required().messages({
    "any.only": "Terms must be accepted.",
  }),
  branch: Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid", {
        message: "Invalid branch ObjectId",
      });
    }
    return value;
  }, "ObjectId validation"),
  documents: Joi.array()
    .length(2)
    .items(
      Joi.object({
        documentType: Joi.string()
          .valid(DriverDocEnum.IDCARD, DriverDocEnum.LICENSE)
          .required(),
        fileUrl: Joi.string().uri().required(),
        fileName: Joi.string().required(),
      })
    )
    .required()
    .custom((value, helpers) => {
      const types = value.map((doc) => doc.documentType);
      const hasIdCard =
        types.filter((t) => t === DriverDocEnum.IDCARD).length === 1;
      const hasLicense =
        types.filter((t) => t === DriverDocEnum.LICENSE).length === 1;
      if (!hasIdCard || !hasLicense) {
        return helpers.error("any.invalid", {
          message: "Exactly one 'id_card' and one 'license' are required.",
        });
      }
      return value;
    }, "Documents validation"),
})
  .custom((obj, helpers) => {
    if (obj.experience >= obj.age) {
      return helpers.error("any.custom", {
        message: "Experience cannot exceed or equal to age",
      });
    }
    return obj;
  }, "Experience vs Age validation")
  .messages({
    "any.custom": "{{#message}}",
  });

module.exports = { addBasicDetailsValidation };
