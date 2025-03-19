/**
 * CAPTCHA handling module
 * 
 * Main logic for solving various types of CAPTCHAs
 */

const fs = require('fs');
const path = require('path');

// Import required functionality from other modules
const { checkForCaptcha, identifyCaptchaType } = require('./detection');
const { handlePuzzleCaptcha, handleRotateCaptcha, handleShapesCaptcha } = require('./types');
const { saveScreenshot } = require('./utils/screenshots');

/**
 * Handles CAPTCHA solving using SadCaptcha API
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether CAPTCHA was solved successfully
 */
async function handleCaptcha(page) {
  try {
    console.log('Menangani CAPTCHA...');
    
    // Take screenshots for analysis
    const screenshotDir = path.join(__dirname, '../data/captcha-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    const screenshotPath = path.join(screenshotDir, `captcha_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath });
    saveScreenshot(screenshotPath);
    
    // Check CAPTCHA type using detection module
    const captchaType = await identifyCaptchaType(page);
    console.log(`Tipe CAPTCHA terdeteksi: ${captchaType}`);
    
    // Try to solve CAPTCHA based on its type
    let solved = false;
    
    switch (captchaType) {
      case 'puzzle':
        solved = await handlePuzzleCaptcha(page);
        break;
        
      case 'rotate':
        solved = await handleRotateCaptcha(page);
        break;
        
      case 'shapes':
        solved = await handleShapesCaptcha(page);
        break;
        
      default:
        console.log(`CAPTCHA tipe '${captchaType}' tidak didukung oleh SadCaptcha API.`);
        return false;
    }
    
    if (solved) {
      console.log('CAPTCHA berhasil diselesaikan dengan SadCaptcha API!');
    } else {
      console.log('Gagal menyelesaikan CAPTCHA dengan SadCaptcha API.');
    }
    
    return solved;
    
  } catch (error) {
    console.error('Error saat menangani CAPTCHA:', error);
    return false;
  }
}

module.exports = {
  handleCaptcha
};