// teamShuffle.cron.js
// Team shuffling cron - Runs every Monday at 3:00 AM IST
const cron = require("node-cron");
const moment = require("moment-timezone");
const { shuffleAllTeams } = require("../utils/teamDivision.calculation");

// Cron expression for every Monday at 3:00 AM IST
// IST is UTC+5:30, so 3:00 AM IST = 21:30 UTC (previous day - Sunday)
// Using Asia/Kolkata timezone option
cron.schedule("0 3 * * 1", async () => {
  const istTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
  console.log(`⏰ Weekly Team Shuffle Cron triggered at IST: ${istTime}`);
  console.log("📅 Running team division shuffling for all users...");

  try {
    const result = await shuffleAllTeams();
    console.log(`✅ Team shuffling completed! Success: ${result.successCount}, Failed: ${result.failCount}`);
  } catch (err) {
    console.error("❌ Error in Weekly Team Shuffle Cron:", err.message);
  }
}, {
  timezone: "Asia/Kolkata" // Run in IST timezone
});

console.log("✅ Team Shuffle Cron Job Initialized - Runs every Monday at 3:00 AM IST");

module.exports = {};

