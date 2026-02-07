const { isAddress } = require("ethers");
const { CommissionIncome } = require("../models/commission.model");
const { IncomeModel } = require("../models/income.model");
const { PackageModel } = require("../models/package.model");
const { TransactionModel } = require("../models/transaction.model");
const { UserModel } = require("../models/user.model");
const {
  generatorUniqueId,
  generateCustomId,
} = require("../utils/generator.uniqueid");
const { levelIncomeCalculate } = require("../utils/levelIncome.calculation");
const { sendUsdtWithdrawal } = require("../utils/wallet.token");
const { getOtpGenerate } = require("../utils/getOtpGenerate");
const { sendToOtp } = require("../utils/sendtootp.nodemailer");

// 1.WALLET INVESTMENT
exports.WalletInvestmentRequest = async (req, res) => {
  const { amount, packageId } = req.body;
  if (req.body.txResponse === undefined)
    return res
      .status(500)
      .json({ success: false, message: "Transaction response is required." });
  if (!amount || amount <= 0 || !packageId)
    return res
      .status(500)
      .json({ success: false, message: "Amount & Package ID are required." });
  
  // Minimum deposit validation
  const amountNumber = Number(amount);
  if (amountNumber < 100)
    return res
      .status(400)
      .json({ success: false, message: "Minimum deposit amount is $100." });

  const { from, to, hash } = req.body.txResponse;
  try {
    const user = await UserModel.findById(req.user._id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    const id = generateCustomId({ prefix: "YMK-TX", max: 14, min: 14 });
    const packageFind = await PackageModel.findById(packageId);
    if (!packageFind)
      return res
        .status(500)
        .json({ success: false, message: "Package not exist." });
    // if(packageFind.users.includes(user._id)) return res.status(500).json({success:false,message:"Already package purchased."});
    const newTransaction = new TransactionModel({
      id,
      user: user._id,
      package: packageFind._id,
      investment: amountNumber,
      hash,
      clientAddress: from,
      mainAddress: process.env.WALLET_ADDRESS,
      role: "USER",
      type: "Deposit",
      status: "Completed",
    });
    user.transactions.push(newTransaction._id);
    user.packages.push(packageFind._id);
    user.investment += amountNumber;
    // Automatically lock capital amount when investment is made
    user.active.isCapitalLocked = true;
    packageFind.users.push(user._id);
    await packageFind.save();
    if (!user.active.isActive) {
      user.active.isActive = true;
      user.active.activeDate = new Date();
    }
    await newTransaction.save();
    if (user.sponsor) {
      // Direct Referral Income - 10% instant to sponsor's wallet
      await levelIncomeCalculate({
        userId: user._id,
        amount: amountNumber,
        levelPercentages: [0.10], // 10% Direct Income
        levelActive: false,
      });
    }
    await user.save();
    res.status(200).json({
      success: true,
      message: "Package added successfully",
      data: user,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// exports.WalletWithdrawalRequest = async (req, res) => {
//     try {
//         const { amount } = req.body
//         if (!amount) res.status(500).json({ success: false, message: 'Amount is required.' });
//         const user = await UserModel.findById(req.user._id);
//         const incomeDetail = await IncomeModel.findById(user.incomeDetails,{"income.currentIncome":1,"withdrawal":1});

//         if (!user) res.status(500).json({ success: false, message: 'User does not exist.' });
//         const amountNumber = Number(amount);
//         if (incomeDetail.income.currentIncome < amountNumber) return res.status(500).json({ success: false, message: `Insufficient USDT balance.` });
//         const hash = await sendUsdtWithdrawal({ amount:amountNumber*0.9, toAddress: user.account, symbol: "USDT" });
//         if (!hash) return res.status({ success: false, message: 'Withdrawal failed. Possibly insufficient platform balance.' });
//         const id = await generateCustomId({ prefix: "YMK-TX", min: 10, max: 10 });
//         const newWith = new TransactionModel({ id, clientAddress: user.account, mainAddress: process.env.WALLET_ADDRESS, hash,percentage:10,role:'USER', investment: amount,user:user._id, status: "Completed", type: "Withdrawal" });
//         incomeDetail.withdrawal.amount += Number(amount);
//         incomeDetail.income.currentIncome -= Number(amount);
//         incomeDetail.withdrawal.history.push(newWith._id);
//         await user.save();
//         await incomeDetail.save();
//         await newWith.save();
//         res.status(201).json({ success: true, message: 'Withdrawal successful.' })
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ success: false, message: error.message })
//     }
// }



exports.WalletWithdrawalRequest = async (req, res) => {
  try {
    const { amount, walletAddress } = req.body;

    // Validate basic input
    if (!amount || amount <= 0 || !walletAddress)
      return res
        .status(400)
        .json({ success: false, message: "Amount and wallet address are required." });

    const user = await UserModel.findById(req.user._id);
    if (!user)
      return res.status(404).json({ success: false, message: "User does not exist." });

    // Validate wallet address
    if (!isAddress(walletAddress))
      return res
        .status(400)
        .json({ success: false, message: "Invalid Wallet Address." });

    // Check if current income is on hold
    if (user.active.isCurrentIncomeHold)
      return res.status(409).json({
        success: false,
        message: "Your current income is on hold. Please try again later.",
      });

    const incomeDetail = await IncomeModel.findById(user.incomeDetails, {
      "income.currentIncome": 1,
      withdrawal: 1,
    });
    if (!incomeDetail)
      return res
        .status(404)
        .json({ success: false, message: "Income details not found." });

    const amountNumber = Number(amount);

    // Minimum and maximum withdrawal checks
    if (amountNumber < 10)
      return res
        .status(403)
        .json({ success: false, message: "Minimum withdrawal amount is $10." });
    if (amountNumber > 500)
      return res
        .status(403)
        .json({ success: false, message: "Maximum withdrawal amount is $500." });

    // Calculate withdrawable amount (exclude locked capital if locked)
    const capitalAmount = user.investment || 0;
    const currentIncome = incomeDetail.income.currentIncome || 0;
    let withdrawableAmount = currentIncome;
    
    // If capital is locked, exclude capital amount from withdrawable balance
    if (user.active.isCapitalLocked && capitalAmount > 0) {
      withdrawableAmount = currentIncome - capitalAmount;
      if (withdrawableAmount < 0) withdrawableAmount = 0;
    }

    // Check if user has enough withdrawable balance
    if (withdrawableAmount < amountNumber) {
      const lockedMessage = user.active.isCapitalLocked 
        ? ` Your capital amount of $${capitalAmount} is locked. Only $${withdrawableAmount.toFixed(2)} is available for withdrawal.`
        : "";
      return res.status(409).json({
        success: false,
        message:
          `Insufficient balance. Please try again with an amount within your available limit.${lockedMessage}`,
      });
    }

    // Check 3x initial investment limit
    const maxWithdrawLimit = user.investment * 3;
    const newTotalWithdrawn = incomeDetail.withdrawal.amount + amountNumber;
    if (newTotalWithdrawn > maxWithdrawLimit) {
      return res.status(400).json({
        success: false,
        message:
          "You have reached the maximum withdrawal limit of 3x your initial investment. Please make a new investment.",
      });
    }

    // Calculate gas fee (4% of total amount)
    const gasFeePercentage = 4;
    const gasFee = (amountNumber * gasFeePercentage) / 100;
    const netAmount = amountNumber - gasFee;

    // Generate transaction
    const id = await generateCustomId({ prefix: "YMK-TX", min: 10, max: 10 });
    const newWith = new TransactionModel({
      id,
      clientAddress: walletAddress,
      mainAddress: process.env.WALLET_ADDRESS,
      percentage: 10,
      role: "USER",
      investment: amountNumber, // Total amount requested
      gasFee: gasFee, // Gas fee (4% of total)
      netAmount: netAmount, // Amount user will receive (total - gas fee)
      user: user._id,
      status: "Processing",
      type: "Withdrawal",
    });

    // Update income and withdrawal history
    incomeDetail.withdrawal.amount += amountNumber;
    incomeDetail.income.currentIncome -= amountNumber;
    incomeDetail.withdrawal.history.push(newWith._id);

    await user.save();
    await incomeDetail.save();
    await newWith.save();

    res.status(201).json({
      success: true,
      message:
        "Your withdrawal request has been placed successfully. Settlement will be done within 24 hours.",
      data: {
        totalAmount: amountNumber,
        gasFee: gasFee,
        netAmount: netAmount,
        transactionId: newWith._id,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.WalletWithdrawalAccepted = async (req, res) => {
  try {
    const { status, id } = req.body;
    if (!id || !status)
      return res
        .status(500)
        .json({ success: false, message: "ID & Status are required." });
    const newWith = await TransactionModel.findById(id);
    if (!newWith)
      return res.status(500).json({ success: false, message: "TX does not exist." });
    const user = await UserModel.findById(newWith.user);
    const incomeDetail = await IncomeModel.findById(user.incomeDetails, {
      "income.currentIncome": 1,
      withdrawal: 1,
    });
    if (!user)
      return res.status(500).json({ success: false, message: "User does not exist." });
    if (status === "Completed") {
      newWith.status = "Completed";
      // Note: Admin should transfer netAmount (not full investment amount)
      // The gas fee (4%) is kept by admin
    } else if (status === "Cancelled") {
      newWith.status = "Cancelled";
      incomeDetail.withdrawal.amount -= Number(newWith.investment);
      incomeDetail.income.currentIncome += Number(newWith.investment);
    }
    await incomeDetail.save();
    await newWith.save();
    res.status(201).json({ 
      success: true, 
      message: `Withdrawal ${status} Successful.`,
      data: {
        totalAmount: newWith.investment,
        gasFee: newWith.gasFee || 0,
        netAmount: newWith.netAmount || 0,
        status: newWith.status,
        note: status === "Completed" ? `Transfer net amount of $${newWith.netAmount || newWith.investment} to user. Gas fee of $${newWith.gasFee || 0} is retained by admin.` : "Withdrawal cancelled. Full amount returned to user balance."
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.WalletDepositAmount = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await UserModel.findById(req.user._id);
    if (!user)
      res.status(500).json({ success: false, message: "User does not exist." });
    if (!amount || amount <= 0)
      res.status(500).json({ success: false, message: "Amount is required." });

    // Minimum deposit validation
    const amountNumber = Number(amount);
    if (amountNumber < 100)
      return res
        .status(400)
        .json({ success: false, message: "Minimum deposit amount is $100." });

    const id = await generateCustomId({ prefix: "YMK-TX", min: 10, max: 10 });
    const newWith = new TransactionModel({
      id,
      clientAddress: "Manually Investment",
      role: "USER",
      investment: amount,
      user: user._id,
      status: "Processing",
      type: "Deposit",
    });
    await newWith.save();
    return res.status(201).json({
      success: true,
      message:
        "Your deposit request has been placed successfully. Settlement will be done within 24 hours.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDepositHistory = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id);
    if (!user)
      res.status(500).json({ success: false, message: "User does not exist." });
    const data = await TransactionModel.find({
      user: user._id,
      type: "Deposit",
      // clientAddress: "Manually Investment",  
    });
    return res
      .status(200)
      .json({ success: true, message: "Get Deposit History", data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.WalletDepositAmountAdmin = async (req, res) => {
  try {
    const { depositId } = req.params;

    const { status } = req.body;

    const newWith = await TransactionModel.findById(depositId);
    if (!newWith)
      res.status(500).json({ success: false, message: "TX does not exist." });
    const user = await UserModel.findById(newWith.user);
    if (!user)
      res.status(500).json({ success: false, message: "User does not exist." });
    if (status === "Cancelled") {
      newWith.status = status;
      return res.status(201).json({
        success: true,
        message: "deposit request has been Cancelled successfully",
      });
    }
    newWith.status = status;
    const IncomeDetail = await IncomeModel.findById(user.incomeDetails);
    IncomeDetail.income.depositWallet += Number(newWith.investment);
    await IncomeDetail.save();
    await newWith.save();
    return res.status(201).json({
      success: true,
      message: "deposit request has been Approved successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDepositHistoryAdmin = async (req, res) => {
  try {
    const data = await TransactionModel.find({
      type: "Deposit",
      clientAddress: "Manually Investment",
      status: "Processing",
    }).populate("user", "username id");
    return res
      .status(200)
      .json({ success: true, message: "Get Deposit History", data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCompletedDepositHistory = async (req, res) => {
  try {
    const data = await TransactionModel.find({
      type: "Deposit",
      clientAddress: "Manually Investment",
      status: "Completed",
    }).populate("user", "username id");
    return res
      .status(200)
      .json({ success: true, message: "Get Deposit History", data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRejectedDepositHistory = async (req, res) => {
  try {
    const data = await TransactionModel.find({
      type: "Deposit",
      clientAddress: "Manually Investment",
      status: "Cancelled",
    }).populate("user", "username id");
    return res
      .status(200)
      .json({ success: true, message: "Get Deposit History", data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DEPOSIT CARD APIs ====================

/**
 * Deposit for own ID using ROI/Level Income wallet
 * Minimum amount: $5
 */
exports.depositFromROIWallet = async (req, res) => {
  const session = await require("mongoose").startSession();
  session.startTransaction();

  try {
    const { amount } = req.body;
    const userId = req.user._id;

    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid deposit amount"
      });
    }

    const depositAmount = Number(amount);

    // Minimum deposit validation
    if (depositAmount < 5) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Minimum deposit amount is $5"
      });
    }

    const user = await UserModel.findById(userId).populate("incomeDetails").session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    let incomeDetails = user.incomeDetails;
    if (!incomeDetails) {
      incomeDetails = await IncomeModel.create([{ user: userId }], { session })[0];
      user.incomeDetails = incomeDetails._id;
      await user.save({ session });
    } else {
      incomeDetails = await IncomeModel.findById(incomeDetails._id).session(session);
    }

    // Calculate available balance from ROI and Level Income wallets
    const roiBalance = incomeDetails.income?.roiWallet || 0;
    const levelIncomeBalance = incomeDetails.income?.levelIncomeWallet || 0;
    const availableBalance = roiBalance + levelIncomeBalance;

    if (availableBalance < depositAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Requested: $${depositAmount.toFixed(2)}`
      });
    }

    // Deduct from ROI wallet first, then Level Income wallet
    let remainingAmount = depositAmount;
    if (roiBalance > 0 && remainingAmount > 0) {
      const deductFromROI = Math.min(roiBalance, remainingAmount);
      incomeDetails.income.roiWallet = roiBalance - deductFromROI;
      remainingAmount -= deductFromROI;
    }
    if (levelIncomeBalance > 0 && remainingAmount > 0) {
      const deductFromLevel = Math.min(levelIncomeBalance, remainingAmount);
      incomeDetails.income.levelIncomeWallet = levelIncomeBalance - deductFromLevel;
      remainingAmount -= deductFromLevel;
    }

    // Add to user's investment
    const previousInvestment = user.investment || 0;
    user.investment = previousInvestment + depositAmount;
    user.active.isCapitalLocked = true;
    
    if (!user.active.isActive) {
      user.active.isActive = true;
      user.active.activeDate = new Date();
    }

    // Create transaction record
    const transactionId = generateCustomId({ prefix: 'YMK-DEP', max: 14, min: 14 });
    const newTransaction = await TransactionModel.create([{
      id: transactionId,
      user: userId,
      investment: depositAmount,
      type: "Deposit",
      status: "Completed",
      role: "USER",
      clientAddress: "ROI Wallet Deposit",
      mainAddress: null,
      hash: null
    }], { session });

    user.transactions.push(newTransaction[0]._id);
    await user.save({ session });
    await incomeDetails.save({ session });

    // Trigger level income calculation if user has sponsor
    if (user.sponsor) {
      await levelIncomeCalculate({
        userId: user._id,
        amount: depositAmount,
        levelPercentages: [0.05],
        levelActive: false,
      });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: `Successfully deposited $${depositAmount.toFixed(2)} from ROI/Level Income wallet`,
      data: {
        depositedAmount: depositAmount,
        previousInvestment: previousInvestment,
        newInvestment: user.investment,
        remainingROIWallet: incomeDetails.income.roiWallet,
        remainingLevelIncomeWallet: incomeDetails.income.levelIncomeWallet,
        transactionId: transactionId
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ depositFromROIWallet Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to process deposit",
      error: error.message
    });
  }
};

/**
 * Deposit/top-up for other users using ROI/Level Income wallet
 * Minimum amount: $5
 */
exports.depositForOtherUser = async (req, res) => {
  try {
    const { amount, targetUserId } = req.body;
    const fromUserId = req.user._id;

    if (!amount || amount <= 0 || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: "Amount and target user ID are required"
      });
    }

    const depositAmount = Number(amount);

    // Minimum deposit validation
    if (depositAmount < 5) {
      return res.status(400).json({
        success: false,
        message: "Minimum deposit amount is $5"
      });
    }

    // Get target user FIRST (before starting transaction) - find by custom id field
    // Trim whitespace and try multiple lookup methods
    const trimmedTargetUserId = String(targetUserId).trim();
    console.log(`🔍 Searching for target user with ID: "${trimmedTargetUserId}"`);
    
    // Find user without session first (to verify existence and get ObjectId)
    let targetUser = await UserModel.findOne({ id: trimmedTargetUserId });
    
    // If not found by id, try username as fallback
    if (!targetUser) {
      console.log(`   ⚠️ Not found by ID, trying username...`);
      targetUser = await UserModel.findOne({ username: trimmedTargetUserId });
    }
    
    if (!targetUser) {
      console.log(`❌ Target user not found with ID/Username: "${trimmedTargetUserId}"`);
      return res.status(404).json({
        success: false,
        message: `Target user not found. Please check the user ID: ${trimmedTargetUserId}`
      });
    }
    
    console.log(`✅ Found target user: ${targetUser.id || targetUser.username} (${targetUser._id})`);
    
    // Store target user ObjectId for use in transaction
    const targetUserIdObj = targetUser._id;

    // Prevent self-deposit (use depositFromROIWallet instead)
    if (fromUserId.toString() === targetUserIdObj.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot deposit for yourself. Use deposit for own ID instead."
      });
    }

    // Now start transaction after we have both user IDs
    const session = await require("mongoose").startSession();
    session.startTransaction();

    try {
      // Get from user (who is depositing)
      const fromUser = await UserModel.findById(fromUserId).populate("incomeDetails").session(session);
      if (!fromUser) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Get target user within session
      const targetUserInSession = await UserModel.findById(targetUserIdObj).session(session);
      if (!targetUserInSession) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "Target user not found"
        });
      }

      // Prevent self-deposit (use depositFromROIWallet instead)
      if (fromUserId.toString() === targetUserInSession._id.toString()) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Cannot deposit for yourself. Use deposit for own ID instead."
        });
      }

      let fromIncomeDetails = fromUser.incomeDetails;
      if (!fromIncomeDetails) {
        fromIncomeDetails = await IncomeModel.create([{ user: fromUserId }], { session })[0];
        fromUser.incomeDetails = fromIncomeDetails._id;
        await fromUser.save({ session });
      } else {
        fromIncomeDetails = await IncomeModel.findById(fromIncomeDetails._id).session(session);
      }

      // Calculate available balance from ROI and Level Income wallets
      const roiBalance = fromIncomeDetails.income?.roiWallet || 0;
      const levelIncomeBalance = fromIncomeDetails.income?.levelIncomeWallet || 0;
      const availableBalance = roiBalance + levelIncomeBalance;

      if (availableBalance < depositAmount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Requested: $${depositAmount.toFixed(2)}`
        });
      }

      // Deduct from ROI wallet first, then Level Income wallet
      let remainingAmount = depositAmount;
      if (roiBalance > 0 && remainingAmount > 0) {
        const deductFromROI = Math.min(roiBalance, remainingAmount);
        fromIncomeDetails.income.roiWallet = roiBalance - deductFromROI;
        remainingAmount -= deductFromROI;
      }
      if (levelIncomeBalance > 0 && remainingAmount > 0) {
        const deductFromLevel = Math.min(levelIncomeBalance, remainingAmount);
        fromIncomeDetails.income.levelIncomeWallet = levelIncomeBalance - deductFromLevel;
        remainingAmount -= deductFromLevel;
      }

      // Add to target user's investment
      const previousInvestment = targetUserInSession.investment || 0;
      targetUserInSession.investment = previousInvestment + depositAmount;
      targetUserInSession.active.isCapitalLocked = true;
      
      if (!targetUserInSession.active.isActive) {
        targetUserInSession.active.isActive = true;
        targetUserInSession.active.activeDate = new Date();
      }

      // Create transaction record for target user
      const transactionId = generateCustomId({ prefix: 'YMK-TOP', max: 14, min: 14 });
      const newTransaction = await TransactionModel.create([{
        id: transactionId,
        user: targetUserInSession._id,
        investment: depositAmount,
        type: "Deposit",
        status: "Completed",
        role: "USER",
        clientAddress: `Top-up from ${fromUser.id || fromUser.username}`,
        mainAddress: null,
        hash: null
      }], { session });

      targetUserInSession.transactions.push(newTransaction[0]._id);
      await targetUserInSession.save({ session });
      await fromIncomeDetails.save({ session });

      await session.commitTransaction();
      session.endSession();

      // Trigger level income calculation AFTER transaction commits (outside transaction to avoid conflicts)
      if (targetUserInSession.sponsor) {
        try {
          await levelIncomeCalculate({
            userId: targetUserInSession._id,
            amount: depositAmount,
            levelPercentages: [0.05],
            levelActive: false,
          });
        } catch (levelIncomeError) {
          console.error("⚠️ Level income calculation failed (non-critical):", levelIncomeError.message);
          // Don't fail the whole operation if level income calculation fails
        }
      }

      return res.status(200).json({
        success: true,
        message: `Successfully deposited $${depositAmount.toFixed(2)} for user ${targetUser.id || targetUser.username}`,
        data: {
          depositedAmount: depositAmount,
          targetUserId: targetUser.id || targetUserId,
          targetUsername: targetUser.username,
          targetUserInvestment: targetUserInSession.investment,
          remainingROIWallet: fromIncomeDetails.income.roiWallet,
          remainingLevelIncomeWallet: fromIncomeDetails.income.levelIncomeWallet,
          transactionId: transactionId
        }
      });

    } catch (transactionError) {
      await session.abortTransaction();
      session.endSession();
      console.error("❌ depositForOtherUser Transaction Error:", transactionError.message);
      return res.status(500).json({
        success: false,
        message: "Failed to process deposit for other user",
        error: transactionError.message
      });
    }
  } catch (error) {
    console.error("❌ depositForOtherUser Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to process deposit for other user",
      error: error.message
    });
  }
};

/**
 * Transfer ROI wallet to another ID
 */
exports.transferROIWallet = async (req, res) => {
  const session = await require("mongoose").startSession();
  session.startTransaction();

  try {
    const { amount, targetUserId } = req.body;
    const fromUserId = req.user._id;

    if (!amount || amount <= 0 || !targetUserId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Amount and target user ID are required"
      });
    }

    const transferAmount = Number(amount);

    // Get from user
    const fromUser = await UserModel.findById(fromUserId).populate("incomeDetails").session(session);
    if (!fromUser) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get target user - find by custom id field
    // Trim whitespace and try multiple lookup methods
    const trimmedTargetUserId = String(targetUserId).trim();
    console.log(`🔍 Searching for target user with ID: "${trimmedTargetUserId}"`);
    
    // First, find user without session to verify existence
    let targetUser = await UserModel.findOne({ id: trimmedTargetUserId });
    
    // If not found by id, try username as fallback
    if (!targetUser) {
      console.log(`   ⚠️ Not found by ID, trying username...`);
      targetUser = await UserModel.findOne({ username: trimmedTargetUserId });
    }
    
    if (!targetUser) {
      await session.abortTransaction();
      session.endSession();
      console.log(`❌ Target user not found with ID/Username: "${trimmedTargetUserId}"`);
      return res.status(404).json({
        success: false,
        message: `Target user not found. Please check the user ID: ${trimmedTargetUserId}`
      });
    }
    
    console.log(`✅ Found target user: ${targetUser.id || targetUser.username} (${targetUser._id})`);
    
    // Now get the user within the session for transaction
    targetUser = await UserModel.findById(targetUser._id).session(session);

    // Prevent self-transfer
    if (fromUserId.toString() === targetUser._id.toString()) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Cannot transfer to yourself"
      });
    }

    let fromIncomeDetails = fromUser.incomeDetails;
    if (!fromIncomeDetails) {
      fromIncomeDetails = await IncomeModel.create([{ user: fromUserId }], { session })[0];
      fromUser.incomeDetails = fromIncomeDetails._id;
      await fromUser.save({ session });
    } else {
      fromIncomeDetails = await IncomeModel.findById(fromIncomeDetails._id).session(session);
    }

    // Get ROI wallet balance
    const roiBalance = fromIncomeDetails.income?.roiWallet || 0;

    if (roiBalance < transferAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient ROI wallet balance. Available: $${roiBalance.toFixed(2)}, Requested: $${transferAmount.toFixed(2)}`
      });
    }

    // Deduct from sender's ROI wallet
    fromIncomeDetails.income.roiWallet = roiBalance - transferAmount;

    // Add to receiver's ROI wallet
    let targetIncomeDetails = targetUser.incomeDetails;
    if (!targetIncomeDetails) {
      targetIncomeDetails = await IncomeModel.create([{ user: targetUser._id }], { session })[0];
      targetUser.incomeDetails = targetIncomeDetails._id;
      await targetUser.save({ session });
    } else {
      targetIncomeDetails = await IncomeModel.findById(targetIncomeDetails._id).session(session);
    }

    targetIncomeDetails.income.roiWallet = (targetIncomeDetails.income.roiWallet || 0) + transferAmount;

    // Create transaction records
    const transferId = generateCustomId({ prefix: 'YMK-TRF', max: 14, min: 14 });
    
    // Transaction for sender
    const fromTransaction = await TransactionModel.create([{
      id: generateCustomId({ prefix: 'YMK-TRF', max: 14, min: 14 }),
      user: fromUserId,
      investment: transferAmount,
      type: "Transfer",
      status: "Completed",
      role: "USER",
      clientAddress: `Transfer to ${targetUser.id || targetUser.username}`,
      mainAddress: null,
      hash: null
    }], { session });

    // Transaction for receiver
    const toTransaction = await TransactionModel.create([{
      id: transferId,
      user: targetUser._id,
      investment: transferAmount,
      type: "Transfer",
      status: "Completed",
      role: "USER",
      clientAddress: `Transfer from ${fromUser.id || fromUser.username}`,
      mainAddress: null,
      hash: null
    }], { session });

    fromUser.transactions.push(fromTransaction[0]._id);
    targetUser.transactions.push(toTransaction[0]._id);

    await fromUser.save({ session });
    await targetUser.save({ session });
    await fromIncomeDetails.save({ session });
    await targetIncomeDetails.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: `Successfully transferred $${transferAmount.toFixed(2)} to ${targetUser.id || targetUser.username}`,
      data: {
        transferredAmount: transferAmount,
        targetUserId: targetUser.id || targetUserId,
        targetUsername: targetUser.username,
        remainingROIWallet: fromIncomeDetails.income.roiWallet,
        targetROIWallet: targetIncomeDetails.income.roiWallet,
        transactionId: transferId
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ transferROIWallet Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to transfer ROI wallet",
      error: error.message
    });
  }
};

/**
 * Get ROI and Level Income wallet balances
 */
exports.getROIWalletBalance = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await UserModel.findById(userId).populate("incomeDetails");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    let incomeDetails = user.incomeDetails;
    if (!incomeDetails) {
      incomeDetails = await IncomeModel.create({ user: userId });
      user.incomeDetails = incomeDetails._id;
      await user.save();
    }

    const roiWallet = incomeDetails.income?.roiWallet || 0;
    const levelIncomeWallet = incomeDetails.income?.levelIncomeWallet || 0;
    const totalDepositWallet = roiWallet + levelIncomeWallet;

    return res.status(200).json({
      success: true,
      data: {
        roiWallet: roiWallet,
        levelIncomeWallet: levelIncomeWallet,
        totalDepositWallet: totalDepositWallet,
        currentIncome: incomeDetails.income?.currentIncome || 0
      }
    });

  } catch (error) {
    console.error("❌ getROIWalletBalance Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to get ROI wallet balance",
      error: error.message
    });
  }
};
