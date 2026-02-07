const { IncomeModel } = require("../models/income.model");
const { UserModel } = require("../models/user.model");
const { encryptData, decryptData } = require("../utils/encrypt.data");
const { generateCustomId } = require("../utils/generator.uniqueid");
const { getToken } = require("../utils/token.generator");

async function addToSponsorTeam(userId, sponsorId) {
  try {
    // Find the new user by userId
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("User not found.");
    }

    // Start with the first sponsor
    let sponsor = await UserModel.findById(sponsorId);
    if (!sponsor) {
      throw new Error("Sponsor not found.");
    }

    // Iterate through the sponsors and update the team count for each one
    while (sponsor !== null) {
      // Add user to sponsor's total team count
      sponsor.totalTeam += 1;
      await sponsor.save();

      // Add the user to the sponsor's team list (if applicable)
      sponsor.teamMembers.push(userId);  // Assuming there's a teamMembers array
      await sponsor.save();

      // Move to the next sponsor (sponsor of the current sponsor)
      sponsor = sponsor.sponsor ? await UserModel.findById(sponsor.sponsor) : null;
    }

    console.log(`Successfully added user ${userId} to sponsor's team hierarchy.`);

  } catch (error) {
    console.error("Error adding user to sponsor team:", error.message);
  }
}


exports.WalletRegister = async (req, res) => {
  const { walletAddress, referral, username, email, countryCode, country, mobile, password } = req.body;

  try {
    if (!walletAddress || !username || !email || !mobile || !password)
      return res.status(400).json({
        success: false,
        message: "Wallet address, email, mobile & username required.",
      });

    // 🔍 Check if wallet or email/mobile already exists
    let user = await UserModel.findOne({ account: walletAddress });
    if (user)
      return res.status(400).json({
        success: true,
        message: "Your account already exists.",
      });

    let userFind = await UserModel.findOne({ $or: [{ email }, { mobile }] });
    if (userFind)
      return res.status(400).json({
        success: true,
        message: "Email & Mobile already exists.",
      });

    // 🆔 Generate custom IDs with TON-NET prefix
    const id = generateCustomId({ prefix: "TON-NET", min: 7, max: 7 });
    const newReferralid = generateCustomId({ prefix: "TON-NET", min: 7, max: 7 });

    const hashPassword = password ? await encryptData(password) : null;

    // 🧩 Handle referral (optional)
    let sponsorFind = null;
    if (referral) {
      // If referral is provided, validate it (check both referralLink and id)
      sponsorFind = await UserModel.findOne({
        $or: [
          { referralLink: referral },
          { id: referral }
        ]
      });
      if (!sponsorFind) {
        return res.status(400).json({
          success: false,
          message: "Referral user not exists.",
        });
      }
    }

    // 🆕 Create user (with or without referral)
    const newUser = new UserModel({
      id,
      username,
      email,
      mobile,
      countryCode,
      country,
      account: walletAddress,
      password: hashPassword,
      referralLink: newReferralid,
      ...(sponsorFind && { sponsor: sponsorFind._id }), // Only set sponsor if referral exists
    });

    const newIncomes = new IncomeModel({ user: newUser._id });
    newUser.incomeDetails = newIncomes._id;

    // If referral is provided, add user to sponsor's partners and team
    if (sponsorFind) {
      sponsorFind.partners.push(newUser._id);
      await sponsorFind.save();
    }

    const token = await getToken(newUser);
    newUser.token.token = token;
    newUser.active.isVerified = true;

    await newIncomes.save();
    await newUser.save();

    // Add to sponsor team hierarchy if referral exists
    if (sponsorFind) {
      await addToSponsorTeam(newUser._id, sponsorFind._id);
    }

    res.cookie("ymk", token, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Connect to wallet successfully.",
      token,
      data: newUser,
      role: newUser.role,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.WalletLogin = async (req, res) => {
  try {
    const { walletAddress, email, password } = req.body;
    if (email) {
      if (!password) return res.status(400).json({ success: false, message: 'Password is required.' });
      let user = await UserModel.findOne({ '$or': [{ email }, { id: email }] }).populate('incomeDetails sponsor');
      if (!user) return res.status(400).json({ success: false, message: 'Please Register your account.' });
      const comparePassword = await decryptData(user.password);
      if (comparePassword != password) return res.status(500).json({ success: false, message: "Invalid password." });
      if (user.active.isBlocked) return res.status(400).json({ success: false, message: 'Your account has been blocked. Please contact the admin.' });
      const token = await getToken(user);
      user.token.token = token;
      await user.save();
      res.cookie('ymk', token, { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 30 * 24 * 60 * 60 * 1000 });
      return res.status(200).json({ success: true, message: "Email login successful.", token, data: user, role: user.role });
    } else if (walletAddress) {
      let user = await UserModel.findOne({ account: RegExp(`${walletAddress}`, 'i') }).populate('incomeDetails');
      if (!user) return res.status(400).json({ success: false, message: 'Please Register your account.' });
      if (user.active.isBlocked) return res.status(400).json({ success: false, message: 'Your account has been blocked. Please contact the admin.' });
      const token = await getToken(user);
      user.token.token = token;
      await user.save();
      res.cookie('ymk', token, { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 30 * 24 * 60 * 60 * 1000 });
      return res.status(200).json({ success: true, message: "Wallet login successful.", token, data: user, role: user.role });
    } else {
      return res.status(400).json({ success: false, message: 'Wallet Address or Email with Password are required.' });
    }
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: error.message });
  }
}
// exports.WalletLogin = async (req, res) => {
//     try {
//         const { walletAddress,email,password } = req.body;
//         if (!walletAddress || !password) return res.status(400).json({ success: false, message: 'Wallet address is required.' });
//         let user = await UserModel.findOne({ account: walletAddress });
//         if (!user) return res.status(400).json({ success: false, message: 'Please Register your account.' });
//         if (user.active.isBlocked) return res.status(400).json({ success: false, message: 'Your account has been blocked. Please contact the admin.' });
//         const token = await getToken(user);
//         user.token.token = token;
//         await user.save();
//         res.cookie('ymk', token, {
//             httpOnly: true,
//             secure: true,
//             sameSite: 'Strict',
//             path: '/',
//             maxAge: 30 * 24 * 60 * 60 * 1000
//         });
//         return res.status(200).json({ success: true, message: "Connect to wallet login successfully.", token, data: user, role: user.role });
//     } catch (error) {
//         console.log(error)
//         res.status(500).json({ success: false, message: error.message });
//     }
// }
