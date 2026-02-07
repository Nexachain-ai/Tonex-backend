const cron = require('node-cron');
const { UserModel } = require('../models/user.model');
const { calculateUserRank } = require('../services/rankCalculation.service');

/**
 * Cron job to check and update user ranks daily
 * Runs every day at 2:00 AM IST
 */
const rankCheckCron = cron.schedule('0 2 * * *', async () => {
    console.log('🔄 Starting daily rank check cron job...');

    try {
        // Get all active and verified users
        const users = await UserModel.find({
            'active.isVerified': true,
            'active.isBlocked': false
        }).select('_id username id');

        console.log(`📊 Checking ranks for ${users.length} users...`);

        let successCount = 0;
        let failCount = 0;
        let upgradedCount = 0;

        for (const user of users) {
            try {
                const result = await calculateUserRank(user._id);

                if (result.success) {
                    successCount++;
                    upgradedCount++;
                    console.log(`✅ Rank upgraded for user ${user.username || user.id}: ${result.data.tier}`);
                } else {
                    successCount++;
                    // User checked but no upgrade (normal case)
                }
            } catch (error) {
                failCount++;
                console.error(`❌ Failed to check rank for user ${user.username || user.id}:`, error.message);
            }
        }

        console.log(`\n🎉 Daily rank check completed!`);
        console.log(`   Total users checked: ${users.length}`);
        console.log(`   Successfully checked: ${successCount}`);
        console.log(`   Ranks upgraded: ${upgradedCount}`);
        console.log(`   Failed: ${failCount}\n`);
    } catch (error) {
        console.error('❌ Error in rank check cron job:', error);
    }
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

console.log('⏰ Rank check cron job scheduled - Daily at 2:00 AM IST');

module.exports = rankCheckCron;
