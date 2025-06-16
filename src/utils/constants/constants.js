const documentTypes = [
  "driver_license_front",
  "driver_license_back",
  "hotel_license",
  "bus_license",
  "bank_detail",
  "vehicle_registration_certificate",
  "vehicle_insurance",
  "identity_card",
  "passport",
  "national_identity_card_front",
  "national_identity_card_back",
  "bus_license_front",
  "bus_license_back",
  "busImages",
  "vehicle_photo"
];

const userRolesTypes = [
  "guest",
  "user",
  "admin",
  "driver",
  "hotelManager",
  "busOperator",
  "superAdmin",
  "busDriver",
  "busOperatorMember",
  "HotelManagerMember",
];

const rolesTypes = ["user", "driver", "hotelManager", "busOperator"];

const busOperatorAuthorities = [
  "busManagement",
  "dashboardManagement",
  "routeManagement",
  "driverManagement",
  "ticketManagement",
  "walletManagement",
];
const adminAuthorities = [
  "userManagement",
  "busManagement",
  "driverManagement",
  "hotelManagement",
  "walletManagement",
  "reportsAnalytics",
  "notifications",
  "roleManagement"
];

const busOperatorAuthoritiesFields = {
  BUS_MANAGEMENT: "busManagement",
  DASHBOARD: "dashboardManagement",
  ROUTE_MANAGEMENT: "routeManagement",
  DRIVER_MANAGEMENT: "driverManagement",
  TICKET_MANAGEMENT: "ticketManagement",
  WALLET_MANAGEMENT: "walletManagement",
};

const RideStatus = {
  REQUESTED: "REQUESTED",
  ACCEPTED: "ACCEPTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

const PaymentStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  REFUND_REQUESTED: "REFUND_REQUESTED",
  REFUND_PROCESSING: "REFUND_PROCESSING",
  REFUNDED: "REFUNDED",
  PAID:'PAID',
};

const TypeOfUser={
    USER: "user",
    DRIVER:"driver",
    BUSOPERATOR:'busOperator',
    HOTELMANAGER:'hotelManager',
    ADMIN:'admin'
}

module.exports = {
  documentTypes,
  rolesTypes,
  busOperatorAuthorities,
  userRolesTypes,
  busOperatorAuthoritiesFields,
  RideStatus,
  PaymentStatus,
  TypeOfUser,
  adminAuthorities
};
