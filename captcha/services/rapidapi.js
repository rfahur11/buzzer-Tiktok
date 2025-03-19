/**
 * RapidAPI TikTok CAPTCHA Solver Service
 * 
 * Integration with RapidAPI's TikTok CAPTCHA solver using ImgBB for image hosting
 */
require('dotenv').config();

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Import ImgBB service
const imgbbService = require('./ImgBB');

// RapidAPI configuration
const RAPIDAPI_HOST = 'tiktok-captcha-solver2.p.rapidapi.com';
const RAPIDAPI_ENDPOINT = 'https://tiktok-captcha-solver2.p.rapidapi.com/tiktok/captcha';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'c4cb2ae51dmshf54538948df3545p1b59efjsnac6bfa2a5bfe';

// Flag to enable/disable simulation mode
const USE_SIMULATION = process.env.USE_SIMULATION_MODE === 'true';

console.log('\n=== RAPIDAPI CAPTCHA SOLVER CONFIGURATION ===');
console.log(`API Key: ${RAPIDAPI_KEY ? 'Set ✅' : 'Missing ❌'} (${RAPIDAPI_KEY.length} chars)`);
console.log(`USE_SIMULATION_MODE env: ${process.env.USE_SIMULATION_MODE}`);
console.log(`USE_SIMULATION value: ${USE_SIMULATION}`);
console.log(`API Endpoint: ${RAPIDAPI_ENDPOINT}`);
console.log('==============================================\n');

/**
 * Helper to save debug information
 * @param {Object} data Data to save
 * @param {string} filename Filename to save to
 */
async function saveDebugData(data, filename) {
  try {
    const debugDir = path.join(__dirname, '../../../temp/debug');
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
 * Solves CAPTCHA using RapidAPI with ImgBB for image hosting
 * @param {string} imageBase64 Base64 encoded CAPTCHA image
 * @param {string} captchaType Type of CAPTCHA (puzzle, rotate, shapes)
 * @param {string} additionalImageBase64 Additional image for puzzle/rotate captchas
 * @returns {Promise<object|null>} CAPTCHA solution or null
 */
async function solveWithRapidAPI(imageBase64, captchaType, additionalImageBase64 = null) {
  try {
    console.log(`Menggunakan RapidAPI untuk menyelesaikan ${captchaType} CAPTCHA...`);
    
    // DEBUGGING: Save images for inspection
    await saveDebugData(imageBase64, `${captchaType}_outer_image.txt`);
    if (additionalImageBase64) {
      await saveDebugData(additionalImageBase64, `${captchaType}_inner_image.txt`);
    }
    
    // Check if using simulation mode
    if (USE_SIMULATION) {
      console.log("🚨 USING SIMULATED RESPONSE - Not calling real API");
      
      // Wait a bit to simulate API processing time
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
      
      // Generate simulated response
      const simulatedResponse = getSimulatedResponse(captchaType);
      console.log('Simulated response:', simulatedResponse);
      await saveDebugData(simulatedResponse, `${captchaType}_simulated_response.json`);
      return simulatedResponse;
    }
    
    // Upload images to ImgBB
    console.log('🔄 Uploading images to ImgBB...');
    
    // Upload main image
    const mainImageUrl = await imgbbService.uploadImageToImgBB(
      imageBase64,
      `${captchaType}-main`
    );
    
    if (!mainImageUrl) {
      console.error('Failed to upload main image to ImgBB');
      return null;
    }
    
    // Upload second image if it exists
    let secondImageUrl = null;
    if (additionalImageBase64) {
      secondImageUrl = await imgbbService.uploadImageToImgBB(
        additionalImageBase64,
        `${captchaType}-piece`
      );
      
      if (!secondImageUrl) {
        console.error('Failed to upload second image to ImgBB');
        return null;
      }
    }
    
    // Prepare request payload based on captcha type
    let payload;
    
    switch(captchaType) {
      case 'puzzle':
        payload = {
          cap_type: 'puzzle',
          url1: mainImageUrl,
          url2: secondImageUrl
        };
        break;
        
      case 'rotate':
        payload = {
          cap_type: 'whirl',
          url1: mainImageUrl,
          url2: secondImageUrl || ''
        };
        break;
        
      case 'shapes':
        payload = {
          cap_type: '3d',
          url: mainImageUrl
        };
        break;
        
      default:
        console.log(`CAPTCHA type ${captchaType} tidak didukung oleh RapidAPI`);
        return null;
    }
    
    // Save payload for debugging
    await saveDebugData(payload, `${captchaType}_request_payload.json`);
    
    console.log(`Mengirim request ke RapidAPI (${RAPIDAPI_ENDPOINT})`);
    console.log('Payload type:', captchaType);
    console.log('URL1:', mainImageUrl);
    if (secondImageUrl) console.log('URL2:', secondImageUrl);
    
    // Make the actual API request to RapidAPI
    const response = await axios.post(RAPIDAPI_ENDPOINT, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      },
      timeout: 30000
    });
    
    // Handle the response
    if (response.status === 200 && response.data) {
      console.log('Received valid response from RapidAPI');
      await saveDebugData(response.data, `${captchaType}_api_response.json`);
      
      // Map RapidAPI response to our standard format
      return mapRapidApiResponse(response.data, captchaType);
    } else {
      console.log(`Invalid response from RapidAPI: ${response.status}`);
      return null;
    }
    
  } catch (error) {
    console.error('Error saat menggunakan RapidAPI:', error.message);
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('\n=== NETWORK ERROR DETAILS ===');
      console.error(`- Error code: ${error.code}`);
      console.error(`- Is DNS issue: ${error.code === 'ENOTFOUND' ? 'Yes' : 'No'}`);
      console.error(`- Host: ${error.address || 'Unknown'}`);
      console.error(`- Port: ${error.port || 'Unknown'}`);
      console.error('============================\n');
    }

    if (error.response) {
      console.error('Error from RapidAPI:', error.response.status, error.response.data);
      await saveDebugData(error.response.data, `${captchaType}_api_error.json`);
    }
    
    return null;
  }
}

