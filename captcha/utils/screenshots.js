/**
 * Screenshot utility module for CAPTCHA handling
 * 
 * Maintains a record of CAPTCHA screenshots for analysis and debugging
 */

const fs = require('fs');
const path = require('path');

// Array to keep track of CAPTCHA screenshots
const captchaScreenshots = [];

/**
 * Gets all CAPTCHA screenshot paths
 * @returns {Array<string>} Array of screenshot paths
 */
function getCaptchaScreenshots() {
  return captchaScreenshots;
}

/**
 * Saves a reference to a CAPTCHA screenshot
 * @param {string} screenshotPath Path to the saved screenshot
 */
function saveScreenshot(screenshotPath) {
  captchaScreenshots.push(screenshotPath);
}

/**
 * Takes a screenshot of the page for CAPTCHA analysis
 * @param {Object} page Puppeteer page object
 * @param {string} [prefix='captcha'] Prefix for the screenshot filename
 * @returns {Promise<string>} Path to the saved screenshot
 */
async function takeCaptchaScreenshot(page, prefix = 'captcha') {
  // Return dummy path without taking screenshot
  console.log('Screenshot capture disabled');
  return 'screenshot-disabled';
}

/**
 * Clears the CAPTCHA screenshots array
 */
function clearScreenshots() {
  captchaScreenshots.length = 0;
}

module.exports = {
  getCaptchaScreenshots,
  saveScreenshot,
  takeCaptchaScreenshot,
  clearScreenshots
};