const { CommissionIncome } = require("../models/commission.model");
const { IncomeModel } = require("../models/income.model");
const { PackageModel } = require("../models/package.model");
const { RewardModel } = require("../models/reward.model");
const { TransactionModel } = require("../models/transaction.model");
const { UserModel } = require("../models/user.model");
const { generateCustomId } = require("./generator.uniqueid");
const { getDownlineArray, getDirectPartnersDownlines } = require("./getteams.downline");
const { NumberFixed } = require("./NumberFixed");
const cron = require("node-cron");
const moment = require("moment-timezone");

// Excluded user IDs - these users and their referrals will not receive referral income
const EXCLUDED_USER_IDS = ['AUV0506884', 'AUV7210166', 'AUV6645644'];




const getCurrentMonthDays = (month=null)=>{
    const today = new Date();
    const currentMonth = month == null ? (month || (today.getMonth() + 1)) : month || 0;
    const year = today.getFullYear();
    const daysInCurrentMonth = new Date(year, currentMonth, 0).getDate();
    return daysInCurrentMonth;
}

//  ------------------------ 1.TRADING PROFIT NODE-CRON START --------------------------------- 
const tradingProfitCalculate = async (userId) => {
    try {

        console.log(`🔄 Calculating Trading Profit for User: ${userId}`);
        const user = await UserModel.findById(userId);
        if (!user) return;
        
        // Check if user already received Trading Profit Income today
        if (user.todayRoiCollected) {
            console.log(`⏭️ Skipping: User ${user.username} already received Trading Profit Income today.`);
            return;
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
            return;
        }
        
        const incomeDetails = await IncomeModel.findById(user.incomeDetails);
        if (!incomeDetails) return;
        const transactions = await TransactionModel.find({ type: "Deposit", user: user._id });
        let totalCommission = 0;
        for (const transaction of transactions) {
            const package = await PackageModel.findById(transaction.package);
            if (!package || package.title === 'LIVE AC') continue;
            const tradingReports = await CommissionIncome.aggregate([
                { $match: { package: package._id, type: "Trading Profit Income", user: user._id } },
                { $group: { _id: null, totalIncome: { $sum: "$income" } } }
            ]);
            const totalTradingAmount = tradingReports?.[0]?.totalIncome || 0;
            const maxAllowed = transaction.investment * 3;
            const remaining = maxAllowed - totalTradingAmount;
            if (remaining <= 0) {
                // console.log(`🔁 Skipping: User ${user._id} has reached 3X cap for transaction ${transaction._id}`);
                continue;
            }
            const daysInCurrentMonth = getCurrentMonthDays();
            const dailyPercentage = (package.percentage/daysInCurrentMonth)
            const rawIncome = transaction.investment * (dailyPercentage / 100);
            const income = Math.min(rawIncome, remaining); // prevent over-crediting    
            const id = generateCustomId({ prefix: 'YMK-TD', max: 14, min: 14 });
            const newMonthly = new CommissionIncome({ id, user: user._id, income, percentage: dailyPercentage, amount: Number(transaction.investment), tx: transaction._id, type: "Trading Profit Income", status: "Completed", package: package._id });
            incomeDetails.monthlyIncome.history.push(newMonthly._id);
            totalCommission += income;
            await newMonthly.save();
        }
        
        // Only update income and flag if commission was actually distributed
        if (totalCommission > 0) {
            incomeDetails.monthlyIncome.income = NumberFixed(incomeDetails.monthlyIncome.income, totalCommission);
            incomeDetails.income.totalIncome = NumberFixed(incomeDetails.income.totalIncome, totalCommission);
            incomeDetails.income.currentIncome = NumberFixed(incomeDetails.income.currentIncome, totalCommission);
            await incomeDetails.save();
            await levelIncomeCalculate({ userId: user._id, amount: Number(totalCommission) });
            
            // Mark as collected to prevent duplicate distribution
            user.todayRoiCollected = true;
            await user.save();
            
            console.log(`✅ Trading Profit Income Added Successfully for ${user.username}: ₹${totalCommission.toFixed(2)}`);
        } else {
            console.log(`ℹ️ No Trading Profit Income to distribute for ${user.username} (all transactions reached 3X cap or no valid packages)`);
        }
    } catch (error) {
        console.error("❌ Error in Trading Profit Income Calculation:", error.message);
    }
};
let isTradingProcessing = false;
const tradingNodeCron = async () => {
    if (isTradingProcessing) return;
    isTradingProcessing = true;
    try {
        const users = await UserModel.find({ 'active.isActive': true, 'active.isVerified': true,'active.isBlocked': false });
        for (let user of users) {
            if (!user || !user.active.isActive || !user.active.isVerified) continue;
            console.log(`Processing Trading Profit for User: ${user.username} (${user._id})`);
            await tradingProfitCalculate(user._id);
        }
    } catch (error) {
        console.error("Error in scheduled task:", error);
    } finally {
        isTradingProcessing = false;

    }
}
// Run this every day at IST 12:10 AM (00:10 IST)
// IST is UTC+5:30, so IST 00:10 = UTC 18:40 (previous day)
// Using '10 0 * * *' assuming server is in IST, if server is in UTC use '40 18 * * *'
cron.schedule('10 0 * * *', () => {
    const istTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
    console.log(`⏰ Trading Node Cron executed at IST: ${istTime}`);
    tradingNodeCron();
});
// setInterval(tradingNodeCron, 6000000)
//  ------------------------ 1.TRADING PROFIT NODE-CRON END --------------------------------- 







