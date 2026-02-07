const mongoose = require('mongoose');
const { RewardTierModel } = require('../models/rewardTier.model');
const { UserModel } = require('../models/user.model');
const { IncomeModel } = require('../models/income.model');
const { TeamDivisionModel } = require('../models/teamDivision.model');
const { CommissionModel } = require('../models/commission.model');
const termsConfig = require('../config/terms.config');

/**
 * Calculate user's Main Leg and Other Leg business volumes
 * @param {ObjectId} userId - The user ID
 * @returns {Object} - { mainLegBusiness, otherLegBusiness }
 */
const calculateLegBusiness = async (userId) => {
    try {
        // Get team division data
        const teamDivision = await TeamDivisionModel.findOne({ user: userId });

        if (!teamDivision) {
            return {
                mainLegBusiness: 0,
                otherLegBusiness: 0
            };
        }

        // Main Leg = Team A (highest business direct referral)
        const mainLegBusiness = teamDivision.teamA.totalBusiness || 0;

        // Other Leg = Team B + Team C (all other team members)
        const otherLegBusiness =
            (teamDivision.teamB.totalBusiness || 0) +
            (teamDivision.teamC.totalBusiness || 0);

        return {
            mainLegBusiness,
            otherLegBusiness
        };
    } catch (error) {
        console.error('Error calculating leg business:', error);
        return {
            mainLegBusiness: 0,
            otherLegBusiness: 0
        };
    }
};

/**
 * Determine eligible rank tier based on business volumes
 * @param {Number} mainLegBusiness - Main leg business volume
 * @param {Number} otherLegBusiness - Other leg business volume
 * @returns {Object|null} - Eligible tier or null
 */
