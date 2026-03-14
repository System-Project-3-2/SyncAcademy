import mongoose from "mongoose";
import logger from "../observability/logger.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 100),
      minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 10),
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000),
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000),
    });
    logger.info({ host: conn.connection.host }, "MongoDB connected");
  } catch (error) {
    logger.error({ err: error }, "MongoDB connection failed");
    process.exit(1);
  }
};

export default connectDB;