// ----------------- 3. LEVEL INCOMES NOT NODE-CRON START -----------------
// Level Income Percentages for ROI Distribution (10 levels)
const levelIncomePercentages = [
    0.10,       // Level 1: 10%
    0.05,       // Level 2: 5%
    0.03,       // Level 3: 3%
    0.02,       // Level 4: 2%
    0.01,       // Level 5: 1%
    0.005, 0.005, 0.005, 0.005, 0.005  // Level 6-10: 0.5%
];

const levelIncomeCalculate = async ({ userId, amount, levelPercentages = levelIncomePercentages, levelActive = true }) => {
    try {
        const user = await UserModel.findById(userId);
        if (!user) return;
        
        // Skip if the investing user is in excluded list - their investments won't generate referral income
        if (user.id && EXCLUDED_USER_IDS.includes(user.id)) {
            console.log(`⏭️ Skipping referral income calculation: User ${user.id} (${user.username}) is excluded from referral income`);
            return;
        }
        
        let currentUser = user;
        for (let level = 0; level < levelPercentages.length; level++) {
            if (!currentUser.sponsor) break;
            const sponsor = await UserModel.findById(currentUser.sponsor);
            if (!sponsor) break;
            if (sponsor.active.isBlocked) break;
            
            // If sponsor is in excluded list - stop the chain completely
            // Their sponsors won't get income from investments of excluded users' referrals
            if (sponsor.id && EXCLUDED_USER_IDS.includes(sponsor.id)) {
                console.log(`⏭️ Stopping referral income chain at excluded sponsor ${sponsor.id} (${sponsor.username}) - no income to their sponsors`);
                break; // Stop the chain completely - don't give income to anyone above excluded user
            }
            if (levelActive) {
                // Every 1 Direct = 2 Levels Open (max 10 levels with 5 directs)
                const activeDirects = await UserModel.countDocuments({ _id: { $in: sponsor.partners }, 'active.isActive': true });
                const unlockedDirects = Math.min(activeDirects, 5); // Max 5 directs needed for 10 levels
                const maxUnlockedLevel = unlockedDirects * 2; // 1 direct = 2 levels
                if (level < maxUnlockedLevel) {
                    if (sponsor.active.isActive && !sponsor.active.isBlocked) {
                        const incomeDetails = await IncomeModel.findById(sponsor.incomeDetails);
                        if (!incomeDetails) break;
                        const percentage = levelPercentages[level];
                        if (!percentage) break;
                        const income = Number(amount * percentage);
                        incomeDetails.levelIncome.income = NumberFixed(incomeDetails.levelIncome.income, income);
                        incomeDetails.income.totalIncome = NumberFixed(incomeDetails.income.totalIncome, income);
                        // Store Level Income in separate Level Income Wallet (not in currentIncome/main wallet)
                        incomeDetails.income.levelIncomeWallet = NumberFixed(incomeDetails.income.levelIncomeWallet || 0, income);

                        const id = generateCustomId({ prefix: 'YMK-LVL', max: 14, min: 14 });
                        const days = await CommissionIncome.find({user:sponsor._id,fromUser: user._id,type: "Level Income",status: "Completed"})
                        const newLevel = new CommissionIncome({ id, user: sponsor._id, fromUser: user._id, level: level + 1, income: income, percentage: percentage * 100, amount: Number(amount),days:Number(days.length+1), type: "Level Income", status: "Completed" });

                        incomeDetails.levelIncome.history.push(newLevel._id);
                        await newLevel.save();
                        await incomeDetails.save();
                        console.log(`✅ Level ${level + 1} Income: ₹${income.toFixed(2)} (${(percentage * 100)}%) → Sponsor: ${sponsor.username}`);
                    }
                }
            } else {
                if (sponsor.active.isActive && !sponsor.active.isBlocked) {
                    const incomeDetails = await IncomeModel.findById(sponsor.incomeDetails);
                    if (!incomeDetails) break;
                    const percentage = levelPercentages[level];
                    if (!percentage) break;
                    const income = Number(amount * percentage);
                    incomeDetails.referralIncome.income = NumberFixed(incomeDetails.referralIncome.income, income);
                    incomeDetails.income.totalIncome = NumberFixed(incomeDetails.income.totalIncome, income);
                    incomeDetails.income.currentIncome = NumberFixed(incomeDetails.income.currentIncome, income);

                    const id = generateCustomId({ prefix: 'YMK-REF', max: 14, min: 14 });
                    const newLevel = new CommissionIncome({ id, user: sponsor._id, fromUser: user._id, level: level + 1, income: income, percentage: percentage * 100, amount: Number(amount), type: "Referral Income", status: "Completed" });
                    incomeDetails.referralIncome.history.push(newLevel._id);
                    await newLevel.save();
                    await incomeDetails.save();
                    console.log(`✅ REF Level ${level + 1} Income: ₹${income.toFixed(2)} (${(percentage * 100)}%) → Sponsor: ${sponsor.username}`);
                }
            }
            currentUser = sponsor;
        }
    } catch (error) {
        // console.error("❌ Error in Level Income Calculation:", error.message);
    }
};
// ----------------- LEVEL INCOMES NOT NODE-CRON END -----------------





