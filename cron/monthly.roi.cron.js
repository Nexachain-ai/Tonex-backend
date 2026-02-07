// monthly.roi.cron.js
const cron = require("node-cron");
const moment = require("moment-timezone");
const { calculateMonthlyROIForUsers } = require("../services/dailyRoi");

// Run on 15th of every month at IST 12:00 AM (00:00 IST)
// Cron expression: '0 0 15 * *' means: minute=0, hour=0, day=15, every month
cron.schedule("0 0 15 * *", async () => {
  const istTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
  console.log(`⏰ Monthly ROI Cron executed at IST: ${istTime} (15th of month)`);

  try {
    console.log("🚀 Calculating Monthly ROI for all users (15th of month)...");
    await calculateMonthlyROIForUsers();
    console.log("🎉 Monthly ROI calculation completed successfully!");
  } catch (err) {
    console.error("❌ Error in Monthly ROI Cron:", err.message);
  }
});

