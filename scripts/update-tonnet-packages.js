const mongoose = require('mongoose');
const { PackageModel } = require('../models/package.model');
const { generateCustomId } = require('../utils/generator.uniqueid');
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

// Main function to update packages
const updatePackages = async () => {
    try {
        console.log('Starting package update process...');
        
        // Step 1: Delete all existing packages
        const deleteResult = await PackageModel.deleteMany({});
        console.log(`✓ Deleted ${deleteResult.deletedCount} existing packages`);
        
        // Step 2: Create new TONNET packages
        const newPackages = [
            {
                id: generateCustomId({ prefix: "TONNET", min: 7, max: 7 }),
                title: "TONNET Package 1",
                minAmount: 20,
                maxAmount: 5000,
                percentage: 0.3,
                perDayRoi: 0.3,
                status: true,
                tags: ["Package 1", "TONNET", "Trading Income"],
                picture: null // You can add a picture URL if needed
            },
            {
                id: generateCustomId({ prefix: "TONNET", min: 7, max: 7 }),
                title: "TONNET Package 2",
                minAmount: 5001,
                maxAmount: 50000,
                percentage: 0.5,
                perDayRoi: 0.5,
                status: true,
                tags: ["Package 2", "TONNET", "Trading Income"],
                picture: null // You can add a picture URL if needed
            }
        ];
        
        const createdPackages = await PackageModel.insertMany(newPackages);
        console.log(`✓ Created ${createdPackages.length} new TONNET packages:`);
        
        createdPackages.forEach((pkg, index) => {
            console.log(`\n  Package ${index + 1}:`);
            console.log(`    ID: ${pkg.id}`);
            console.log(`    Title: ${pkg.title}`);
            console.log(`    Range: $${pkg.minAmount} to $${pkg.maxAmount}`);
            console.log(`    Status: ${pkg.status ? 'Active' : 'Inactive'}`);
        });
        
        console.log('\n✓ Package update completed successfully!');
        
    } catch (error) {
        console.error('Error updating packages:', error);
        throw error;
    }
};

// Run the script
const run = async () => {
    try {
        await connectDB();
        await updatePackages();
        console.log('\n✓ All operations completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Script execution failed:', error);
        process.exit(1);
    }
};

run();
