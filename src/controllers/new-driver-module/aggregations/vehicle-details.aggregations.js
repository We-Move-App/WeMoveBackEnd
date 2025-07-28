const VehicleDetail = require("../../../models/new-driver-module/vehicle-details/vehicle-details.model");

const getVehicleDetailsWithDocs = async (driverId, documentTypes) => {
  const result = await VehicleDetail.aggregate([
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
        documents: {
          $filter: {
            input: { $arrayElemAt: ["$docInfo.documents", 0] },
            as: "doc",
            cond: { $in: ["$$doc.documentType", documentTypes] },
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

module.exports = { getVehicleDetailsWithDocs };
