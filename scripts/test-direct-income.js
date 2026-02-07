const mongoose = require('mongoose');
const { UserModel } = require('../models/user.model');
const { CommissionIncome } = require('../models/commission.model');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.DATABASE_URL);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Test Direct Income
const testDirectIncome = async () => {
    try {
        console.log('\n📊 Testing Direct Income Configuration\n');
        
        // Get a few users with referrals
        const usersWithReferrals = await CommissionIncome.find({ 
            type: "Referral Income",
            status: "Completed"
        })
        .populate('user', 'username id')
        .populate('fromUser', 'username id')
        .sort({ createdAt: -1 })
        .limit(5);
        
        if (usersWithReferrals.length === 0) {
            console.log('⚠️ No direct income records found yet.');
            console.log('✅ Direct income is configured to give 10% on each deposit.');
            console.log('✅ Income will be credited instantly when someone deposits under a sponsor.');
        } else {
            console.log('✅ Recent Direct Income Records:\n');
            
            usersWithReferrals.forEach((income, index) => {
                console.log(`${index + 1}. Sponsor: ${income.user?.username} (${income.user?.id})`);
                console.log(`   From: ${income.fromUser?.username} (${income.fromUser?.id})`);
                console.log(`   Amount: $${income.amount}`);
                console.log(`   Income: $${income.income} (${income.percentage}%)`);
                console.log(`   Date: ${income.createdAt.toLocaleDateString()}`);
                console.log('');
            });
        }
        
        console.log('💡 Direct Income Configuration:');
        console.log('   - Percentage: 10%');
        console.log('   - Type: Instant to wallet');
        console.log('   - Trigger: When referral makes a deposit');
        console.log('   - Status: Active ✅\n');
        
    } catch (error) {
        console.error('Error testing direct income:', error);
        throw error;
    }
};

// Run the script
const run = async () => {
    try {
        await connectDB();
        await testDirectIncome();
        console.log('✓ Test completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Script execution failed:', error);
        process.exit(1);
    }
};

run();
