require('dotenv').config();
const mongoose = require('mongoose');
const { UserModel } = require('../models/user.model');
const { IncomeModel } = require('../models/income.model');

const createTestUser = async () => {
    try {
        // Connect to database
        await mongoose.connect(process.env.DATABASE_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');

        // Check if test user already exists
        const existingUser = await UserModel.findOne({ username: 'testuser' });
        if (existingUser) {
            console.log('\n⚠️  Test user already exists!');
            console.log('=====================================');
            console.log('Username:', existingUser.username);
            console.log('User ID:', existingUser.id);
            console.log('Referral Code:', existingUser.id);
            console.log('Referral Link:', existingUser.referralLink);
            console.log('=====================================\n');
            process.exit(0);
        }

        // Generate custom ID with TON-NET prefix
        const generateCustomId = () => {
            const prefix = 'TON-NET';
            const randomNum = Math.floor(Math.random() * 10000);
            return `${prefix}${randomNum}`;
        };

        const userId = generateCustomId();

        // Create test user (password will be hashed by model pre-save hook)
        const testUser = new UserModel({
            id: userId,
            username: 'testuser',
            email: 'test@example.com',
            mobile: '1234567890',
            password: 'Test@123',
            countryCode: '+91',
            country: 'India',
            referralLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?ref=${userId}`,
            topUpWallet: 1000, // Give some initial balance for testing
            active: {
                isVerified: true,
                isBlocked: false
            },
            sponsor: null, // First user, no sponsor
            partners: [],
            totalTeam: 0
        });

        await testUser.save();

        // Create income details for test user
        const incomeDetails = new IncomeModel({
            user: testUser._id,
            income: {
                totalIncome: 0,
                currentIncome: 0,
                withdrawnIncome: 0
            },
            referralIncome: {
                income: 0,
                history: []
            },
            levelIncome: {
                income: 0,
                history: []
            },
            rankRewardIncome: {
                income: 0,
                history: []
            }
        });

        await incomeDetails.save();

        // Update user with income details reference
        testUser.incomeDetails = incomeDetails._id;
        await testUser.save();

        console.log('\n✅ Test user created successfully!');
        console.log('=====================================');
        console.log('Username: testuser');
        console.log('Password: Test@123');
        console.log('Email: test@example.com');
        console.log('Mobile: 1234567890');
        console.log('');
        console.log('🔑 REFERRAL CODE:', userId);
        console.log('🔗 Referral Link:', testUser.referralLink);
        console.log('💰 Top-Up Wallet: $1000');
        console.log('=====================================');
        console.log('\n📝 Use this referral code to test registration!\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating test user:', error);
        process.exit(1);
    }
};

createTestUser();
