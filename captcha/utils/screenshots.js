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
  // Create screenshots directory if it doesn't exist
  const screenshotDir = path.join(__dirname, '../../data/captcha-screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  
  // Generate filename with timestamp
  const screenshotPath = path.join(screenshotDir, `${prefix}_${Date.now()}.png`);
  
  // Take and save the screenshot
  await page.screenshot({ path: screenshotPath });
  
  // Save reference to the screenshot
  saveScreenshot(screenshotPath);
  
  return screenshotPath;
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