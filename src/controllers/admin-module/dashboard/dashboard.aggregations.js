// const moment = require("moment");
// const TransactionModel = require("../../../models/transaction-module/transaction.model");

// const getMonthlyRevenue = async (matchStage) => {
//   matchStage.createdAt = {
//     $gte: moment().startOf("year").toDate(),
//     $lte: moment().endOf("year").toDate(),
//   };

//   const agg = await TransactionModel.aggregate([
//     { $match: matchStage },
//     {
//       $group: {
//         _id: { month: { $month: "$createdAt" } },
//         revenue: { $sum: "$amount" },
//       },
//     },
//     { $project: { _id: 0, month: "$_id.month", revenue: 1 } },
//     { $sort: { month: 1 } },
//   ]);

//   const currentMonth = moment().month() + 1;
//   const months = Array.from({ length: currentMonth }, (_, i) => i + 1);

//   return months.map((m) => {
//     const found = agg.find((r) => r.month === m);
//     return {
//       month: moment()
//         .month(m - 1)
//         .format("MMM"),
//       revenue: found ? found.revenue : 0,
//     };
//   });
// };

// const getYearlyRevenue = async (matchStage) => {
//   const agg = await TransactionModel.aggregate([
//     { $match: matchStage },
//     {
//       $group: {
//         _id: { year: { $year: "$createdAt" } },
//         revenue: { $sum: "$amount" },
//       },
//     },
//     { $project: { _id: 0, year: "$_id.year", revenue: 1 } },
//     { $sort: { year: 1 } },
//   ]);

//   const currentYear = moment().year();
//   const years = Array.from(
//     { length: currentYear - 2020 + 1 },
//     (_, i) => 2020 + i
//   );

//   return years.map((y) => {
//     const found = agg.find((r) => r.year === y);
//     return { year: y, revenue: found ? found.revenue : 0 };
//   });
// };

// const getWeeklyRevenue = async (matchStage) => {
//   const startOfMonth = moment().startOf("month").toDate();
//   const endOfMonth = moment().endOf("month").toDate();

//   matchStage.createdAt = { $gte: startOfMonth, $lte: endOfMonth };

//   const agg = await TransactionModel.aggregate([
//     { $match: matchStage },
//     {
//       $addFields: {
//         weekOfMonth: {
//           $add: [
//             {
//               $floor: {
//                 $divide: [
//                   { $subtract: ["$createdAt", startOfMonth] },
//                   1000 * 60 * 60 * 24 * 7,
//                 ],
//               },
//             },
//             1,
//           ],
//         },
//       },
//     },
//     {
//       $group: {
//         _id: { week: "$weekOfMonth" },
//         revenue: { $sum: "$amount" },
//       },
//     },
//     { $project: { _id: 0, week: "$_id.week", revenue: 1 } },
//     { $sort: { week: 1 } },
//   ]);

//   const currentWeekOfMonth =
//     moment().week() - moment().startOf("month").week() + 1;
//   const weeks = Array.from({ length: currentWeekOfMonth }, (_, i) => i + 1);

//   return weeks.map((w) => {
//     const found = agg.find((r) => r.week === w);
//     return { week: w, revenue: found ? found.revenue : 0 };
//   });
// };

// // ----------------- Trend Helper -----------------
// const calculateTrend = (result) => {
//   if (result.length > 1) {
//     const last = result[result.length - 1].revenue;
//     const prev = result[result.length - 2].revenue;

//     let percentage = 0;
//     if (prev === 0 && last > 0) {
//       // Special case: no revenue before, now we have revenue
//       percentage = last;
//     } else if (prev !== 0) {
//       percentage = ((last - prev) / prev) * 100;
//     }

//     return {
//       status:
//         percentage > 0
//           ? "increased"
//           : percentage < 0
//             ? "decreased"
//             : "no_change",
//       percentage: Math.abs(Number(percentage.toFixed(2))),
//     };
//   }
//   return null;
// };

// module.exports = {
//   calculateTrend,
//   getWeeklyRevenue,
//   getYearlyRevenue,
//   getMonthlyRevenue,
// };
