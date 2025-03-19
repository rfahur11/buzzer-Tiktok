/**
 * CAPTCHA Module - Main entry point
 * 
 * This module exports the public API for CAPTCHA detection and resolution
 */

const { checkForCaptcha } = require('./detection');
const { handleCaptcha } = require('./handler');
const { getCaptchaScreenshots } = require('./utils/screenshots');

/**
 * Public API
 */
module.exports = {
  // CAPTCHA detection
  checkForCaptcha,
  
  // CAPTCHA handling
  handleCaptcha,
  
  // Utility function for screenshot access
  getCaptchaScreenshots
};