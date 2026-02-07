const mongoose = require('mongoose');
const { PackageModel } = require('../models/package.model');
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

// View packages
const viewPackages = async () => {
    try {
        const packages = await PackageModel.find({}).select('-users');
        console.log('\n📦 Current TONNET Packages:\n');
        
        packages.forEach((pkg, index) => {
            console.log(`Package ${index + 1}:`);
            console.log(`  ID: ${pkg.id}`);
            console.log(`  Title: ${pkg.title}`);
            console.log(`  Range: $${pkg.minAmount} to $${pkg.maxAmount}`);
            console.log(`  Daily ROI: ${pkg.perDayRoi}%`);
            console.log(`  Percentage: ${pkg.percentage}%`);
            console.log(`  Status: ${pkg.status ? 'Active ✅' : 'Inactive ❌'}`);
            console.log(`  Tags: ${pkg.tags.join(', ')}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Error viewing packages:', error);
        throw error;
    }
};

// Run the script
const run = async () => {
    try {
        await connectDB();
        await viewPackages();
        console.log('✓ Package verification completed!');
        process.exit(0);
    } catch (error) {
        console.error('Script execution failed:', error);
        process.exit(1);
    }
};

run();
