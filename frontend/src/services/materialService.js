/**
 * Material Service
 * Handles all material-related API calls
 */
import api from './api';

/**
 * Helper function to ensure Cloudinary URLs are properly formatted
 * @param {string} url - The URL to validate/fix
 * @returns {string} - Properly formatted URL
 */
const ensureValidUrl = (url) => {
  if (!url) return null;
  
  // If URL doesn't start with http/https, try to fix it
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Check if it's a relative Cloudinary path
    if (url.includes('cloudinary')) {
      return `https://${url}`;
    }
  }
  
  return url;
};

/**
 * Force download a file from URL using fetch (handles CORS)
 * @param {string} url - File URL
 * @param {string} filename - Desired filename
 */
const downloadFile = async (url, filename) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download failed');
    
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up blob URL
    window.URL.revokeObjectURL(blobUrl);
    return true;
  } catch (error) {
    // Fallback: open in new tab
    window.open(url, '_blank');
    return false;
  }
};

/**
 * Build Cloudinary download URL by injecting fl_attachment flag
 * Forces the browser to download instead of displaying the file
 */
const getCloudinaryDownloadUrl = (url) => {
  if (!url) return url;
  if (url.includes('res.cloudinary.com')) {
    return url.replace(
      /\/(image|raw|video)\/(upload|authenticated|private)\//,
      '/$1/$2/fl_attachment/'
    );
  }
  return url;
};

const materialService = {
  /**
   * Get all materials with optional pagination
   * @param {Object} params - Optional { page, limit, sort, search, type, courseNo }
   * @returns {Promise} API response with materials array or paginated response
   */
  getAllMaterials: async (params = {}) => {
    const response = await api.get('/materials', { params });
    return response.data;
  },

  /**
   * Get a single material by ID
   * @param {string} materialId - Material ID
   * @returns {Promise} API response with material data
   */
  getMaterialById: async (materialId) => {
    const response = await api.get(`/materials/${materialId}`);
    return response.data;
  },

  /**
   * Upload a new material (Teacher/Admin only)
   * @param {FormData} formData - Contains file, title, course, type
   * @returns {Promise} API response with created material
   */
  uploadMaterial: async (formData) => {
    const response = await api.post('/materials/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Update a material (Teacher - own only, Admin - any)
   * @param {string} materialId - Material ID to update
   * @param {Object} data - Updated material data
   * @returns {Promise} API response
   */
  updateMaterial: async (materialId, data) => {
    const response = await api.put(`/materials/${materialId}`, data);
    return response.data;
  },

  /**
   * Delete a material by ID (Teacher - own only, Admin - any)
   * @param {string} materialId - Material ID to delete
   * @returns {Promise} API response
   */
  deleteMaterial: async (materialId) => {
    const response = await api.delete(`/materials/${materialId}`);
    return response.data;
  },

  /**
   * Search materials using semantic search
   * @param {Object} searchParams - { query, course?, type? }
   * @returns {Promise} API response with search results
   */
  searchMaterials: async (searchParams) => {
    const response = await api.post('/search', searchParams);
    return response.data;
  },

  /**
   * Get signed URL for a material (for viewing/downloading restricted files)
   * @param {string} materialId - Material ID
   * @returns {Promise} API response with { url, signed }
   */
  getSignedUrl: async (materialId) => {
    const response = await api.get(`/materials/${materialId}/signed-url`);
    return response.data;
  },

  /**
   * Download a material file using fetch blob (handles CORS)
   * @param {string} url - File URL
   * @param {string} filename - Filename to save as
   */
  downloadFile,

  /**
   * Get Cloudinary download URL (with fl_attachment flag)
   * @param {string} url - Cloudinary file URL
   * @returns {string} URL that triggers browser download
   */
  getDownloadUrl: getCloudinaryDownloadUrl,

  /**
   * Validate a URL
   */
  ensureValidUrl,
};

export default materialService;
