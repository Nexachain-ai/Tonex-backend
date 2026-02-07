const { sendUsdtWithdrawal } = require("../utils/wallet.token");
const { isLoggedIn, isAdminLoggedIn } = require("../middleware/authenticate.middleware");
const { TransactionModel } = require("../models/transaction.model");
const { UserModel } = require("../models/user.model");
const { generateCustomId } = require("../utils/generator.uniqueid");
const transactionController = require("../controllers/transaction.controller");
const router = require("express").Router();


router.post('/request-investment', isLoggedIn, transactionController.WalletInvestmentRequest);

router.post('/deposit-amount-wallet', isLoggedIn, transactionController.WalletDepositAmount);
router.get( '/get-deposit-history-manually', isLoggedIn, transactionController.getDepositHistory);

// --------- AUTO WITHDRAWAL REQUEST START ---------
// router.post("/request-withdrawal", isLoggedIn, transactionController.WalletWithdrawalRequest)
// --------- AUTO WITHDRAWAL REQUEST END ---------

// ----- ADMIN WITHDRAWAL REQUEST START -----
router.post("/withdrawal-request", isLoggedIn, transactionController.WalletWithdrawalRequest)
router.post("/withdrawal-accepted", isAdminLoggedIn, transactionController.WalletWithdrawalAccepted)

router.get("/get-deposit-history", isAdminLoggedIn, transactionController.getDepositHistoryAdmin)
router.get('/get-completed-deposit-history-manually', isAdminLoggedIn, transactionController.getCompletedDepositHistory);
router.get("/get-rejected-deposit-history-manually", isAdminLoggedIn, transactionController.getRejectedDepositHistory);
router.put("/deposit-amount-admin/:depositId", isAdminLoggedIn, transactionController.WalletDepositAmountAdmin)
// ----- ADMIN WITHDRAWAL REQUEST END -----

// ----- DEPOSIT CARD APIs START -----
console.log("🔍 Registering Deposit Card routes...");
console.log("   depositFromROIWallet:", typeof transactionController.depositFromROIWallet);
console.log("   depositForOtherUser:", typeof transactionController.depositForOtherUser);
console.log("   transferROIWallet:", typeof transactionController.transferROIWallet);
console.log("   getROIWalletBalance:", typeof transactionController.getROIWalletBalance);

router.post("/deposit-from-roi-wallet", isLoggedIn, transactionController.depositFromROIWallet);
router.post("/deposit-for-other-user", isLoggedIn, transactionController.depositForOtherUser);
router.post("/transfer-roi-wallet", isLoggedIn, transactionController.transferROIWallet);
router.get("/get-roi-wallet-balance", isLoggedIn, transactionController.getROIWalletBalance);
console.log("✅ Deposit Card routes registered successfully");
// ----- DEPOSIT CARD APIs END -----

module.exports = router;