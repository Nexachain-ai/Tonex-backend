const express = require('express');
const router = express.Router();
const RankRewardController = require('../controllers/rankReward.controller');
const { isAdminLoggedIn } = require('../middleware/authenticate.middleware');
const { isLoggedIn } = require('../middleware/authenticate.middleware');

// ==================== ADMIN ROUTES ====================

// Create new reward tier
router.post('/admin/rank-tiers', isAdminLoggedIn, RankRewardController.createRewardTier);

// Update reward tier
router.put('/admin/rank-tiers/:id', isAdminLoggedIn, RankRewardController.updateRewardTier);

// Delete reward tier
router.delete('/admin/rank-tiers/:id', isAdminLoggedIn, RankRewardController.deleteRewardTier);

// Toggle reward tier status
router.patch('/admin/rank-tiers/:id/toggle', isAdminLoggedIn, RankRewardController.toggleRewardTierStatus);

// Get all reward tiers
router.get('/admin/rank-tiers', isAdminLoggedIn, RankRewardController.getAllRewardTiers);

// Manually trigger rank check for a user
router.post('/admin/rank-check/:userId', isAdminLoggedIn, RankRewardController.manualRankCheck);

// Get users who achieved a specific rank
router.get('/admin/rank-achievers/:tier', isAdminLoggedIn, RankRewardController.getRankAchievers);

// ==================== USER ROUTES ====================

// Get current user's rank
router.get('/user/my-rank', isLoggedIn, RankRewardController.getMyRank);

// Get all rank requirements
router.get('/user/rank-requirements', isLoggedIn, RankRewardController.getRankRequirements);

// Get rank history
router.get('/user/rank-history', isLoggedIn, RankRewardController.getRankHistory);

// Get rank progress
router.get('/user/rank-progress', isLoggedIn, RankRewardController.getRankProgress);

// Get top-up wallet balance
router.get('/user/topup-wallet', isLoggedIn, RankRewardController.getTopUpWallet);

// Add to top-up wallet
router.post('/user/topup-wallet/add', isLoggedIn, RankRewardController.addToTopUpWallet);

module.exports = router;