// ---------------- 4. MATCHING BONUS START -----------------
const bonusTable = [
    { business: 3000, bonusPerMonth: 50 },
    { business: 6000, bonusPerMonth: 100 },
    { business: 12000, bonusPerMonth: 150 },
    { business: 24000, bonusPerMonth: 300 },
    { business: 60000, bonusPerMonth: 1000 },
    { business: 120000, bonusPerMonth: 2000 },
    { business: 300000, bonusPerMonth: 3000 },
    { business: 500000, bonusPerMonth: 5000 },
    { business: 1200000, bonusPerMonth: 10000 },
    { business: 2500000, bonusPerMonth: 20000 },
    { business: 5000000, bonusPerMonth: 40000 },
    { business: 10000000, bonusPerMonth: 100000 },
    { business: 50000000, bonusPerMonth: 500000 },
];
const matchingBonusCalculate = async (userId) => {
    try {
        const user = await UserModel.findById(userId);
        if (!user) return;
        const incomeDetails = await IncomeModel.findById(user.incomeDetails);
        if (!incomeDetails) return;
        // const { left, right } = await getDownlineArray({ userId: user._id });
        // const leftTotal = left.reduce((total, partner) => total + Number(partner.investment || 0), 0);
        // const rightTotal = right.reduce((total, partner) => total + Number(partner.investment || 0), 0);
        const {powerLagBusiness,weakerLagBusiness} = await getDirectPartnersDownlines({userId: user._id})
        const leftTotal = powerLagBusiness;
        const rightTotal = weakerLagBusiness;

        const weakerBusiness = Math.min(leftTotal, rightTotal);

        const bonusEntry = bonusTable.findLast(b => weakerBusiness >= b.business) || false;
        if (!bonusEntry) {
            // console.log(`❌ No matching bonus for user: ${userId}`);
            return;
        }
        const matchingCommissionThisMonth = await CommissionIncome.findOne({ user: user._id, type: 'Matching Income', status: 'Completed', createdAt: { $gte: new Date(new Date().setDate(1)) } });
        if (matchingCommissionThisMonth) {
            // console.log(`❌ Matching bonus already paid for this month to user: ${userId}`);
            return
        }
        const matchingCommission = await CommissionIncome.countDocuments({ user: user._id, type: 'Matching Income', status: 'Completed', income: bonusEntry.bonusPerMonth });
        if (matchingCommission >= 5) {
            // console.log(`❌ Matching bonus already paid for this month to user: ${userId} (${matchingCommission.length})`);
            return
        }
        // Update incomes
        const id = generateCustomId({ prefix: 'YMK-MI', max: 14, min: 14 });
        const commission = new CommissionIncome({ id, user: user?._id, amount: bonusEntry?.business, income: bonusEntry?.bonusPerMonth, leftBusiness: leftTotal, rightBusiness: rightTotal, type: 'Matching Income', status: 'Completed' });
        incomeDetails.matchingIncome.income += bonusEntry.bonusPerMonth;
        incomeDetails.income.currentIncome += bonusEntry.bonusPerMonth;
        incomeDetails.income.totalIncome += bonusEntry.bonusPerMonth;
        incomeDetails.matchingIncome.history.push(commission._id);
        // Set nextPayoutDate to 1st of next month
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        incomeDetails.matchingIncome.nextPayoutDate = nextMonth;
        await commission.save();
        await incomeDetails.save();
        // console.log(`✅ Matching bonus distributed to ${user.username} ($${bonusEntry.bonusPerMonth})`);
    } catch (error) {
        // console.error("❌ Error in Matching Bonus Calculation:", error.message);
    }
};

