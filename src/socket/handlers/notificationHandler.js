const NotificationModel = require("../../models/notification-module/notification.model");
const { getIO } = require("../index");

/**
 * Send notification to admins via Socket.IO and save in DB
 * @param {Object} params
 * @param {Array} params.recipients - Array of { adminId, role, isRead }
 * @param {String} params.type - Notification type
 * @param {String} params.title - Notification title
 * @param {String} params.message - Notification message
 * @param {String} [params.referenceId] - Related model ID
 * @param {String} [params.referenceModel] - Related model name
 * @param {String} [params.createdBy] - Creator (driverId or system)
 */
const sendNotification = async ({
  recipients,
  type,
  title,
  message,
  referenceId = null,
  referenceModel = null,
  createdBy = "system",
}) => {
  try {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      console.warn("No recipients provided for notification:", title);
      return null;
    }

    // Save notification in DB
    const notification = await NotificationModel.create({
      type,
      title,
      message,
      referenceId,
      referenceModel,
      createdBy,
      recipients,
    });

    // Emit via Socket.IO
    const io = getIO();
    const adminNamespace = io.of("/admin");

    const emittedRoles = new Set();

    recipients.forEach((r) => {
      if (r.adminId) {
        adminNamespace
          .to(r.adminId.toString())
          .emit("notification:new", notification);
      } else if (r.role && !emittedRoles.has(r.role)) {
        adminNamespace.to(r.role).emit("notification:new", notification);
        emittedRoles.add(r.role);
      }
    });

    console.log(
      `Notification sent to recipients: ${recipients.map((r) => r.role).join(", ")}`
    );
    return notification;
  } catch (err) {
    console.error("Error sending notification:", err);
    throw err;
  }
};

module.exports = { sendNotification };
