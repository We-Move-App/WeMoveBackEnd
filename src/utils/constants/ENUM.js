const DriverBasicStatus = {
  PENDING: "pending",
  APPROVED: "approved",
};

const EntityCodeEnum = {
  DRIVER: "driver",
  USER: "user",
  HOTEL: "hotel",
  ADMIN: "admin",
  RIDES: "rides",
  BUSDRIVER: "busDriver",
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

const TicketStatusEnum = {
  OPEN: "open",
  INPROGRESS: "in_progress",
  CLOSED: "closed",
};

const RideBookStatusEnum = {
  REQUESTED: "requested",
  RECEIVED: "received",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  ARRIVED: "arrived",
  STARTED: "started",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const PaymentStatusEnum = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
};

const LocationStatusEnum = {
  ONLINE: "online",
  OFFLINE: "offline",
  ONTRIP: "on_trip",
};

const BookCancelledByEnum = {
  DRIVER: "driver",
  USER: "user",
  SYSTEM: "system",
};

const TransactionTypeEnum = {
  CREDIT: "CREDIT",
  DEBIT: "DEBIT",
};

const WalletCurrencyEnum = {
  XAF: "XAF",
  USD: "USD",
  EUR: "EUR",
  INR: "INR",
};

module.exports = {
  DriverBasicStatus,
  EntityCodeEnum,
  GenderEnum,
  DriverDocEnum,
  DriverDocStatusEnum,
  VehicleTypeEnum,
  TicketStatusEnum,
  RideBookStatusEnum,
  PaymentStatusEnum,
  LocationStatusEnum,
  BookCancelledByEnum,
  TransactionTypeEnum,
  WalletCurrencyEnum,
};
