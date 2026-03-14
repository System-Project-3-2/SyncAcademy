import JobStatus from "../models/jobStatusModel.js";

export const getMyJobs = async (req, res) => {
  try {
    const { page = 1, limit = 20, queue, state } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = { requestedBy: req.user._id };
    if (queue) filter.queue = queue;
    if (state) filter.state = state;

    const [data, total] = await Promise.all([
      JobStatus.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      JobStatus.countDocuments(filter),
    ]);

    res.json({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getJobById = async (req, res) => {
  try {
    const job = await JobStatus.findOne({ jobId: req.params.id, requestedBy: req.user._id }).lean();
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