let isMatchingProcessing = false
const matchingNodeCron = async () => {
    if (isMatchingProcessing) return;
    isMatchingProcessing = true;
    try {
        const users = await UserModel.find({ 'active.isActive': true, 'active.isVerified': true,'active.isBlocked': false });
        for (let user of users) {
            if (!user || !user.active.isActive || !user.active.isVerified) continue;
            await matchingBonusCalculate(user._id);
        }
    } catch (error) {
        console.error("Error in scheduled task:", error);
    } finally {
        isMatchingProcessing = false;
    }
}
// Matching Income Cron - COMMENTED OUT
// Run this on 1st of every month at IST 12:10 AM (00:10 IST)
// IST is UTC+5:30, so IST 00:10 = UTC 18:40 (previous day)
// Using '10 0 1 * *' assuming server is in IST, if server is in UTC use '40 18 1 * *'
// cron.schedule('10 0 1 * *', () => {
//     const istTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
//     console.log(`⏰ Matching Node Cron executed at IST: ${istTime}`);
//     matchingNodeCron();
// });
// setInterval(matchingNodeCron, 6000)

// ---------------- 4. MATCHING BONUS END -----------------







// ----------- 5. GLOBAL ACHIEVER CLUB START ------------------------
const globalAchieverCalculate = async (userId) => {
    try {
        const user = await UserModel.findById(userId, { _id: 1, username: 1, incomeDetails: 1 });
        if (!user) return;

        const incomeDetails = await IncomeModel.findById(user.incomeDetails);
        if (!incomeDetails) return;

        // const { left, right } = await getDownlineArray({ userId: user._id });
        // const leftTotal = left.reduce((total, partner) => total + Number(partner.investment || 0), 0);
        // const rightTotal = right.reduce((total, partner) => total + Number(partner.investment || 0), 0);

        const {powerLagBusiness,weakerLagBusiness} = await getDirectPartnersDownlines({userId: user._id})
        const leftTotal = powerLagBusiness;
        const rightTotal = weakerLagBusiness;
        // Apply 40:60 logic (minSide * 1.5 must be >= maxSide)
        const minSide = Math.min(leftTotal, rightTotal);
        const maxSide = Math.max(leftTotal, rightTotal);
        const isValid4060 = minSide * 1.5 >= maxSide;

        if (!isValid4060) {
            // console.log(`❌ Global Reward NOT eligible due to invalid 40:60 ratio: Left ₹${leftTotal}, Right ₹${rightTotal}`);
            return;
        }

        const totalBussiness = Number(minSide + maxSide);

        const rewards = await RewardModel.find({ status: true, type: "Global Archive Reward", users: { $ne: user._id } }).sort({ investment: 1 });
        for (const reward of rewards) {
            if (reward.users.includes(user._id)) {
                // console.log(`✅ Already Achived ${reward.title}`)
            } else {
                // console.log(totalBussiness, reward.investment)
                if (totalBussiness >= reward.investment) {
                    const income = Number(reward.investment * reward.percentage / 100) || 0;
                    const id = generateCustomId({ prefix: 'YMK-GAR', max: 14, min: 14 });
                    const newReward = new CommissionIncome({ id, user: user._id, income: income, reward: reward._id, amount: reward.investment, percentage: reward.percentage, leftBusiness: minSide, rightBusiness: maxSide, type: "Global Archive Reward", status: "Completed" });
                    incomeDetails.globalAchieverIncome.income = NumberFixed(incomeDetails.globalAchieverIncome.income, income);
                    incomeDetails.income.totalIncome = NumberFixed(incomeDetails.income.totalIncome, income);
                    incomeDetails.income.currentIncome = NumberFixed(incomeDetails.income.currentIncome, income);

                    incomeDetails.globalAchieverIncome.history.push(newReward._id);
                    reward.users.push(user._id);
                    await Promise.all([newReward.save(), incomeDetails.save(), reward.save(), user.save()]);
                    // console.log(`✅ Global Archive Reward Distributed to ${user.username} (${reward.title}) - ₹${reward.reward}`);
                } else {
                    // console.log(`❌ Global Archive Reward Not Achieved for ${user.username} (${reward.title}) - Required: ₹${reward.investment}, Current: ₹${totalBussiness}`);
                }
            }
        }
    } catch (error) {
        console.log(error)
        console.error("❌ Error in Rank Reward Calculation:", error.message);
    }
};

