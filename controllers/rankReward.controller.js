const { RewardTierModel } = require('../models/rewardTier.model');
const { generateCustomId } = require('../utils/generator.uniqueid');

// ==================== ADMIN CONTROLLERS ====================

/**
 * Create a new reward tier
 */
exports.createRewardTier = async (req, res) => {
    try {
        const { tier, level, mainLegRequirement, otherLegRequirement, rewardAmount, selfTopUpAmount, status } = req.body;

        // Validation
        if (!tier || !level || mainLegRequirement === undefined || otherLegRequirement === undefined ||
            rewardAmount === undefined || selfTopUpAmount === undefined) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Check if tier already exists
        const existingTier = await RewardTierModel.findOne({ tier });
        if (existingTier) {
            return res.status(400).json({
                success: false,
                message: `Tier ${tier} already exists`
            });
        }

        // Create new tier
        const id = generateCustomId({});
        const newTier = new RewardTierModel({
            id,
            tier,
            level,
            mainLegRequirement,
            otherLegRequirement,
            rewardAmount,
            selfTopUpAmount,
            status: status !== undefined ? status : true
        });

        await newTier.save();

        res.status(201).json({
            success: true,
            message: 'Reward tier created successfully',
            data: newTier
        });
    } catch (error) {
        console.error('Error creating reward tier:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * Update an existing reward tier
 */
exports.updateRewardTier = async (req, res) => {
    try {
        const { id } = req.params;
        const { mainLegRequirement, otherLegRequirement, rewardAmount, selfTopUpAmount, status } = req.body;

        const tier = await RewardTierModel.findById(id);
        if (!tier) {
            return res.status(404).json({
                success: false,
                message: 'Reward tier not found'
            });
        }

        // Update fields
        if (mainLegRequirement !== undefined) tier.mainLegRequirement = mainLegRequirement;
        if (otherLegRequirement !== undefined) tier.otherLegRequirement = otherLegRequirement;
        if (rewardAmount !== undefined) tier.rewardAmount = rewardAmount;
        if (selfTopUpAmount !== undefined) tier.selfTopUpAmount = selfTopUpAmount;
        if (status !== undefined) tier.status = status;

        await tier.save();

        res.status(200).json({
            success: true,
            message: 'Reward tier updated successfully',
            data: tier
        });
    } catch (error) {
        console.error('Error updating reward tier:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * Delete a reward tier
 */
exports.deleteRewardTier = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedTier = await RewardTierModel.findByIdAndDelete(id);
        if (!deletedTier) {
            return res.status(404).json({
                success: false,
                message: 'Reward tier not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Reward tier deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting reward tier:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * Toggle reward tier status
 */
exports.toggleRewardTierStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const tier = await RewardTierModel.findById(id);
        if (!tier) {
            return res.status(404).json({
                success: false,
                message: 'Reward tier not found'
            });
        }

        tier.status = !tier.status;
        await tier.save();

        const message = tier.status ? 'Reward tier activated successfully' : 'Reward tier deactivated successfully';

        res.status(200).json({
            success: true,
            message,
            data: tier
        });
    } catch (error) {
        console.error('Error toggling reward tier status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * Get all reward tiers (admin view)
 */
exports.getAllRewardTiers = async (req, res) => {
    try {
        const tiers = await RewardTierModel.find({}).sort({ level: 1 });

        res.status(200).json({
            success: true,
            message: 'Reward tiers retrieved successfully',
            data: tiers
        });
    } catch (error) {
        console.error('Error getting reward tiers:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * Manually trigger rank check for a specific user
 */
exports.manualRankCheck = async (req, res) => {
    try {
        const { userId } = req.params;
        const { calculateUserRank } = require('../services/rankCalculation.service');

        const result = await calculateUserRank(userId);

        res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in manual rank check:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * Get users who achieved a specific rank
 */
exports.getRankAchievers = async (req, res) => {
    try {
        const { tier } = req.params;
        const { UserModel } = require('../models/user.model');

        const users = await UserModel.find({
            'currentRank.tier': tier
        }).select('id username email currentRank topUpWallet investment').lean();

        res.status(200).json({
            success: true,
            message: `Users with rank ${tier} retrieved successfully`,
            count: users.length,
            data: users
        });
    } catch (error) {
        console.error('Error getting rank achievers:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// ==================== USER CONTROLLERS ====================

/**
 * Get current user's rank information
 */
exports.getMyRank = async (req, res) => {
    try {
        const userId = req.user._id;
        const { UserModel } = require('../models/user.model');

        const user = await UserModel.findById(userId)
            .select('currentRank rankHistory topUpWallet')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Rank information retrieved successfully',
            data: {
                currentRank: user.currentRank || { tier: 'None', level: 0 },
                topUpWallet: user.topUpWallet,
                rankHistory: user.rankHistory || []
            }
        });
    } catch (error) {
        console.error('Error getting user rank:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * Get all rank requirements (active tiers)
 */
exports.getRankRequirements = async (req, res) => {
    try {
        const tiers = await RewardTierModel.find({ status: true })
            .sort({ level: 1 })
            .select('-createdAt -updatedAt -id -status')
            .lean();

        res.status(200).json({
            success: true,
            message: 'Rank requirements retrieved successfully',
            data: tiers
        });
    } catch (error) {
        console.error('Error getting rank requirements:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * Get user's rank history
 */
exports.getRankHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { UserModel } = require('../models/user.model');

        const user = await UserModel.findById(userId)
            .select('rankHistory')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Rank history retrieved successfully',
            data: user.rankHistory || []
        });
    } catch (error) {
        console.error('Error getting rank history:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * Get user's progress toward next rank
 */
exports.getRankProgress = async (req, res) => {
    try {
        const userId = req.user._id;
        const { getRankProgress } = require('../services/rankCalculation.service');

        const progress = await getRankProgress(userId);

        res.status(200).json({
            success: true,
            message: 'Rank progress retrieved successfully',
            data: progress
        });
    } catch (error) {
        console.error('Error getting rank progress:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * Get top-up wallet balance
 */
exports.getTopUpWallet = async (req, res) => {
    try {
        const userId = req.user._id;
        const { UserModel } = require('../models/user.model');

        const user = await UserModel.findById(userId).select('topUpWallet').lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Top-up wallet balance retrieved successfully',
            data: {
                topUpWallet: user.topUpWallet
            }
        });
    } catch (error) {
        console.error('Error getting top-up wallet:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * Add funds to top-up wallet (for testing/admin)
 */
exports.addToTopUpWallet = async (req, res) => {
    try {
        const userId = req.user._id;
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }

        const { UserModel } = require('../models/user.model');
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.topUpWallet += amount;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Top-up wallet updated successfully',
            data: {
                topUpWallet: user.topUpWallet,
                amountAdded: amount
            }
        });
    } catch (error) {
        console.error('Error adding to top-up wallet:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
