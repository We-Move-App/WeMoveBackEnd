const firebaseMessaging = require("../../config/firebase");

const sendNotificationByFirebase = async ({
  deviceToken,
  title,
  body,
  customData,
}) => {
  try {
    const message = {
      token: deviceToken,
      notification: {
        title: title,
        body: body,
      },
      data: customData || {}, 
    };

    const response = await firebaseMessaging.send(message);

    return response;
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};

const sendMulticastNotification = async ({
  deviceTokens,
  title,
  body,
  customData,
}) => {
  try {
    const message = {
      tokens: deviceTokens,
      notification: {
        title: title,
        body: body,
      },
      data: customData || {}, 
    };

    const response = await firebaseMessaging.sendMulticast(message);
    console.log("Multicast notification sent successfully:", response);
    return response;
  } catch (error) {
    console.error("Error sending multicast notification:", error);
  }
};

module.exports = {
  sendNotificationByFirebase,
  sendMulticastNotification,
};
