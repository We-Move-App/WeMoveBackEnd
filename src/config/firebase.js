const admin = require("firebase-admin");

const serviceAccount = require("../utils/firebase/firebase-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firebaseMessaging = admin.messaging();
module.exports = firebaseMessaging;
