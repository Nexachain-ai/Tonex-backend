const { distributeGenerationROI } = require("../controllers/roi.controller");
const { IncomeModel } = require("../models/income.model");
const { CommissionIncome } = require("../models/commission.model");
const roiHistory = require("../models/roiHistory");
const { UserModel } = require("../models/user.model");
const { generateCustomId } = require("../utils/generator.uniqueid");

// Monthly ROI calculation (runs on 15th of every month)
exports.calculateMonthlyROIForUsers = async () => {
  try {
    console.log("🚀 Starting Monthly ROI Calculation (15th of month)...");

    const users = await UserModel.find().populate("incomeDetails");

    if (!users || users.length === 0) {
      console.log("⚠️ No users found in database.");
      return;
    }

    // Check if ROI was already calculated this month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const startOfCurrentMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), 1);

    for (let user of users) {
      // Check if ROI was already calculated this month
      const monthlyROI = await CommissionIncome.findOne({
        user: user._id,
        type: "Trading Profit Income",
        status: "Completed",
        createdAt: { $gte: startOfCurrentMonth }
      });

      if (monthlyROI) {
        console.log(`⏭️ Skipping: User ${user.username} already received ROI this month.`);
        continue;
      }

      if (user.investment < 100) {
        console.log(`❌ Minimum ₹100 investment required for ${user.username}.`);
        continue;
      }

      // Monthly ROI percentages (not daily)
      let monthlyRoiPercent = 0;
      if (user.investment >= 100 && user.investment <= 1000) monthlyRoiPercent = 6; // 6% monthly
      else if (user.investment >= 1001 && user.investment <= 5000) monthlyRoiPercent = 7; // 7% monthly
      else if (user.investment >= 5001) monthlyRoiPercent = 7.5; // 7.5% monthly

      if (monthlyRoiPercent === 0) {
        console.log(`❌ No ROI slab matched for ${user.username}.`);
        continue;
      }

      const finalROI = (user.investment * monthlyRoiPercent) / 100;

      let income = user.incomeDetails;
      if (!income) {
        income = await IncomeModel.create({ user: user._id });
        user.incomeDetails = income._id;
        await user.save();
      }

      // Store ROI in separate ROI wallet (not in currentIncome/main wallet)
      income.income.roiWallet = (income.income.roiWallet || 0) + finalROI;
      income.income.totalIncome += finalROI;
      await income.save();
      const id = generateCustomId({ prefix: 'YMK-TD', max: 14, min: 14 });
      const newMonthly = new CommissionIncome({ id, user: user._id, income:finalROI, percentage: monthlyRoiPercent, amount: Number(user.investment),type: "Trading Profit Income", status: "Completed"});
      await newMonthly.save();
      await distributeGenerationROI(user._id, finalROI);

      console.log(`✅ ${user.username} received Monthly ROI: ₹${finalROI.toFixed(2)} (${monthlyRoiPercent}%)`);
    }

    console.log("🎉 Monthly ROI calculation completed for all users!");
  } catch (err) {
    console.error("❌ Error during Monthly ROI calculation:", err.message);
  }
};

// Keep daily function for backward compatibility (if needed elsewhere)
exports.calculateDailyROIForUsers = async () => {
  try {
    console.log("🚀 Starting Daily ROI Calculation...");

    // Check if today is Sunday (0 = Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    if (dayOfWeek === 0) {
      console.log("🌟 Sunday Detected - ROI is OFF for today. No ROI will be distributed.");
      return;
    }

    const users = await UserModel.find().populate("incomeDetails");

    if (!users || users.length === 0) {
      console.log("⚠️ No users found in database.");
      return;
    }

    for (let user of users) {
      // Check if user already received Trading Profit Income today
      if (user.todayRoiCollected) {
        console.log(`❌ ROI already collected today for ${user.username}.`);
        continue;
      }

      // Additional check: Verify if Trading Profit Income was already distributed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTradingProfit = await CommissionIncome.findOne({
        user: user._id,
        type: "Trading Profit Income",
        status: "Completed",
        createdAt: { $gte: today }
      });

      if (todayTradingProfit) {
        console.log(`⏭️ Skipping: User ${user.username} already has Trading Profit Income record for today.`);
        // Update flag to prevent future checks
        user.todayRoiCollected = true;
        await user.save();
        continue;
      }

      if (user.investment < 100) {
        console.log(`❌ Minimum ₹100 investment required for ${user.username}.`);
        continue;
      }

      let roiPercent = 0;
      if (user.investment >= 100 && user.investment <= 1000) roiPercent = 0.2; // 6% monthly = 0.2% daily
      else if (user.investment >= 1001 && user.investment <= 5000) roiPercent = 0.2333; // 7% monthly = 0.2333% daily
      else if (user.investment >= 5001) roiPercent = 0.25; // 7.5% monthly = 0.25% daily

      if (roiPercent === 0) {
        console.log(`❌ No ROI slab matched for ${user.username}.`);
        continue;
      }

      const finalROI = (user.investment * roiPercent) / 100;

      let income = user.incomeDetails;
      if (!income) {
        income = await IncomeModel.create({ user: user._id });
        user.incomeDetails = income._id;
        await user.save();
      }

      // Store ROI in separate ROI wallet (not in currentIncome/main wallet)
      income.income.roiWallet = (income.income.roiWallet || 0) + finalROI;
      income.income.totalIncome += finalROI;
      await income.save();
      const id = generateCustomId({ prefix: 'YMK-TD', max: 14, min: 14 });
      const newMonthly = new CommissionIncome({ id, user: user._id, income:finalROI, percentage: roiPercent, amount: Number(user.investment),type: "Trading Profit Income", status: "Completed"});
      await newMonthly.save();
      user.todayRoiCollected = true;
      await user.save();
      
      // Distribute Level Income on ROI (10 levels with 2 levels opening per direct)
      const { levelIncomeCalculate } = require('../utils/levelIncome.calculation');
      const roiLevelPercentages = [
        0.10,  // Level 1: 10%
        0.05,  // Level 2: 5%
        0.03,  // Level 3: 3%
        0.02,  // Level 4: 2%
        0.01,  // Level 5: 1%
        0.005, 0.005, 0.005, 0.005, 0.005  // Level 6-10: 0.5%
      ];
      await levelIncomeCalculate({ 
        userId: user._id, 
        amount: finalROI, 
        levelPercentages: roiLevelPercentages,
        levelActive: true 
      });
      
      await distributeGenerationROI(user._id, finalROI);

      console.log(`✅ ${user.username} received ROI: ₹${finalROI.toFixed(2)}`);
    }

    console.log("🎉 Daily ROI calculation completed for all users!");
  } catch (err) {
    console.error("❌ Error during ROI calculation:", err.message);
  }
};
