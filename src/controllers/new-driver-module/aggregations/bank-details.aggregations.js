const DriverBankDetail = require("../../../models/new-driver-module/bank-details/bank-details.model");

const getDriverBankWithPassbook = async (driverId) => {
  const result = await DriverBankDetail.aggregate([
    { $match: { driverId } },
    {
      $lookup: {
        from: "driverdocdetails",
        localField: "driverId",
        foreignField: "driverId",
        as: "docInfo",
      },
    },
    {
      $addFields: {
        document: {
          $first: {
            $filter: {
              input: { $arrayElemAt: ["$docInfo.documents", 0] },
              as: "doc",
              cond: { $eq: ["$$doc.documentType", "passbook"] },
            },
          },
        },
      },
    },
    {
      $project: {
        docInfo: 0,
        __v: 0,
      },
    },
  ]);

  return result[0] || null;
};

module.exports = { getDriverBankWithPassbook };
