import mongoose from "mongoose";
import dns from "node:dns";

const SRV_DNS_ERROR = /querySrv\s+(ECONNREFUSED|ETIMEOUT|EAI_AGAIN|ENOTFOUND)/i;

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error("Error: MONGO_URI is not set");
    process.exit(1);
  }

  const connectOptions = {
    serverSelectionTimeoutMS: 20000,
    family: 4,
  };

  // Prefer IPv4 first to avoid resolver/network edge cases.
  dns.setDefaultResultOrder("ipv4first");

  try {
    const conn = await mongoose.connect(mongoUri, connectOptions);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    if (mongoUri.startsWith("mongodb+srv://") && SRV_DNS_ERROR.test(error.message)) {
      try {
        const dnsServers = process.env.MONGO_DNS_SERVERS
          ? process.env.MONGO_DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean)
          : ["8.8.8.8", "1.1.1.1"];

        dns.setServers(dnsServers);
        console.warn(
          `[MongoDB] SRV lookup failed, retrying with DNS servers: ${dnsServers.join(", ")}`
        );

        const conn = await mongoose.connect(mongoUri, connectOptions);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return;
      } catch (retryError) {
        console.error(`Error: ${retryError.message}`);
        process.exit(1);
      }
    }

    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;