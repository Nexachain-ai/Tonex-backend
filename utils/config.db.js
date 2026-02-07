// const mongoose = require('mongoose');

// const connectDB = async () => {
//     try {
//         await mongoose.connect(process.env.DATABASE_URL);
//         console.log('MongoDB connected successfully');
//     } catch (error) {
//         console.error('MongoDB connection error:', error);
//         process.exit(1);
//     }
// };

// module.exports = connectDB;

const mongoose = require("mongoose");
const dns = require("dns");

// Set DNS servers to reliable ones (Google DNS and Cloudflare DNS)
// This fixes EREFUSED errors on SRV record queries
dns.setServers([
  "8.8.8.8",      // Google DNS
  "8.8.4.4",      // Google DNS secondary
  "1.1.1.1",      // Cloudflare DNS
  "1.0.0.1"       // Cloudflare DNS secondary
]);

// const { tradingNodeCron } = require("./levelIncome.calculation");

const connectDB = async () => {
  try {
    // Validate DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    console.log("🔌 Attempting to connect to MongoDB...");
    
    // Add connection options to handle DNS issues
    const options = {
      serverSelectionTimeoutMS: 10000, // Timeout after 10s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      retryReads: true,
      // Force direct connection if SRV fails (fallback)
      directConnection: false,
    };

    // Try to connect with SRV format first
    let connectionString = process.env.DATABASE_URL;
    
    // If connection string uses mongodb+srv://, we'll handle DNS resolution
    if (connectionString.startsWith('mongodb+srv://')) {
      console.log("📍 Using MongoDB Atlas SRV connection...");
    } else {
      console.log("📍 Using direct MongoDB connection...");
    }

    await mongoose.connect(connectionString, options);
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.error("Error code:", err.code);
    console.error("Full error:", err);
    
    // Provide helpful error messages based on error type
    if (err.code === 'EREFUSED' || err.code === 'ENOTFOUND') {
      console.error("\n⚠️  DNS Resolution Error Detected:");
      console.error("The DNS server refused to answer SRV record queries.");
      console.error("\nTroubleshooting steps:");
      console.error("1. ✅ DNS servers have been set to Google DNS (8.8.8.8) and Cloudflare (1.1.1.1)");
      console.error("2. Check your internet connection");
      console.error("3. Verify your MongoDB Atlas connection string in .env file");
      console.error("4. Check if your firewall/antivirus is blocking DNS queries");
      console.error("5. If using MongoDB Atlas, ensure your IP is whitelisted in Network Access");
      console.error("6. Try using a VPN or different network");
      console.error("\n💡 Alternative solution:");
      console.error("   Convert your SRV connection string to a direct connection string:");
      console.error("   Change: mongodb+srv://user:pass@cluster.mongodb.net/db");
      console.error("   To: mongodb://user:pass@cluster-shard-00-00.mongodb.net:27017,cluster-shard-00-01.mongodb.net:27017/db?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin");
    } else if (err.message.includes('authentication')) {
      console.error("\n⚠️  Authentication Error:");
      console.error("Check your username and password in the connection string");
    } else if (err.message.includes('IP')) {
      console.error("\n⚠️  IP Whitelist Error:");
      console.error("Your IP address is not whitelisted in MongoDB Atlas");
      console.error("Add your IP address in MongoDB Atlas -> Network Access");
    }
    
    process.exit(1);
  }
};

module.exports = connectDB;

