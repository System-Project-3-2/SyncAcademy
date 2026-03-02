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

    // Cloudinary URL format:
    // https://res.cloudinary.com/<cloud_name>/<resource_type>/<delivery_type>/v<version>/<public_id>
    // segments[0] = cloud_name, segments[1] = resource_type, segments[2] = delivery_type
    const resourceType = segments[1] || "raw";
    const deliveryType = segments[2] || "upload";

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
    // For raw resources, the public_id includes the full filename with extension.
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
