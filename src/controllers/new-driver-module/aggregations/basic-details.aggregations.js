const DriverBasicDetails=require('../../../models/new-driver-module/basic-details/basic-details.model')

const getDriverBasicWithDocs = async (driverId, documentTypes = ["id_card", "license"]) => {
  const result = await DriverBasicDetails.aggregate([
    { $match: { driverId } },
    {
      $lookup: {
        from: "driverdocdetails",
        localField: "driverId",
        foreignField: "driverId",
        as: "docInfo"
      }
    },
    {
      $addFields: {
        documents: {
          $filter: {
            input: { $arrayElemAt: ["$docInfo.documents", 0] },
            as: "doc",
            cond: { $in: ["$$doc.documentType", documentTypes] }
          }
        }
      }
    },
    {
      $project: {
        docInfo: 0,
        __v: 0
      }
    }
  ]);
  return result[0] || null;
};

module.exports = { getDriverBasicWithDocs };
