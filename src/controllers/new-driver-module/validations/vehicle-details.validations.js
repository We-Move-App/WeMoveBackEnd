const Joi = require("joi");
const { VehicleTypeEnum, DriverDocEnum } = require("../../../utils/constants/ENUM");

const addVehicleDetailsValidation = Joi.object({
  vehicleType: Joi.string().valid(...Object.values(VehicleTypeEnum)).required(),
  seats: Joi.number().integer().min(1).max(100).required(),
  model: Joi.string().max(100).required(),
  registrationNo: Joi.string().max(100).required(),
  documents: Joi.array()
    .length(3)
    .items(
      Joi.object({
        documentType: Joi.string()
          .valid(
            DriverDocEnum.INSURANCE,
            DriverDocEnum.REGISTRATION,
            DriverDocEnum.VEHICLEPHOTO
          )
          .required(),
        fileUrl: Joi.string().uri().required(),
        fileName: Joi.string().required(),
      })
    )
    .required()
    .custom((value, helpers) => {
      const types = value.map((doc) => doc.documentType);
      const valid =
        types.includes(DriverDocEnum.INSURANCE) &&
        types.includes(DriverDocEnum.REGISTRATION) &&
        types.includes(DriverDocEnum.VEHICLEPHOTO);
      if (!valid || new Set(types).size !== 3) {
        return helpers.error("any.invalid", {
          message: "All 3 document types (insurance, registration, vehicle_photo) are required and must be unique.",
        });
      }
      return value;
    }, "Vehicle documents validation"),
});

module.exports = { addVehicleDetailsValidation };
