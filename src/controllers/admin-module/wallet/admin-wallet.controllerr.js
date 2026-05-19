// controllers/admin/transactions.controller.js
const statusCode = require("../../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const Transaction = require("../../../models/transaction-module/transaction.model");
const ApiResponse = require("../../../utils/response/ApiResponse");

/* ----------------------------- helpers ----------------------------- */

function assertSuperAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }
  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);
  if (!decoded || decoded.role !== "SuperAdmin") {
    throw new ApiError(statusCode.UNAUTHORIZED, "Unauthorized access");
  }
  return decoded._id;
}

function parseQueryParams(qs) {
  const {
    page: pageQuery,
    limit: limitQuery,
    id: transactionId,
    query: q,
    search: qAlt,
    type: typeQuery,
    status: statusQuery,
    includeTotals,
  } = qs;

  const page = Math.max(parseInt(pageQuery, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(limitQuery, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const rawSearch = (q ?? qAlt ?? "").trim();
  const wantTotals = includeTotals !== "false";

  return {
    page,
    limit,
    skip,
    transactionId,
    rawSearch,
    typeQuery,
    statusQuery,
    wantTotals,
  };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const looksLikeUUID = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );

function normalizeTypes(typeQuery) {
  if (!typeQuery) return null;
  const types = String(typeQuery)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((t) => t === "CREDIT" || t === "DEBIT");
  return types.length ? types : null;
}

function normalizeStatuses(statusQuery) {
  if (!statusQuery) return null;
  const statusMap = {
    FAILED: "FAILED",
    COMPLETED: "SUCCESS",
    PENDING: "PENDING",
    SUCCESS: "SUCCESS",
  };
  const statuses = String(statusQuery)
    .split(",")
    .map((s) => statusMap[s.trim().toUpperCase()] ?? s.trim().toUpperCase())
    .filter((s) => ["FAILED", "SUCCESS", "PENDING"].includes(s));
  return statuses.length ? statuses : null;
}

function buildMatch(superAdminId, { rawSearch, typeQuery, statusQuery }) {
  const match = { adminId: superAdminId };

  if (rawSearch) {
    if (looksLikeUUID(rawSearch)) {
      match.transactionId = rawSearch; // exact
    } else {
      // prefix, case-insensitive via denormalized lowercase
      match.usernameLower = {
        $regex: `^${escapeRegex(rawSearch.toLowerCase())}`,
      };
    }
  }

  const types = normalizeTypes(typeQuery);
  if (types) match.type = { $in: types };

  const statuses = normalizeStatuses(statusQuery);
  if (statuses) match.status = { $in: statuses };

  return match;
}

/**
 * Builds the $facet for:
 *  - data page (including user enrichment and serviceType derivation)
 *  - meta (totalRecords)
 *  - totals (credit/debit across filtered set) — optional
 */
function buildFacet(skip, limit, wantTotals) {
  const dataStages = [
    // Enrich from users (if denormalized already, remove these two stages)
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
        pipeline: [{ $project: { _id: 0, name: 1, role: 1, username: 1 } }],
      },
    },
    {
      $addFields: {
        name: { $ifNull: [{ $arrayElemAt: ["$user.name", 0] }, "$name"] },
        role: { $ifNull: [{ $arrayElemAt: ["$user.role", 0] }, "$role"] },
        username: {
          $ifNull: [{ $arrayElemAt: ["$user.username", 0] }, "$username"],
        },
      },
    },

    // Derive serviceType via self-lookup on bookingId (avoids N+1 queries)
    {
      $lookup: {
        from: "transactions",
        let: { bId: "$bookingId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$bookingId", "$$bId"] } } },
          {
            $match: {
              $or: [
                { driverId: { $ne: null } },
                { busOperatorId: { $ne: null } },
                { hotelManagerId: { $ne: null } },
              ],
            },
          },
          { $project: { driverId: 1, busOperatorId: 1, hotelManagerId: 1 } },
          { $limit: 1 },
        ],
        as: "relatedTxn",
      },
    },
    {
      $addFields: {
        serviceType: {
          $let: {
            vars: { r: { $arrayElemAt: ["$relatedTxn", 0] } },
            in: {
              $switch: {
                branches: [
                  {
                    case: { $ne: ["$$r.driverId", null] },
                    then: "ride booking",
                  },
                  {
                    case: { $ne: ["$$r.busOperatorId", null] },
                    then: "bus booking",
                  },
                  {
                    case: { $ne: ["$$r.hotelManagerId", null] },
                    then: "hotel booking",
                  },
                ],
                default: undefined,
              },
            },
          },
        },
      },
    },

    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        transactionId: 1,
        name: 1,
        role: 1,
        username: 1,
        type: 1,
        amount: 1,
        date: "$createdAt",
        status: 1,
        description: 1,
        serviceType: 1,
      },
    },
  ];

  const facet = {
    data: dataStages,
    meta: [{ $count: "totalRecords" }],
  };

  if (wantTotals) {
    facet.totals = [
      {
        $group: {
          _id: null,
          creditTotal: {
            $sum: { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0] },
          },
          debitTotal: {
            $sum: { $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0] },
          },
        },
      },
    ];
  }

  return facet;
}

async function fetchSingleTransaction(superAdminId, transactionId) {
  const txn = await Transaction.findOne({
    transactionId,
    adminId: superAdminId,
  }).lean();
  if (!txn) return null;

  // compute serviceType in one extra query (kept simple here)
  if (txn.bookingId) {
    const related = await Transaction.findOne({
      bookingId: txn.bookingId,
      $or: [
        { driverId: { $ne: null } },
        { busOperatorId: { $ne: null } },
        { hotelManagerId: { $ne: null } },
      ],
    }).lean();
    if (related) {
      if (related.driverId) txn.serviceType = "ride booking";
      else if (related.busOperatorId) txn.serviceType = "bus booking";
      else if (related.hotelManagerId) txn.serviceType = "hotel booking";
    }
  }
  return txn;
}

