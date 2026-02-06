import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import path from "path";

/**
 * Upload file to Cloudinary with proper configuration for document files
 * @param {string} filePath - Local file path to upload
 * @param {{ originalName?: string, mimeType?: string }} meta - Optional file metadata
 * @returns {string} - Cloudinary secure URL
 */
const uploadToCloudinary = async (filePath, meta = {}) => {
  try {
    const originalName = meta?.originalName || "";
    const mimeType = meta?.mimeType || "";

    // Multer temp filenames may lose the original extension.
    // Detect PDF via mimetype / original filename first, then fallback to temp path.
    const originalExt = path.extname(originalName).toLowerCase();
    const tempExt = path.extname(filePath).toLowerCase();
    const isPdf = mimeType === "application/pdf" || originalExt === ".pdf" || tempExt === ".pdf";
    
    const uploadOptions = {
      folder: "student-aid/materials",
      use_filename: true,
      unique_filename: true,
      access_mode: "public",
      type: "upload",
    };

    if (isPdf) {
      // Upload PDF as 'image' resource_type - Cloudinary handles PDFs specially
      // This allows for better URL accessibility and preview capabilities
      uploadOptions.resource_type = "image";
      uploadOptions.format = "pdf"; // Keep as PDF format
    } else {
      // For DOCX, PPTX, etc., use raw resource type
      uploadOptions.resource_type = "raw";
    }

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);

    // Log for debugging (remove in production)
    console.log("Cloudinary upload success:", {
      public_id: result.public_id,
      secure_url: result.secure_url,
      resource_type: result.resource_type,
      format: result.format,
    });

    // Return the secure URL
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error.message);
    throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
  } finally {
    // Clean up local temp file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      console.error("Error cleaning up temp file:", cleanupError.message);
    }
  }
};

export default uploadToCloudinary;