import Material from "../models/materialModel.js";
import Enrollment from "../models/enrollmentModel.js";
import extractPdfText from "../utils/pdfParser.js";
import extractDocText from "../utils/docParser.js";
import extractPptx from "../utils/pptxParser.js";
import uploadToCloudinary from "../utils/cloudinaryUpload.js";
import deletefromCloudinary from "../utils/cloudinaryDelete.js";

import MaterialChunk from "../models/materialChunkModel.js";
import { chunkText } from "../utils/chunkText.js";
import { embedText } from "../services/embeddingServices.js";

import cloudinary from "../config/cloudinary.js";
import Course from "../models/courseModel.js";
import { notifyEnrolledStudents } from "../utils/notificationHelper.js";
import JobStatus from "../models/jobStatusModel.js";
import { enqueueDocumentParsingJob } from "../queues/jobProducer.js";
import { QUEUE_NAMES } from "../queues/queueNames.js";
import { cacheInvalidateByPrefix } from "../middleware/cacheMiddleware.js";

import path from "path";

// Upload material (Teacher/Admin only)
export const uploadMaterial = async (req, res) => {
  try {
    const { title, courseTitle, courseNo, type } = req.body;
    const file = req.file;

    if (!req.file) {
      return res.status(400).json({ message: "File missing" });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (![".pdf", ".docx", ".pptx"].includes(ext)) {
      return res.status(400).json({ message: "Unsupported file type" });
    }

    const fileUrl = await uploadToCloudinary(file.path, {
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    const material = {
      title: title || "",
      courseTitle,
      courseNo,
      type,
      fileUrl,
      originalFileName: file.originalname,
      textContent: "",
      uploadedBy: req.user._id,
    };

    const newMaterial = await Material.create(material);

    const useAsyncMaterialProcessing = process.env.ENABLE_ASYNC_MATERIAL_PROCESSING !== "false";
    let jobId = null;

    if (useAsyncMaterialProcessing) {
      jobId = `material-parse-${newMaterial._id}-${Date.now()}`;
      const payload = {
        jobId,
        materialId: newMaterial._id,
        filePath: file.path,
        originalFileName: file.originalname,
        generateEmbeddings: true,
      };

      await JobStatus.create({
        jobId,
        queue: QUEUE_NAMES.DOCUMENT_PARSING,
        state: "queued",
        payload,
        requestedBy: req.user._id,
      });

      await enqueueDocumentParsingJob(payload);
    } else {
      let textContent = "";
      if (ext === ".pdf") {
        textContent = await extractPdfText(file.path);
      } else if (ext === ".docx") {
        textContent = await extractDocText(file.path);
      } else if (ext === ".pptx") {
        textContent = await extractPptx(file.path);
      }

      await Material.findByIdAndUpdate(newMaterial._id, { textContent });
      const chunks = chunkText(textContent, 600);
      const docs = [];
      for (const chunk of chunks) {
        const embedding = await embedText(chunk);
        docs.push({ materialId: newMaterial._id, chunkText: chunk, embedding });
      }
      if (docs.length) {
        await MaterialChunk.insertMany(docs);
      }
    }

    await cacheInvalidateByPrefix("api:");

    res.status(useAsyncMaterialProcessing ? 202 : 201).json({
      material: newMaterial,
      processing: useAsyncMaterialProcessing
        ? { status: "queued", jobId, queue: QUEUE_NAMES.DOCUMENT_PARSING }
        : { status: "completed" },
    });

    // Non-blocking: notify enrolled students
    try {
      const course = await Course.findOne({ courseNo }).lean();
      if (course) {
        notifyEnrolledStudents({
          courseId: course._id,
          type: "material_upload",
          title: "New Material Uploaded",
          message: `New material "${title || file.originalname}" has been uploaded in ${courseTitle}.Please check it out!`,
          link: `/materials`,
          sendEmailFlag: true,
        });
      }
    } catch (_) { /* best effort */ }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all materials with pagination (Admin/Student - all, Teacher - own only)
export const getAllMaterials = async (req, res) => {
  try {
    const { role, _id } = req.user;
    const { page, limit, sort = "-createdAt", search, type, courseNo } = req.query;

    // Build filter
    const filter = {};
    if (role === "teacher") {
      filter.uploadedBy = _id;
    }

    // Students only see materials from enrolled courses
    if (role === "student") {
      const enrollments = await Enrollment.find({
        student: _id,
        status: "active",
      }).populate("course", "courseNo");
      const enrolledCourseNos = enrollments
        .filter((e) => e.course)
        .map((e) => e.course.courseNo);
      filter.courseNo = { $in: enrolledCourseNos };
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { courseTitle: { $regex: search, $options: "i" } },
        { courseNo: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
      ];
    }
    if (type) filter.type = type;
    if (courseNo) filter.courseNo = courseNo;

    // If no pagination params, return all (backward compatible)
    if (!page && !limit) {
      const materials = await Material.find(filter)
        .populate("uploadedBy", "name email")
        .select("-textContent")
        .sort(sort);
      return res.status(200).json(materials);
    }

    // Paginated response
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;
    const total = await Material.countDocuments(filter);

    const materials = await Material.find(filter)
      .populate("uploadedBy", "name email")
      .select("-textContent")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      data: materials,
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

// Get single material by ID
export const getMaterialById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, _id } = req.user;

    const material = await Material.findById(id)
      .populate("uploadedBy", "name email");

    if (!material) {
      return res.status(404).json({ message: "Material not found" });
    }

    // Teachers can only access their own materials
    if (role === "teacher" && material.uploadedBy._id.toString() !== _id.toString()) {
      return res.status(403).json({ message: "Access denied. You can only view your own materials." });
    }

    res.status(200).json(material);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update material (Admin - any, Teacher - own only)
export const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, courseTitle, courseNo, type } = req.body;
    const { role, _id } = req.user;

    const material = await Material.findById(id);

    if (!material) {
      return res.status(404).json({ message: "Material not found" });
    }

    // Teachers can only update their own materials
    if (role === "teacher" && material.uploadedBy.toString() !== _id.toString()) {
      return res.status(403).json({ message: "Access denied. You can only update your own materials." });
    }

    // Update only provided fields
    if (title !== undefined) material.title = title;
    if (courseTitle) material.courseTitle = courseTitle;
    if (courseNo) material.courseNo = courseNo;
    if (type) material.type = type;

    const updatedMaterial = await material.save();
    await cacheInvalidateByPrefix("api:");

    res.status(200).json(updatedMaterial);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete material (Admin - any, Teacher - own only)
export const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, _id } = req.user;

    const material = await Material.findById(id);

    if (!material) {
      return res.status(404).json({ message: "Material not found" });
    }

    // Teachers can only delete their own materials
    if (role === "teacher" && material.uploadedBy.toString() !== _id.toString()) {
      return res.status(403).json({ message: "Access denied. You can only delete your own materials." });
    }

    // Delete from database first, then attempt Cloudinary cleanup
    await Material.findByIdAndDelete(id);
    await MaterialChunk.deleteMany({ materialId: id });

    // Attempt Cloudinary deletion but don't fail the request if it errors
    try {
      await deletefromCloudinary(material.fileUrl);
    } catch (cloudErr) {
      console.error("Cloudinary delete failed (non-blocking):", cloudErr.message);
    }

    await cacheInvalidateByPrefix("api:");

    res.status(200).json({ message: "Material deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a signed URL for a material file (helps when Cloudinary raw PDFs return 401)
export const getMaterialSignedUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, _id } = req.user;

    const material = await Material.findById(id).populate("uploadedBy", "name email");
    if (!material) {
      return res.status(404).json({ message: "Material not found" });
    }

    // Teachers can only access their own materials
    if (role === "teacher" && material.uploadedBy?._id?.toString() !== _id.toString()) {
      return res.status(403).json({ message: "Access denied. You can only view your own materials." });
    }

    const fileUrl = material.fileUrl;
    if (!fileUrl) {
      return res.status(400).json({ message: "File URL not available for this material." });
    }

    const parseCloudinaryUrl = (urlString) => {
      const url = new URL(urlString);
      const segments = url.pathname.split("/").filter(Boolean);
      // Expected: /<resource_type>/<delivery_type>/<...transforms>/v123/<public_id>.<format>
      const resourceType = segments[0];
      const deliveryType = segments[1];

      // Find version segment (v123...)
      const versionIndex = segments.findIndex((s) => /^v\d+$/.test(s));
      if (versionIndex === -1) {
        throw new Error("Invalid Cloudinary URL format (missing version)");
      }

      const publicIdParts = segments.slice(versionIndex + 1);
      if (!publicIdParts.length) {
        throw new Error("Invalid Cloudinary URL format (missing public id)");
      }

      // Cloudinary raw resources sometimes have public_id that includes dots (e.g. "file.pdf").
      // We keep BOTH variants: with extension and without extension.
      const last = publicIdParts[publicIdParts.length - 1];
      const dotIndex = last.lastIndexOf(".");
      const format = dotIndex !== -1 ? last.slice(dotIndex + 1) : undefined;
      const publicIdWithExt = publicIdParts.join("/");
      const publicIdNoExt =
        dotIndex !== -1
          ? [...publicIdParts.slice(0, -1), last.slice(0, dotIndex)].join("/")
          : publicIdWithExt;

      return {
        resourceType,
        deliveryType,
        version: segments[versionIndex],
        publicId: publicIdNoExt,
        publicIdWithExt,
        format,
      };
    };

    const parsed = parseCloudinaryUrl(fileUrl);

    // If the asset is already an image-PDF (/image/upload/...) it's typically public and works.
    // The common breakage case is PDFs uploaded under /raw/upload/... returning 401.
    // We use Cloudinary Admin API to discover the actual delivery type, then create a signed URL.
    const candidateTypes = [parsed.deliveryType, "authenticated", "private", "upload"].filter(
      (v, i, a) => v && a.indexOf(v) === i
    );

    const candidatePublicIds = [parsed.publicId, parsed.publicIdWithExt].filter(
      (v, i, a) => v && a.indexOf(v) === i
    );

    let resource;
    let resolvedType;
    let resolvedPublicId;

    for (const t of candidateTypes) {
      for (const publicId of candidatePublicIds) {
        try {
          // api.resource supports { resource_type, type }
          // If the type/public_id is wrong, Cloudinary throws a not-found error.
          resource = await cloudinary.api.resource(publicId, {
            resource_type: parsed.resourceType,
            type: t,
          });
          resolvedType = t;
          resolvedPublicId = publicId;
          break;
        } catch (e) {
          // keep trying
        }
      }
      if (resource) break;
    }

    // If we can't resolve via Admin API, fall back to the stored URL.
    if (!resource || !resolvedType || !resolvedPublicId) {
      return res.status(200).json({ url: fileUrl, signed: false });
    }

    const accessMode = resource.access_mode;
    const shouldSign = resolvedType !== "upload" || accessMode === "authenticated" || accessMode === "private";

    if (!shouldSign && resource.secure_url) {
      return res.status(200).json({ url: resource.secure_url, signed: false });
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes

    // If Cloudinary marks it as authenticated/private, the delivery type must match.
    const deliveryTypeForUrl =
      accessMode === "authenticated" ? "authenticated" : accessMode === "private" ? "private" : resolvedType;

    // Prefer the canonical public_id Cloudinary returns.
    const publicIdForUrl = resource.public_id || resolvedPublicId;

    const signedUrl = cloudinary.url(publicIdForUrl, {
      secure: true,
      sign_url: true,
      expires_at: expiresAt,
      resource_type: parsed.resourceType,
      type: deliveryTypeForUrl,
      // Only set format if Cloudinary URL parsing inferred one and the public_id doesn't already contain it.
      format: parsed.format,
      version: resource.version,
    });

    return res.status(200).json({ url: signedUrl, signed: true, expiresAt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
