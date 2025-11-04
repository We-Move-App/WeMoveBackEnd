// const { AccessTokenModel } = require("../../models/token/token.model");

// const sessionHandler = (socket, io) => {
//   socket.on("user:session", async (data, ack) => {
//     try {
//       const userId = data?.userId?.toString?.() || data?.userId;
//       if (!userId) {
//         return ack({ success: false, error: "userId required" });
//       }

//       socket.join(userId);

//       const latest = await AccessTokenModel.findOne({ user: userId })
//         .select("token updatedAt createdAt")
//         .lean();

//       if (!latest) {
//         return ack({ success: false, error: "no lates token" });
//       }

//       return ack({
//         success: true,
//         token: latest.token,
//       });
//     } catch (error) {
//       console.error("user:session error:", err);
//       return ack({ success: false, error: "server_error" });
//     }
//   });
// };

// module.exports = { sessionHandler };
