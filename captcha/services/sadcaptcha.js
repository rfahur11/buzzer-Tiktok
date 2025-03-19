/**
 * SadCaptcha Service Module
 * 
 * Handles integration with SadCaptcha external API service for solving
 * different types of TikTok CAPTCHAs
 */
require('dotenv').config();

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// SadCaptcha API configuration - Update to match documentation
const SADCAPTCHA_BASE_URL = 'https://www.sadcaptcha.com/api/v1';
const SADCAPTCHA_LICENSE_KEY = process.env.SADCAPTCHA_API_KEY || '';

// Flag to enable/disable simulation mode
const USE_SIMULATION = process.env.USE_SIMULATION_MODE === 'true' || !SADCAPTCHA_LICENSE_KEY;

console.log('\n=== SADCAPTCHA SOLVER CONFIGURATION ===');
console.log(`API Key: ${SADCAPTCHA_LICENSE_KEY ? 'Set ✅' : 'Missing ❌'}`);
console.log(`API URL: ${SADCAPTCHA_BASE_URL}`);
console.log(`Simulation Mode: ${USE_SIMULATION ? 'Enabled' : 'Disabled'}`);
console.log('=======================================\n');

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
 * Sends CAPTCHA images to SadCaptcha service for solving
 * @param {string} imageBase64 Base64 encoded CAPTCHA image
 * @param {string} captchaType Type of CAPTCHA to solve (puzzle, rotate, shapes)
 * @param {string} additionalImageBase64 Additional image for puzzle/rotate captchas
 * @returns {Promise<object|null>} CAPTCHA solution or null if failed
 */
async function solveWithExternalService(imageBase64, captchaType, additionalImageBase64 = null) {
  try {
    console.log(`Menggunakan SadCaptcha untuk menyelesaikan ${captchaType} CAPTCHA...`);
    
    // DEBUGGING: Save images for inspection
    await saveDebugData(imageBase64, `${captchaType}_outer_image.txt`);
    if (additionalImageBase64) {
      await saveDebugData(additionalImageBase64, `${captchaType}_inner_image.txt`);
    }
    
    // Prepare request payload based on captcha type
    let endpoint, payload;
    
    switch(captchaType) {
      case 'rotate':
        // Update to match documentation
        endpoint = `${SADCAPTCHA_BASE_URL}/rotate?licenseKey=${SADCAPTCHA_LICENSE_KEY}`;
        payload = {
          'outerImageB64': imageBase64,
          'innerImageB64': additionalImageBase64
        };
        break;
        
      case 'puzzle':
        endpoint = `${SADCAPTCHA_BASE_URL}/puzzle?licenseKey=${SADCAPTCHA_LICENSE_KEY}`;
        payload = {
          'outerImageB64': imageBase64,
          'innerImageB64': additionalImageBase64
        };
        break;
        
      case 'shapes':
        endpoint = `${SADCAPTCHA_BASE_URL}/shapes?licenseKey=${SADCAPTCHA_LICENSE_KEY}`;
        payload = {
          'imageB64': imageBase64
        };
        break;
        
      default:
        console.log(`CAPTCHA type ${captchaType} tidak didukung oleh SadCaptcha`);
        return null;
    }
    
    // Save truncated payload for debugging
    const logPayload = {...payload};
    if (logPayload.outerImageB64) logPayload.outerImageB64 = `[Base64 string length: ${logPayload.outerImageB64.length}]`;
    if (logPayload.innerImageB64) logPayload.innerImageB64 = `[Base64 string length: ${logPayload.innerImageB64.length}]`;
    if (logPayload.imageB64) logPayload.imageB64 = `[Base64 string length: ${logPayload.imageB64.length}]`;
    await saveDebugData(logPayload, `${captchaType}_request_payload.json`);
    await saveDebugData({ endpoint }, `${captchaType}_request_endpoint.txt`);
    
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
    
    // REAL API MODE
    console.log(`Mengirim request ke ${endpoint}`);
    console.log(`Payload size: ~ ${Math.round((JSON.stringify(payload).length)/1024)} KB`);
    
    // Make the actual API request
    const response = await axios.post(endpoint, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Handle the API response
    if (response.status === 200 && response.data) {
      console.log('Received valid response from SadCaptcha API');
      await saveDebugData(response.data, `${captchaType}_api_response.json`);
      return response.data;
    } else {
      console.log(`Invalid response from SadCaptcha: ${response.status}`);
      return null;
    }
    
  } catch (error) {
    console.error('Error saat menggunakan SadCaptcha:', error.message);
    
    if (error.response) {
      console.error('Error from SadCaptcha API:', error.response.status, error.response.data);
      await saveDebugData(error.response.data, `${captchaType}_api_error.json`);
    }
    
    return null;
  }
}

/**
 * Generates a simulated response for testing
 * @param {string} captchaType Type of CAPTCHA
 * @returns {object} Simulated solution response
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
  solveWithExternalService
};