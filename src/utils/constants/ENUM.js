const DriverBasicStatus = {
  PENDING: "pending",
  APPROVED: "approved",
};

const EntityCodeEnum = {
  DRIVER: "driver",
  USER: "user",
  HOTEL: "hotel",
  ADMIN: "admin",
};

const GenderEnum = {
  MALE: "male",
  FEMALE: "female",
};

const DriverDocEnum = {
  IDCARD: "id_card",
  LICENSE: "license",
  INSURANCE: "insurance",
  REGISTRATION: "registration",
  VEHICLEPHOTO: "vehicle_photo",
  PASSBOOK: "passbook",
  AVATAR: "avatar",
};

const DriverDocStatusEnum = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const VehicleTypeEnum = {
  TAXI: "taxi",
  BIKE: "bike",
};

module.exports = {
  DriverBasicStatus,
  EntityCodeEnum,
  GenderEnum,
  DriverDocEnum,
  DriverDocStatusEnum,
  VehicleTypeEnum
};
