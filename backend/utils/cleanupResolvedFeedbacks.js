import cron from "node-cron";
import Feedback from "../models/feedbackModel.js";
import logger from "../observability/logger.js";

const deleteResolvedFeedbacks = () => {
  cron.schedule("0 * * * *", async () => {
    // runs every hour
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = await Feedback.deleteMany({
        status: "resolved",
        resolvedAt: { $lte: oneDayAgo },
      });

      if (result.deletedCount > 0) {
        logger.info({ deletedCount: result.deletedCount }, "Resolved feedbacks deleted");
      }
    } catch (error) {
      logger.error({ err: error }, "Feedback cleanup error");
    }
  });
};

export default deleteResolvedFeedbacks;
