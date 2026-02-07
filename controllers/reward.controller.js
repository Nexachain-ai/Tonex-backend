const { RewardModel } = require("../models/reward.model");
const { UserModel } = require("../models/user.model");
const { generateCustomId } = require("../utils/generator.uniqueid");
const { uploadToImageKit } = require("../utils/upload.imagekit");

exports.RewardCreate = async (req, res) => {
    const { title, investment, reward,percentage, status,picture,type } = req.body;
    if (!title || !investment || !type) return res.status(500).json({ success: false, message: "All fields required." })
    const rewardFind = await RewardModel.findOne({ title });
    if (rewardFind) return res.status(500).json({ success: false, message: "Already Reward Created." });
    try {
        const id = generateCustomId({})
        const newReward = new RewardModel({ id, title, investment,percentage, reward, status:true,type });
        if(picture) newReward.picture = await uploadToImageKit(picture,'Rewards')
        await newReward.save();
        res.status(201).json({ success: true, message: 'Reward created successfully', data: newReward });
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
}

exports.RewardUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { investment, reward, status,picture,percentage,type } = req.body;
        const rewardFind = await RewardModel.findById(id);
        if (!rewardFind) return res.status(404).json({ success: false, message: 'Reward not found' });
        if(picture != rewardFind.picture) rewardFind.picture = await uploadToImageKit(picture,'Rewards');
        if(investment) rewardFind.investment = investment;
        if(reward) rewardFind.reward = reward;
        if(status) rewardFind.status = status;
        if(percentage) rewardFind.percentage = percentage;
        if(type) rewardFind.type = type;
        await rewardFind.save();
        res.status(200).json({ success: true, message: 'Reward updated successfully', data: rewardFind });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
}

exports.RewardDelete = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedReward = await RewardModel.findByIdAndDelete(id);
        if (!deletedReward) return res.status(404).json({ success: false, message: 'Reward not found' });
        res.status(200).json({ success: true, message: 'Reward deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
}

exports.RewardStatusUpdate = async (req, res) => {
    const { id } = req.params;
    try {
        const updatedReward = await RewardModel.findById(id);
        if (!updatedReward) return res.status(404).json({ success: false, message: 'Reward not found' });
        updatedReward.status = !updatedReward.status;
        await updatedReward.save();
        const message = updatedReward.status ? 'Reward activated successfully' : 'Reward deactivated successfully';
        res.status(200).json({ success: true, message });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
}

exports.RewardsAdminReports = async (req, res) => {
    try {
        const rewards = await RewardModel.find({type:"Rank Reward"}).sort({ investment: 1 });
        res.status(200).json({ success: true, message: "Reward Admin Finds Successfully.", data: rewards });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

exports.RewardsGlobalAcheivers = async (req, res) => {
    try {
        const rewards = await RewardModel.find({type:"Global Archive Reward"}).sort({ investment: 1 });
        res.status(200).json({ success: true, message: "Reward Admin Finds Successfully.", data: rewards });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
exports.RewardsClientReports = async (req, res) => {
    try {
        const rewards = await RewardModel.find({ status: true }).sort({ investment: 1 });

        res.status(200).json({ success: true, message: 'Reward Client Finds Successfully.', data: rewards });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

exports.RewardsGlobalAcheiversStatusUpdate = async (req, res) => {
    const { id } = req.params;
    try {
        const updatedReward = await RewardModel.findById(id);
        if (!updatedReward) return res.status(404).json({ success: false, message: 'Reward not found' });
        updatedReward.status = !updatedReward.status;
        await updatedReward.save();
        const message = updatedReward.status ? 'Reward activated successfully' : 'Reward deactivated successfully';
        res.status(200).json({ success: true, message });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
}


exports.RewardsGlobalAcheiversUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { investment, reward, status,picture,percentage,type } = req.body;
        const rewardFind = await RewardModel.findById(id);
        if (!rewardFind) return res.status(404).json({ success: false, message: 'Reward not found' });
        if(picture != rewardFind.picture) rewardFind.picture = await uploadToImageKit(picture,'Rewards');
        if(investment) rewardFind.investment = investment;
        if(reward) rewardFind.reward = reward;
        if(status) rewardFind.status = status;
        if(percentage) rewardFind.percentage = percentage;
        if(type) rewardFind.type = type;
        await rewardFind.save();
        res.status(200).json({ success: true, message: 'Reward updated successfully', data: rewardFind });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
}