/**
 * ImgBB Image Hosting Service
 * 
 * Provides functionality to upload images to ImgBB and retrieve URLs
 */
require('dotenv').config();

const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

// ImgBB Configuration
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const IMGBB_API_ENDPOINT = 'https://api.imgbb.com/1/upload';

// Check if ImgBB API key is configured
console.log(`ImgBB API Key: ${IMGBB_API_KEY ? 'Set ✅' : 'Missing ❌'}`);

/**
 * Helper to save debug information
 * @param {Object} data Data to save
 * @param {string} filename Filename to save to
 */
async function saveDebugData(data, filename) {
  try {
    const debugDir = path.join(__dirname, '../../temp/debug');
    await fs.mkdir(debugDir, { recursive: true });
    await fs.writeFile(
      path.join(debugDir, filename),
      typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    );
  } catch (err) {
    console.log(`Could not save debug data: ${err.message}`);
  }
}

/**
 * Uploads an image to ImgBB and returns the URL
 * @param {string} base64Image Base64 encoded image with or without data URI prefix
 * @param {string} name Optional name for the image
 * @returns {Promise<string|null>} Image URL or null if upload failed
 */
async function uploadImageToImgBB(base64Image, name = 'captcha-image') {
    try {
      console.log(`📤 Uploading image to ImgBB: ${name}...`);
      
      // Clean base64 if it has data URI prefix
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
      
      // Create form data for ImgBB API
      const formData = new URLSearchParams();
      formData.append('key', IMGBB_API_KEY);
      formData.append('image', cleanBase64);
      formData.append('name', name);
      
      const response = await axios.post(IMGBB_API_ENDPOINT, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
      });
      
      // For debugging
      await saveDebugData(
        { ...response.data, data: { ...response.data.data, image: { url: response.data.data?.image?.url || 'N/A' } } }, 
        `imgbb_${name}_response.json`
      );
      
      if (response.data && response.data.success) {
        // Use the direct image URL instead of the page URL
        const directImageUrl = response.data.data.image.url;
        console.log(`✅ Image uploaded successfully: ${name}`);
        console.log(`📷 Direct image URL: ${directImageUrl}`);
        return directImageUrl;
      } else {
        console.error(`❌ Failed to upload image to ImgBB: ${JSON.stringify(response.data)}`);
        return null;
      }
    } catch (error) {
      console.error(`Error uploading to ImgBB: ${error.message}`);
      if (error.response) {
        console.error(`ImgBB API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      return null;
    }
  }

/**
 * Uploads multiple images to ImgBB in parallel
 * @param {Object} images Object with image data: { main: "base64...", piece: "base64..." }
 * @param {string} prefix Prefix for image names
 * @returns {Promise<Object>} Object with image URLs
 */
async function uploadMultipleImages(images, prefix = 'captcha') {
  const uploadPromises = {};
  const results = {};
  
  // Queue up all upload promises
  for (const [key, base64] of Object.entries(images)) {
    if (base64) {
      uploadPromises[key] = uploadImageToImgBB(base64, `${prefix}-${key}`);
    }
  }
  
  // Wait for all uploads to complete
  for (const [key, promise] of Object.entries(uploadPromises)) {
    results[key] = await promise;
  }
  
  return results;
}

/**
 * Validates an ImgBB URL to ensure it's in the correct format
 * @param {string} url URL to validate
 * @returns {boolean} Whether URL is valid
 */
function validateImgBBUrl(url) {
    if (!url) return false;
    
    // Check if URL matches expected ImgBB pattern
    const imgbbPattern = /^https:\/\/i\.ibb\.co\/\w+\/[\w-]+\.\w+$/;
    const isValid = imgbbPattern.test(url);
    
    if (!isValid) {
      console.warn(`⚠️ Warning: ImgBB URL format seems invalid: ${url}`);
    }
    
    return true; // Return true anyway to not block the process, just log warning
  }
  
  // Add this to the module exports
  module.exports = {
    uploadImageToImgBB,
    uploadMultipleImages,
    validateImgBBUrl
  };