let isGlobalProcessing = false
const globalNodeCron = async () => {
    if (isGlobalProcessing) return;
    isGlobalProcessing = true;
    try {
        const users = await UserModel.find({ 'active.isActive': true, 'active.isVerified': true,'active.isBlocked': false });
        for (let user of users) {
            if (!user || !user.active.isActive || !user.active.isVerified) continue;
            await globalAchieverCalculate(user._id);
        }
    } catch (error) {
        console.error("Error in scheduled task:", error);
    } finally {
        isGlobalProcessing = false;
    }
}
// Run this every day at IST 12:10 AM (00:10 IST)
// IST is UTC+5:30, so IST 00:10 = UTC 18:40 (previous day)
// Using '10 0 * * *' assuming server is in IST, if server is in UTC use '40 18 * * *'
cron.schedule('10 0 * * *', () => {
    const istTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
    console.log(`⏰ Global Node Cron executed at IST: ${istTime}`);
    globalNodeCron();
});
// setInterval(globalNodeCron, 6000)
// ----------- 5. GLOBAL ACHIEVER CLUB END ------------------------





// ----------- 6. RANK AND REWARD START ------------------------
const rankRewardCalculate = async (userId) => {
    try {
        const user = await UserModel.findById(userId, { _id: 1, username: 1, incomeDetails: 1 });
        if (!user) return;
        const incomeDetails = await IncomeModel.findById(user.incomeDetails, { _id: 1, rankRewardIncome: 1 });
        if (!incomeDetails) return;
        // const { downlineUserIds } = await getDownlineArray({ userId: user._id });
        // const [totalBussinessInvestment] = await TransactionModel.aggregate([
        //     { $match: { user: { $in: downlineUserIds }, type: "Deposit", status: "Completed" } },
        //     { $group: { _id: null, total: { $sum: "$investment" } } }
        // ]);
        // const totalBussiness = totalBussinessInvestment?.total || 0;

        const {powerLagBusiness,weakerLagBusiness} = await getDirectPartnersDownlines({userId: user._id})
        const leftTotal = powerLagBusiness;
        const rightTotal = weakerLagBusiness;
        const totalBussiness = Math.min(leftTotal, rightTotal);
        const rewards = await RewardModel.find({ status: true, type: "Rank Reward", users: { $ne: user._id } }).sort({ investment: 1 });
        for (const reward of rewards) {
            if (reward.users.includes(user._id)) {
                console.log(`✅ Already Achived ${reward.title}`)
            } else {
                if (totalBussiness >= reward.investment) {
                    const id = generateCustomId({ prefix: 'YMK-RNK', max: 14, min: 14 });
                    const newReward = new CommissionIncome({ id, user: user._id, reward: reward._id, amount: totalBussiness, type: "Rank Reward",rewardPaid:"Pending", status: "Completed" });
                    incomeDetails.rankRewardIncome.history.push(newReward._id);
                    await newReward.save();
                    await incomeDetails.save();
                    reward.users.push(user._id);
                    await user.save();
                    await reward.save();
                    // console.log(`✅ Rank Reward Distributed to ${user.username} (${reward.title}) - ₹${reward.reward}`);
                } else {
                    // console.log(`❌ Rank Reward Not Achieved for ${user.username} (${reward.title}) - Required: ₹${reward.investment}, Current: ₹${totalBussiness}`);
                }
            }
        }
    } catch (error) {
        console.log(error)
        console.error("❌ Error in Rank Reward Calculation:", error.message);
    }
};

let isRewardProcessing = false
const rewardNodeCron = async () => {
    if (isRewardProcessing) return;
    isRewardProcessing = true;
    try {
        const users = await UserModel.find({ 'active.isActive': true, 'active.isVerified': true,'active.isBlocked': false });
        for (let user of users) {
            if (!user || !user.active.isActive || !user.active.isVerified) continue;
            await rankRewardCalculate(user._id);
        }
    } catch (error) {
        console.error("Error in scheduled task:", error);
    } finally {
        isRewardProcessing = false;
    }

}
// Run this every day at IST 12:10 AM (00:10 IST)
// IST is UTC+5:30, so IST 00:10 = UTC 18:40 (previous day)
// Using '10 0 * * *' assuming server is in IST, if server is in UTC use '40 18 * * *'
cron.schedule('10 0 * * *', () => {
    const istTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
    console.log(`⏰ Reward Node Cron executed at IST: ${istTime}`);
    rewardNodeCron();
});
// setInterval(rewardNodeCron, 6000);
// ----------- 6. RANK AND REWARD END ------------------------




module.exports = { levelIncomeCalculate,rewardNodeCron,globalNodeCron,matchingNodeCron,tradingNodeCron };