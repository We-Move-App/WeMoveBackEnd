const Wallet = require("../../models/wallet-module/wallets.model");

const generateUniqueCardNumber = async () => {
  let cardNumber;
  let exists = true;

  while (exists) {
    cardNumber = Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
    exists = await Wallet.exists({ cardNumber });
  }

  return cardNumber;
};

module.exports = generateUniqueCardNumber;