const getEligibleRank = async (mainLegBusiness, otherLegBusiness) => {
    try {
        // Get all active tiers sorted by level descending (highest first)
        const tiers = await RewardTierModel.find({ status: true })
            .sort({ level: -1 })
            .lean();

        // Find highest tier where BOTH requirements are met
        for (const tier of tiers) {
            if (mainLegBusiness >= tier.mainLegRequirement &&
                otherLegBusiness >= tier.otherLegRequirement) {
                return tier;
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting eligible rank:', error);
        return null;
    }
};

/**
 * Check if user qualifies for rank (business + wallet validation)
 * @param {Object} user - User document
 * @param {Object} tier - Reward tier document
 * @returns {Object} - { eligible, reason }
 */
const validateRankEligibility = (user, tier) => {
    // Check top-up wallet balance (validation only, no deduction)
    if (user.topUpWallet < tier.selfTopUpAmount) {
        return {
            eligible: false,
            reason: `Insufficient top-up wallet balance. Required: ${tier.selfTopUpAmount}, Available: ${user.topUpWallet}`
        };
    }

    return {
        eligible: true,
        reason: 'All requirements met'
    };
};

/**
 * Distribute rank reward to user
 * Working users: Can receive up to 3X of base reward (validation cap)
 * Non-Working users: Can receive up to 2X of base reward (validation cap)
 * @param {ObjectId} userId - User ID
 * @param {Object} tier - Reward tier
 * @param {Number} mainLegBusiness - Main leg business
 * @param {Number} otherLegBusiness - Other leg business
 * @returns {Boolean} - Success status
 */
const distributeRankReward = async (userId, tier, mainLegBusiness, otherLegBusiness) => {
    try {
        const user = await UserModel.findById(userId);
        const incomeDetails = await IncomeModel.findOne({ user: userId });

        if (!user || !incomeDetails) {
            throw new Error('User or income details not found');
        }

        // Determine maximum bonus cap based on user activity
        // Working Bonus: Maximum 3X of base reward (user is verified and active)
        // Non-Working Bonus: Maximum 2X of base reward (user is not verified or blocked)
        const isWorking = user.active?.isVerified && !user.active?.isBlocked;
        const maxBonusMultiplier = isWorking ? 3 : 2;
        const baseReward = tier.rewardAmount;

        // User can receive UP TO the maximum bonus cap
        // For now, we give the full maximum allowed bonus
        const finalReward = Math.min(baseReward * maxBonusMultiplier, baseReward * maxBonusMultiplier);

        // Add rank reward to income (base amount only)
        incomeDetails.rankRewardIncome.income += finalReward;
        incomeDetails.income.currentIncome += finalReward;
        incomeDetails.income.totalIncome += finalReward;

        // Create commission record for tracking
        const commission = new CommissionModel({
            user: userId,
            type: 'Rank Reward',
            amount: finalReward,
            description: `Achieved ${tier.tier} rank (${isWorking ? 'Working' : 'Non-Working'} - Max ${maxBonusCap}X cap: $${finalReward})`,
            status: 'approved',
            createdAt: new Date()
        });

        // Update user's current rank
        user.currentRank = {
            tier: tier.tier,
            achievedAt: new Date(),
            level: tier.level
        };

        // Add to rank history
        user.rankHistory.push({
            tier: tier.tier,
            achievedAt: new Date(),
            mainLegBusiness,
            otherLegBusiness,
            topUpWalletBalance: user.topUpWallet
        });

        // Save all changes
        await incomeDetails.save();
        await commission.save();
        await user.save();

        // Add commission to income history
        incomeDetails.rankRewardIncome.history.push(commission._id);
        await incomeDetails.save();

        console.log(`✅ Rank ${tier.tier} reward distributed to user ${user.username || user.id} - ${isWorking ? 'Working' : 'Non-Working'} (Max ${maxBonusCap}X cap): $${finalReward}`);
        return true;
    } catch (error) {
        console.error('Error distributing rank reward:', error);
        return false;
    }
};

/**
 * Calculate and award rank for a user
 * @param {ObjectId} userId - User ID
 * @returns {Object} - Result with status and message
 */
const calculateUserRank = async (userId) => {
    try {
        const user = await UserModel.findById(userId);
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Calculate leg business
        const { mainLegBusiness, otherLegBusiness } = await calculateLegBusiness(userId);

        // Get eligible rank
        const eligibleTier = await getEligibleRank(mainLegBusiness, otherLegBusiness);

        if (!eligibleTier) {
            return {
                success: false,
                message: 'No rank tier eligible',
                data: {
                    mainLegBusiness,
                    otherLegBusiness,
                    currentRank: user.currentRank?.tier || 'None'
                }
            };
        }

        // Check if already has this rank or higher
        if (user.currentRank?.level >= eligibleTier.level) {
            return {
                success: false,
                message: 'User already has this rank or higher',
                data: {
                    currentRank: user.currentRank.tier,
                    eligibleRank: eligibleTier.tier
                }
            };
        }

        // Validate eligibility (top-up wallet check)
        const validation = validateRankEligibility(user, eligibleTier);
        if (!validation.eligible) {
            return {
                success: false,
                message: validation.reason,
                data: {
                    eligibleRank: eligibleTier.tier,
                    requiredTopUp: eligibleTier.selfTopUpAmount,
                    availableTopUp: user.topUpWallet
                }
            };
        }

        // Distribute reward
        const distributed = await distributeRankReward(
            userId,
            eligibleTier,
            mainLegBusiness,
            otherLegBusiness
        );

        if (distributed) {
            return {
                success: true,
                message: `Rank ${eligibleTier.tier} achieved successfully!`,
                data: {
                    tier: eligibleTier.tier,
                    level: eligibleTier.level,
                    rewardAmount: eligibleTier.rewardAmount,
                    mainLegBusiness,
                    otherLegBusiness
                }
            };
        } else {
            return {
                success: false,
                message: 'Failed to distribute rank reward'
            };
        }
    } catch (error) {
        console.error('Error in calculateUserRank:', error);
        return {
            success: false,
            message: 'Server error',
            error: error.message
        };
    }
};

/**
 * Get user's rank progress toward next tier
 * @param {ObjectId} userId - User ID
 * @returns {Object} - Progress data
 */
const getRankProgress = async (userId) => {
    try {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Calculate current business
        const { mainLegBusiness, otherLegBusiness } = await calculateLegBusiness(userId);

        // Get current rank level
        const currentLevel = user.currentRank?.level || 0;

        // Get next tier
        const nextTier = await RewardTierModel.findOne({
            level: currentLevel + 1,
            status: true
        }).lean();

        if (!nextTier) {
            return {
                currentRank: user.currentRank?.tier || 'None',
                currentLevel,
                nextTier: null,
                message: 'Maximum rank achieved',
                mainLegBusiness,
                otherLegBusiness
            };
        }

        // Calculate progress percentages
        const mainLegProgress = Math.min(
            (mainLegBusiness / nextTier.mainLegRequirement) * 100,
            100
        );
        const otherLegProgress = Math.min(
            (otherLegBusiness / nextTier.otherLegRequirement) * 100,
            100
        );

        // Check wallet validation
        const walletSufficient = user.topUpWallet >= nextTier.selfTopUpAmount;

        return {
            currentRank: user.currentRank?.tier || 'None',
            currentLevel,
            nextTier: {
                tier: nextTier.tier,
                level: nextTier.level,
                mainLegRequirement: nextTier.mainLegRequirement,
                otherLegRequirement: nextTier.otherLegRequirement,
                rewardAmount: nextTier.rewardAmount,
                selfTopUpAmount: nextTier.selfTopUpAmount
            },
            progress: {
                mainLeg: {
                    current: mainLegBusiness,
                    required: nextTier.mainLegRequirement,
                    percentage: mainLegProgress.toFixed(2)
                },
                otherLeg: {
                    current: otherLegBusiness,
                    required: nextTier.otherLegRequirement,
                    percentage: otherLegProgress.toFixed(2)
                },
                topUpWallet: {
                    current: user.topUpWallet,
                    required: nextTier.selfTopUpAmount,
                    sufficient: walletSufficient
                }
            }
        };
    } catch (error) {
        console.error('Error getting rank progress:', error);
        throw error;
    }
};

module.exports = {
    calculateLegBusiness,
    getEligibleRank,
    validateRankEligibility,
    distributeRankReward,
    calculateUserRank,
    getRankProgress
};
