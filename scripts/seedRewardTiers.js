require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const { RewardTierModel } = require('../models/rewardTier.model');
const { generateCustomId } = require('../utils/generator.uniqueid');

// Tier data from the provided images
const tierData = [
    // Tiers 1-5
    { tier: "T1", level: 1, mainLeg: 5000, otherLeg: 5000, reward: 250, selfTopUp: 100 },
    { tier: "T2", level: 2, mainLeg: 10000, otherLeg: 10000, reward: 500, selfTopUp: 200 },
    { tier: "T3", level: 3, mainLeg: 30000, otherLeg: 30000, reward: 1000, selfTopUp: 500 },
    { tier: "T4", level: 4, mainLeg: 50000, otherLeg: 50000, reward: 1500, selfTopUp: 750 },
    { tier: "T5", level: 5, mainLeg: 100000, otherLeg: 100000, reward: 5000, selfTopUp: 1000 },

    // Tiers 6-10
    { tier: "T6", level: 6, mainLeg: 250000, otherLeg: 250000, reward: 7500, selfTopUp: 2000 },
    { tier: "T7", level: 7, mainLeg: 500000, otherLeg: 500000, reward: 10000, selfTopUp: 3000 },
    { tier: "T8", level: 8, mainLeg: 1000000, otherLeg: 1000000, reward: 20000, selfTopUp: 5000 },
    { tier: "T9", level: 9, mainLeg: 2000000, otherLeg: 2000000, reward: 30000, selfTopUp: 7500 },
    { tier: "T10", level: 10, mainLeg: 5000000, otherLeg: 5000000, reward: 50000, selfTopUp: 10000 }
];

const seedRewardTiers = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.DATABASE_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');

        // Check if tiers already exist
        const existingCount = await RewardTierModel.countDocuments();
        if (existingCount > 0) {
            console.log(`⚠️  ${existingCount} reward tiers already exist.`);
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            readline.question('Do you want to delete existing tiers and re-seed? (yes/no): ', async (answer) => {
                if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
                    await RewardTierModel.deleteMany({});
                    console.log('🗑️  Deleted existing reward tiers');
                    await insertTiers();
                } else {
                    console.log('❌ Seeding cancelled');
                    process.exit(0);
                }
                readline.close();
            });
        } else {
            await insertTiers();
        }
    } catch (error) {
        console.error('❌ Error seeding reward tiers:', error);
        process.exit(1);
    }
};

const insertTiers = async () => {
    try {
        // Create tier documents
        const tiers = tierData.map(data => ({
            id: generateCustomId({}),
            tier: data.tier,
            level: data.level,
            mainLegRequirement: data.mainLeg,
            otherLegRequirement: data.otherLeg,
            rewardAmount: data.reward,
            selfTopUpAmount: data.selfTopUp,
            status: true
        }));

        // Insert all tiers
        const result = await RewardTierModel.insertMany(tiers);
        console.log(`✅ Successfully seeded ${result.length} reward tiers`);

        // Display seeded tiers
        console.log('\n📊 Seeded Reward Tiers:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Tier  | Level | Main Leg    | Other Leg   | Reward      | Self Top-Up');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        result.forEach(tier => {
            console.log(
                `${tier.tier.padEnd(5)} | ${String(tier.level).padEnd(5)} | ` +
                `$${String(tier.mainLegRequirement).padEnd(10)} | ` +
                `$${String(tier.otherLegRequirement).padEnd(10)} | ` +
                `$${String(tier.rewardAmount).padEnd(10)} | ` +
                `$${tier.selfTopUpAmount}`
            );
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error inserting tiers:', error);
        process.exit(1);
    }
};

// Run the seeding
seedRewardTiers();
