// combined.daily.cron.js
const cron = require("node-cron");
const moment = require("moment-timezone");
const { UserModel } = require("../models/user.model");
const { calculateDailyROIForUsers } = require("../services/dailyRoi");
const { tradingNodeCron } = require("../utils/levelIncome.calculation");

// Run every day at IST 12:10 AM (00:10 IST)
cron.schedule("10 0 * * *", async () => {
  const istTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
  console.log(`⏰ Combined ROI & Trading Cron triggered at IST: ${istTime}`);

  try {
    // 1️⃣ Reset todayRoiCollected
    console.log("🌙 Resetting todayRoiCollected flags for all users...");
    await UserModel.updateMany({}, { todayRoiCollected: false });
    console.log("✅ All flags reset successfully.");

    // 2️⃣ Calculate Daily ROI
    console.log("🚀 Calculating Daily ROI for all users...");
    const roiResults = await calculateDailyROIForUsers();

    // Log per-user ROI
    if (roiResults && roiResults.length) {
      roiResults.forEach(user => {
        console.log(`💰 Daily ROI calculated for user: ${user.username} (ID: ${user._id}) - ROI: ₹${user.roiAmount}`);
      });
    }

    // 3️⃣ Calculate Trading Profit
    console.log("🚀 Calculating Trading Profit for all users...");
    const tradingResults = await tradingNodeCron();

    // Log per-user Trading Profit
    if (tradingResults && tradingResults.length) {
      tradingResults.forEach(user => {
        console.log(`📈 Trading Profit calculated for user: ${user.username} (ID: ${user._id}) - Profit: ₹${user.profitAmount}`);
      });
    }

    console.log("🎉 Daily ROI + Trading Profit completed successfully!");
  } catch (err) {
    console.error("❌ Error in Combined Daily Cron:", err.message);
  }
});
