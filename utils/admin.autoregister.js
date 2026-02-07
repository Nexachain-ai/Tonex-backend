const { AdminModel } = require('../models/admin.model');
const { getHashPassword } = require('./getpassword.password');

exports.AdminRegisterAuto = async () => {
    try {
        const { ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD} = process.env;
        
        // Validate required environment variables
        if (!ADMIN_USERNAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
            console.error('ERROR: Admin auto-registration requires ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD in .env file.');
            return;
        }
        
        const admin = await AdminModel.findOne({ email: ADMIN_EMAIL });
        if (admin) return console.log('Allready register Admin.');
        const password = await getHashPassword(ADMIN_PASSWORD)
        if (!password) return console.log('Hash Password field Invalid.');
        const newAdmin = new AdminModel({email:ADMIN_EMAIL,password,username:ADMIN_USERNAME,role:'ADMIN' });
        await newAdmin.save();
        console.log("Admin register successfully.!");
    } catch (error) {
        console.error(error);
    }
}