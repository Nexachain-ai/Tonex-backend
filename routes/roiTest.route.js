const express = require("express");
const router = express.Router();

const { calculateDailyROIForUsers } = require("../services/dailyRoi");
const { tradingNodeCron } = require("../utils/levelIncome.calculation");
const { UserModel } = require("../models/user.model");

// Manual ROI Trigger
router.get("/run-daily-roi", async (req, res) => {
  try {
    console.log("🚀 Manual ROI Trigger Started...");

    await calculateDailyROIForUsers();
    await tradingNodeCron();

    console.log("🎉 Manual ROI Trigger Finished!");

    res.status(200).json({
      success: true,
      message: "Manual ROI calculation completed.",
    });
  } catch (error) {
    console.log("❌ Error running manual ROI:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reset ROI Flags
router.post("/reset-roi", async (req, res) => {
  try {
    await UserModel.updateMany({}, { todayRoiCollected: false });
    console.log("🌙 Reset all users' todayRoiCollected to FALSE");
    res.status(200).json({ success: true, message: "ROI flags reset successfully!" });
  } catch (err) {
    console.error("❌ Error resetting ROI flags:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
