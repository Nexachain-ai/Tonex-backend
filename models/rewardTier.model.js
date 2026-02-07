const mongoose = require('mongoose');

const rewardTierSchema = new mongoose.Schema({
    id: {
        type: String,
        default: null,
        trim: true,
    },
    tier: {
        type: String,
        enum: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'],
        required: [true, 'Tier is required.'],
        unique: true
    },
    level: {
        type: Number,
        min: 1,
        max: 10,
        required: [true, 'Level is required.']
    },
    mainLegRequirement: {
        type: Number,
        required: [true, 'Main Leg requirement is required.'],
        min: 0
    },
    otherLegRequirement: {
        type: Number,
        required: [true, 'Other Leg requirement is required.'],
        min: 0
    },
    rewardAmount: {
        type: Number,
        required: [true, 'Reward amount is required.'],
        min: 0
    },
    selfTopUpAmount: {
        type: Number,
        required: [true, 'Self top-up amount is required.'],
        min: 0
    },
    status: {
        type: Boolean,
        default: true
    }
}, { timestamps: true, versionKey: false });

// Index for faster queries
rewardTierSchema.index({ tier: 1 });
rewardTierSchema.index({ level: 1 });
rewardTierSchema.index({ status: 1 });

exports.RewardTierModel = mongoose.model('RewardTier', rewardTierSchema);
