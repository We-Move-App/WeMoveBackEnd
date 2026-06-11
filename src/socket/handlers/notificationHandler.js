const NotificationModel = require("../../models/notification-module/notification.model");
const { getIO } = require("../index");

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

    const normalizedTitle =
      typeof title === "string"
        ? { en: title, fr: title }
        : {
            en: title.en,
            fr: title.fr || title.en,
          };

    const normalizedMessage =
      typeof message === "string"
        ? { en: message, fr: message }
        : {
            en: message.en,
            fr: message.fr || message.en,
          };

    const notification = await NotificationModel.create({
      type,
      title: normalizedTitle,
      message: normalizedMessage,
      referenceId,
      referenceModel,
      createdBy,
      recipients,
    });

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
