
// controllers/roi.controller.js
const {UserModel} = require("../models/user.model");
const ROIHistory = require("../models/roiHistory");
const GenerationROIHistory = require("../models/generation.model")
const {IncomeModel} = require("../models/income.model");
const { CommissionIncome } = require("../models/commission.model");
const { generateCustomId } = require("../utils/generator.uniqueid");

// Excluded user IDs - these users and their referrals will not receive referral income
const EXCLUDED_USER_IDS = ['AUV0506884', 'AUV7210166', 'AUV6645644'];


exports.calculateDailyROIForAllUsers = async (req, res) => {
  try {
    const users = await UserModel.find().populate("incomeDetails");

    if (!users || users.length === 0) {
      return res.status(400).json({ success: false, message: "No users found" });
    }

    // Loop through each user and calculate ROI
    for (let user of users) {
      // Skip user if today's ROI is already collected
      if (user.todayRoiCollected) {
        console.log(`❌ Today's ROI already collected for user ${user.username}.`);
        continue; // Skip this user if ROI is already collected
      }

      // Skip if investment is less than ₹100
      if (user.investment < 100) {
        console.log(`❌ Minimum ₹100 investment required for user ${user.username}.`);
        continue; // Skip if investment is less than ₹100
      }

      let roiPercent = 0;
      if (user.investment >= 100 && user.investment <= 1000) roiPercent = 0.20; // 6% monthly = 0.2% daily
      else if (user.investment >= 1001 && user.investment <= 5000) roiPercent = 0.233; // 7% monthly = 0.233% daily
      else if (user.investment >= 5001) roiPercent = 0.25; // 7.5% monthly = 0.25% daily

      // If no ROI slab matched, skip the user
      if (roiPercent === 0) {
        console.log(`❌ No ROI slab matched for user ${user.username}.`);
        continue; // Skip if no ROI slab matched
      }

      const finalROI = (user.investment * roiPercent) / 100;

      // Ensure IncomeDetails exists, create if not
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

      // Record ROI History
      await ROIHistory.create({
        user: user._id,
        amount: finalROI,
        roiPercent,
      });

      // Mark today's ROI as collected
      user.todayRoiCollected = true;
      await user.save();

      console.log(`✅ User ${user.username} got ROI: ₹${finalROI}`);
    }

    // Respond with a success message
    return res.status(200).json({ success: true, message: "ROIs calculated for all users" });
  } catch (err) {
    console.error("❌ ROI Calculation Error for all users:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};





//=====================================GENERATION ROI=====================================//

// ✅ Max levels allowed based on direct partners
function getMaxLevels(partnersCount) {
  if (partnersCount >= 6) return 30;
  return partnersCount * 5; // 1→5, 2→10, 3→15, 4→20, 5→25
}

// ✅ Get ROI percentage for a level
function getLevelPercent(level) {
  if (level === 1) return 10;
  if (level === 2) return 5;
  if (level === 3) return 4;
  if (level >= 4 && level <= 8) return 3;
  if (level >= 9 && level <= 13) return 2;
  if (level >= 14 && level <= 18) return 1.5;
  if (level >= 19 && level <= 23) return 1;
  if (level >= 24 && level <= 28) return 0.7;
  if (level >= 29 && level <= 30) return 0.5;
  return 0;
}

// ✅ Main distribution function
exports.distributeGenerationROI = async (userId, roiAmount) => {
  try {
    let currentUser = await UserModel.findById(userId).populate("sponsor");
    if (!currentUser) return;
    
    // Skip if the investing user is in excluded list - their ROI won't generate referral income
    if (currentUser.id && EXCLUDED_USER_IDS.includes(currentUser.id)) {
      console.log(`⏭️ Skipping Generation ROI distribution: User ${currentUser.id} (${currentUser.username}) is excluded from referral income`);
      return;
    }
    
    let level = 1;

    while (currentUser  && level <= 30) {
      const upline = await UserModel.findById(currentUser.sponsor).populate("partners");
      if (!upline) break;
      if(upline.active.isBlocked || !upline.active.isActive) continue;
      
      // If upline is in excluded list - stop the chain completely
      // Their sponsors won't get Generation ROI from excluded users' ROI
      if (upline.id && EXCLUDED_USER_IDS.includes(upline.id)) {
        console.log(`⏭️ Stopping Generation ROI chain at excluded upline ${upline.id} (${upline.username}) - no income to their sponsors`);
        break; // Stop the chain completely - don't give income to anyone above excluded user
      }

      const maxLevels = getMaxLevels(upline.partners.length);

      if (level <= maxLevels) {
        const percent = getLevelPercent(level);
        if (percent > 0) {
          const genIncome = (roiAmount * percent) / 100;

          // ✅ Ensure IncomeDetails exists
          let income = upline.incomeDetails;
          if (!income) {
            income = await IncomeModel.create({ user: upline._id });
            upline.incomeDetails = income._id;
            await upline.save();
          } else {
            income = await IncomeModel.findById(income);
          }

          // ✅ Add Generation ROI (Level Income) to Level Income Wallet (not main wallet)
          income.income.levelIncomeWallet = (income.income.levelIncomeWallet || 0) + genIncome;
          income.income.totalIncome += genIncome;
          await income.save();


          const id = generateCustomId({ prefix: 'YMK-LVL', max: 14, min: 14 });
          const days = await CommissionIncome.find({user: upline._id, fromUser: userId, type: "Level Income", status: "Completed"})
          const newLevel = new CommissionIncome({ id, user: upline._id, fromUser: userId, level: level, income: genIncome, percentage: percent * 100, amount: Number(roiAmount), days: Number(days.length + 1), type: "Level Income", status: "Completed" });
          
          await newLevel.save();
          // ✅ Save Generation ROI history
          // await GenerationROIHistory.create({
          //   fromUser: userId,
          //   toUser: upline._id,
          //   level,
          //   amount: genIncome,
          //   percent
          // });

          console.log(
            `User ${upline.username} ko Generation ROI mila $${genIncome.toFixed(
              2
            )} (Level ${level}, ${percent}%)`
          );
        }
      }

      // Move up one level
      currentUser = upline;
      level++;
    }
  } catch (err) {
    console.error("❌ Generation ROI Distribution Error:", err.message);
  }
};