async function runListAggregate(match, skip, limit, wantTotals) {
  const pipeline = [
    { $match: match },
    { $sort: { createdAt: -1, _id: -1 } },
    { $facet: buildFacet(skip, limit, wantTotals) },
  ];

  const [agg] = await Transaction.aggregate(pipeline).allowDiskUse(true);
  const data = agg?.data ?? [];
  const totalRecords = agg?.meta?.[0]?.totalRecords ?? 0;
  const totals = agg?.totals?.[0] ?? {};
  const creditTotal = wantTotals ? (totals.creditTotal ?? 0) : 0;
  const debitTotal = wantTotals ? (totals.debitTotal ?? 0) : 0;

  return { data, totalRecords, creditTotal, debitTotal };
}

/* ----------------------------- controller ----------------------------- */

const getTransactionsSuperAdmin = catchAsyncError(async (req, res) => {
  assertSuperAdmin(req);
  const ln = req.get("ln") || "en";

  const {
    page,
    limit,
    skip,
    transactionId,
    rawSearch,
    typeQuery,
    statusQuery,
    wantTotals,
  } = parseQueryParams(req.query);

  // ---------------- SINGLE ----------------
  if (transactionId) {
    const txn = await Transaction.findOne({ transactionId }).lean();

    if (!txn) throw new ApiError(statusCode.NOT_FOUND, "Transaction not found");

    const adminEntry = (txn.entries || []).find(
      (e) => e.entityType === "ADMIN"
    );

    return res.status(statusCode.OK).json(
      new ApiResponse(
        statusCode.OK,
        {
          transactionId: txn.transactionId,
          type: adminEntry?.type,
          amount: adminEntry?.amount,
          status: txn.status,
          date: txn.createdAt,
          description:
            typeof txn.description === "object"
              ? txn.description?.[ln] || txn.description?.en || ""
              : txn.description || "",
        },
        "Transaction details fetched successfully"
      )
    );
  }

  // ---------------- MATCH ----------------
  const match = {
    "entries.entityType": "ADMIN",
  };

  if (statusQuery) {
    const statuses = normalizeStatuses(statusQuery);
    if (statuses) match.status = { $in: statuses };
  }

  if (typeQuery) {
    const types = normalizeTypes(typeQuery);
    if (types) match["entries.type"] = { $in: types };
  }

  if (rawSearch) {
    match.transactionId = { $regex: rawSearch, $options: "i" };
  }

  // ---------------- AGGREGATION ----------------
  const pipeline = [
    { $match: match },
    { $sort: { createdAt: -1, _id: -1 } },

    // extract ADMIN entry
    {
      $addFields: {
        adminEntry: {
          $first: {
            $filter: {
              input: "$entries",
              as: "e",
              cond: { $eq: ["$$e.entityType", "ADMIN"] },
            },
          },
        },
      },
    },

    // serviceType from entries
    {
      $addFields: {
        serviceType: {
          $switch: {
            branches: [
              {
                case: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$entries",
                          as: "e",
                          cond: { $eq: ["$$e.entityType", "DRIVER"] },
                        },
                      },
                    },
                    0,
                  ],
                },
                then: "ride booking",
              },
              {
                case: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$entries",
                          as: "e",
                          cond: { $eq: ["$$e.entityType", "BUS_OPERATOR"] },
                        },
                      },
                    },
                    0,
                  ],
                },
                then: "bus booking",
              },
              {
                case: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$entries",
                          as: "e",
                          cond: { $eq: ["$$e.entityType", "HOTEL"] },
                        },
                      },
                    },
                    0,
                  ],
                },
                then: "hotel booking",
              },
            ],
            default: null,
          },
        },
      },
    },

    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              transactionId: 1,
              type: "$adminEntry.type",
              amount: "$adminEntry.amount",
              date: "$createdAt",
              status: 1,
              description: 1,
              serviceType: 1,
            },
          },
        ],

        meta: [{ $count: "totalRecords" }],

        totals: wantTotals
          ? [
              {
                $group: {
                  _id: null,
                  creditTotal: {
                    $sum: {
                      $cond: [
                        { $eq: ["$adminEntry.type", "CREDIT"] },
                        "$adminEntry.amount",
                        0,
                      ],
                    },
                  },
                  debitTotal: {
                    $sum: {
                      $cond: [
                        { $eq: ["$adminEntry.type", "DEBIT"] },
                        "$adminEntry.amount",
                        0,
                      ],
                    },
                  },
                },
              },
            ]
          : [],
      },
    },
  ];

  const [agg] = await Transaction.aggregate(pipeline);

  const data = agg?.data || [];
  const totalRecords = agg?.meta?.[0]?.totalRecords || 0;
  const totals = agg?.totals?.[0] || {};

  const formattedData = data.map((txn) => ({
    ...txn,
    description:
      typeof txn.description === "object"
        ? txn.description?.[ln] || txn.description?.en || ""
        : txn.description || "",
  }));

  return res.status(statusCode.OK).json({
    page,
    limit,
    totalPages: Math.ceil(totalRecords / limit) || 1,
    totalRecords,
    creditTotal: totals.creditTotal || 0,
    debitTotal: totals.debitTotal || 0,
    data: formattedData,
  });
});

module.exports = { getTransactionsSuperAdmin };
