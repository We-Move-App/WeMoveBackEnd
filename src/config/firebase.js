const admin = require("firebase-admin");
const serviceAccount = require("../utils/firebase/firebase-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const messaging = admin.messaging();
module.exports = messaging;
