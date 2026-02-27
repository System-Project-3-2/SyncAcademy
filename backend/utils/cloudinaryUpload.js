import cloudinary from "../config/cloudinary.js";
import fs from "fs";

/**
 * Upload document to Cloudinary (PDF, DOCX, PPTX, etc.)
 * @param {string} filePath - Local file path
 * @returns {string} - Secure Cloudinary URL
 */
const uploadToCloudinary = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "student-aid/materials",
      resource_type: "auto",   
      type: "upload",
      access_mode: "public",
    });

    console.log("Cloudinary upload success:", {
      public_id: result.public_id,
      secure_url: result.secure_url,
      resource_type: result.resource_type,
      format: result.format,
    });

    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Failed to upload document to Cloudinary");
  } finally {
    // Cleanup local temp file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

export default uploadToCloudinary;