/**
 * Maps RapidAPI response to standardized format
 * @param {Object} apiResponse API response from RapidAPI
 * @param {string} captchaType Type of CAPTCHA
 * @returns {Object} Standardized response
 */
function mapRapidApiResponse(apiResponse, captchaType) {
  // Assuming the structure of RapidAPI response
  // Adjust according to actual API response format
  
  if (!apiResponse || !apiResponse.success) {
    return { success: false, error: apiResponse?.message || 'Unknown error' };
  }
  
  switch(captchaType) {
    case 'puzzle':
      return {
        success: true,
        offsetX: apiResponse.data.x || 0,
        solution_time: apiResponse.data.time || 1.0
      };
      
    case 'rotate':
      return {
        success: true,
        angle: apiResponse.data.angle || 0,
        solution_time: apiResponse.data.time || 1.0
      };
      
    case 'shapes':
      return {
        success: true,
        pointOneProportionX: apiResponse.data.pointX1 || 0.5,
        pointOneProportionY: apiResponse.data.pointY1 || 0.5,
        pointTwoProportionX: apiResponse.data.pointX2 || 0.6,
        pointTwoProportionY: apiResponse.data.pointY2 || 0.6,
        solution_time: apiResponse.data.time || 1.0
      };
      
    default:
      return { success: false, error: 'Unsupported CAPTCHA type' };
  }
}

/**
 * Generates simulated responses for testing
 * @param {string} captchaType Type of CAPTCHA
 * @returns {Object} Simulated solution
 */
function getSimulatedResponse(captchaType) {
  switch(captchaType) {
    case 'rotate':
      return { 
        success: true, 
        angle: Math.floor(Math.random() * 360),
        solution_time: 1.5
      };
    case 'puzzle':
      return { 
        success: true, 
        offsetX: Math.floor(Math.random() * 150) + 50,
        solution_time: 1.2
      };
    case 'shapes':
      return { 
        success: true,
        pointOneProportionX: 0.3 + (Math.random() * 0.4), 
        pointOneProportionY: 0.3 + (Math.random() * 0.4),
        pointTwoProportionX: 0.3 + (Math.random() * 0.4),
        pointTwoProportionY: 0.3 + (Math.random() * 0.4),
        solution_time: 1.8
      };
    default:
      return { 
        success: false,
        error: 'Unknown CAPTCHA type'
      };
  }
}

module.exports = {
  solveWithRapidAPI
};