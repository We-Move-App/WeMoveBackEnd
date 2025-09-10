require("dotenv").config();
const {
  addMoney,
  withdrawMoney,
  checkBalance,
  getTransactionStatus,
  checkBank,
  checkBankAccount,
  getBalance,
  getAccessToken,
  getUserBalance,
} = require("./src/utils/services/mtn.services");
const { v4: uuidv4 } = require("uuid");
// console.log(uuidv4());
// (async () => {
//     try {

//         // console.log(await getAccessToken("collections"))
//         // console.log('Wallet Balance:',  await getBalance());
//         console.log("Add Money", await addMoney(500,"256774290781"))

//     } catch (error) {

//         // console.error('Full Error:', error);
//         if (error.response) {
//             console.error('Response Data:', error.response.data);
//             console.error('Status Code:', error.response.status);
//             console.error('Headers:', error.response.headers);
//         }

//     }
// })();

const sendMoneyToAdmin = async () => {
  try {
    // Step 1: Add Money to Admin's Account
    const add_Money = await addMoney(5000, "256774290781");
    console.log("Add Money Response:", add_Money);

    // Step 2: Wait a Few Seconds for the Transaction to Process
    console.log("Waiting 5 seconds before checking transaction status...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 3: Check Transaction Status
    await checkReferenceId(add_Money.referenceId);
  } catch (error) {
    console.error("Error in sendMoneyToAdmin:", error.message);
  }
};

// Function to Check the Transaction Status
const checkReferenceId = async (referenceId) => {
  try {
    if (!referenceId) {
      throw new Error("Reference ID is missing!");
    }

    const status = await getTransactionStatus(referenceId);
    console.log("Transaction Status:", status);

    // Step 4: If Transaction is Successful, Get Updated Balance
    if (status.status === "SUCCESSFUL") {
      console.log("Transaction successful, checking wallet balance...");
      await getBalancess();
    } else {
      console.log("Transaction is still pending or failed.");
    }
  } catch (error) {
    console.error("Error checking transaction status:", error.message);
  }
};

// Function to Get Wallet Balance
const getBalancess = async () => {
  try {
    const balance = await getBalance();
    console.log("transaction:", balance);
  } catch (error) {
    console.error("Error transcation:", error.message);
  }
};
const getTransaction = async () => {
  try {
    const balance = await getTransactionStatus("caeaaea6-c6cb-43d9-af68-e10166500e65");
    console.log("Updated Transacriton:", balance);
  } catch (error) {
    console.error("Error Transacriton:", error.message);
  }
};

// getBalancess()
// // Function to Get Wallet Balance
// const getAdminBalancess = async () => {
//   try {
//     const balance = await getUserBalance("256774290781")
//     console.log("Updated Wallet Balance:", balance);
//   } catch (error) {
//     console.error("Error fetching wallet balance:", error.message);
//   }
// };

// // Start the Money Transfer Process
// getAdminBalancess()

sendMoneyToAdmin();
getTransaction()
