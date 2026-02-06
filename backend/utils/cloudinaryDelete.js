import cloudinary from "../config/cloudinary.js";

/**
 * Delete file from Cloudinary
 * @param {string} fileUrl - Cloudinary secure URL of the file to delete
 */
const deletefromCloudinary = async (fileUrl) => {
  try {
    if (!fileUrl) {
      throw new Error("No file URL provided");
    }

    const url = new URL(fileUrl);
    const segments = url.pathname.split("/").filter(Boolean);

    // Typical Cloudinary URL: /<resource_type>/<delivery_type>/.../v123/<public_id>.<ext>
    const resourceType = segments[0] || "raw";
    const deliveryType = segments[1] || "upload";

    const versionIndex = segments.findIndex((s) => /^v\d+$/.test(s));
    if (versionIndex === -1) {
      throw new Error("Invalid Cloudinary URL format - version not found");
    }

    const publicIdParts = segments.slice(versionIndex + 1);
    if (!publicIdParts.length) {
      throw new Error("Unable to derive Cloudinary public id");
    }

    let publicId = publicIdParts.join("/");

    // For image resources, Cloudinary destroy expects public_id without extension.
    // For raw resources, public_id might include dots; try stripping a trailing extension only for image.
    if (resourceType === "image") {
      publicId = publicId.replace(/\.[^/.]+$/i, "");
    }

    console.log("Deleting from Cloudinary:", { publicId, resource_type: resourceType });

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: deliveryType,
      invalidate: true,
    });

    console.log("Cloudinary delete result:", result);

    if (result.result !== "ok" && result.result !== "not found") {
      throw new Error(`Cloudinary deletion failed: ${result.result}`);
    }

    return result;
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error.message);
    throw error;
  }
};

export default deletefromCloudinary;
