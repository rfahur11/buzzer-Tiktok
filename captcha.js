const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Track CAPTCHA screenshots for analysis
const captchaScreenshots = [];

/**
 * Checks if a CAPTCHA is present on the current page
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether CAPTCHA is detected
 */
async function checkForCaptcha(page) {
  return await page.evaluate(() => {
    // Check various elements that indicate presence of CAPTCHA
    const captchaIndicators = [
      // CAPTCHA container elements
      document.querySelector('.captcha-verify-container'),
      document.querySelector('.secsdk-captcha-wrapper'),
      document.querySelector('.captcha_verify_container'),
      document.querySelector('.tiktok-captcha'),
      
      // Text indicators
      document.body.innerText.includes('captcha'),
      document.body.innerText.includes('Captcha'),
      document.body.innerText.includes('Slide to verify'),
      document.body.innerText.includes('Geser untuk memverifikasi'),
      document.body.innerText.includes('Drag the puzzle'),
      
      // Slider elements
      document.querySelector('.captcha-verify-slide--slidebar'),
      document.querySelector('.secsdk-captcha-drag-icon')
    ];
    
    // Return true if any indicator is present
    return captchaIndicators.some(indicator => indicator);
  });
}

/**
 * Handles CAPTCHA solving using only SadCaptcha API
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
    captchaScreenshots.push(screenshotPath);
    
    // Check CAPTCHA type
    const captchaType = await identifyCaptchaType(page);
    console.log(`Tipe CAPTCHA terdeteksi: ${captchaType}`);
    
    // Try to solve CAPTCHA based on its type - only for supported types
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
        // No manual intervention - just report unsupported captcha
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

/**
 * Identifies the type of CAPTCHA presented
 * @param {Object} page Puppeteer page object
 * @returns {Promise<string>} Detailed CAPTCHA type identifier
 */
async function identifyCaptchaType(page) {
  return await page.evaluate(() => {
    // First check the text content for clear indicators
    const pageText = document.body.innerText.toLowerCase();
    
    // Detect by clear text indicators first
    if (pageText.includes('rotate') || pageText.includes('putar')) {
      return 'rotate';
    }
    
    if (pageText.includes('puzzle') || 
        pageText.includes('fit the puzzle') || 
        pageText.includes('drag the slider to fit')) {
      return 'puzzle';
    }
    
    if (pageText.includes('click the') || 
        pageText.includes('klik pada') || 
        pageText.includes('tap on')) {
      return 'shapes';
    }
    
    // If we didn't detect by text, try to detect by elements
    
    // TikTok puzzle/slider CAPTCHA
    if (document.querySelector('.captcha-verify-slide--slidebar') || 
        document.querySelector('.secsdk-captcha-drag-icon') ||
        document.querySelector('[id*="puzzle"]') ||
        document.querySelector('[class*="puzzle"]')) {
      
      // Check if it's a rotation CAPTCHA (often has circular elements)
      if (document.querySelector('.captcha_verify_img_rotate') ||
          document.querySelector('.tiktok-rotate-captcha') ||
          document.querySelector('[class*="rotate"]') ||
          document.querySelector('img[class*="rotate"]')) {
        return 'rotate';
      }
      
      // If we're here, it's probably a puzzle
      return 'puzzle';
    }
    
    // TikTok 3D shapes CAPTCHA (requires clicking specific points)
    if (document.querySelector('.captcha-verify-image')) {
      return 'shapes';
    }
    
    // If we can't determine specifically, look at available elements
    // like the slider which is common in puzzle CAPTCHAs
    if (document.querySelector('button[id*="captcha"]') && 
        document.querySelector('[class*="TUXButton"]')) {
      // This looks like a modern TikTok CAPTCHA - check specific indicators
      const hasSlider = document.querySelector('[id*="slider"]') || 
                        document.querySelector('[class*="slider"]');
      
      if (hasSlider) {
        return 'puzzle';
      }
    }
    
    return 'unknown';
  });
}

/**
 * Handles puzzle type CAPTCHA using SadCaptcha
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether CAPTCHA was solved successfully
 */
async function handlePuzzleCaptcha(page) {
  try {
    console.log('Menyelesaikan puzzle CAPTCHA menggunakan SadCaptcha...');
    
    // Capture puzzle image
    const puzzleImageBase64 = await page.evaluate(() => {
      const puzzleImg = document.querySelector('.captcha-verify-image');
      if (!puzzleImg) return null;
      
      // Create canvas to capture the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = puzzleImg.width;
      canvas.height = puzzleImg.height;
      ctx.drawImage(puzzleImg, 0, 0);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    
    // Capture puzzle piece image
    const pieceImageBase64 = await page.evaluate(() => {
      const pieceImg = document.querySelector('.captcha_verify_img_slide');
      if (!pieceImg) return null;
      
      // Create canvas to capture the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = pieceImg.width;
      canvas.height = pieceImg.height;
      ctx.drawImage(pieceImg, 0, 0);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    
    if (!puzzleImageBase64 || !pieceImageBase64) {
      console.log('Tidak dapat mengambil gambar puzzle CAPTCHA');
      return false;
    }
    
    // Get solution from SadCaptcha
    const solution = await solveWithExternalService(puzzleImageBase64, 'puzzle', pieceImageBase64);
    
    if (!solution || typeof solution.slideXProportion !== 'number') {
      console.log('Gagal mendapatkan solusi puzzle CAPTCHA');
      return false;
    }
    
    // Get puzzle width to calculate slide distance
    const puzzleWidth = await page.evaluate(() => {
      const puzzleImg = document.querySelector('.captcha-verify-image');
      return puzzleImg ? puzzleImg.clientWidth : 300;
    });
    
    const slideDistance = solution.slideXProportion * puzzleWidth;
    
    // Find and move the slider
    const sliderHandle = await page.$('.secsdk-captcha-drag-icon') || 
                         await page.$('.captcha-verify-slide--slidebar');
    
    if (!sliderHandle) {
      console.log('Tidak dapat menemukan slider handle');
      return false;
    }
    
    const handleBox = await sliderHandle.boundingBox();
    
    // Move cursor to slider
    await page.mouse.move(
      handleBox.x + handleBox.width / 2, 
      handleBox.y + handleBox.height / 2, 
      { steps: 10 }
    );
    
    // Press and hold mouse button
    await page.mouse.down();
    
    // Human-like slider movement
    const steps = Math.floor(Math.random() * 10) + 30;
    
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      
      // Easing function for natural movement
      let easeEffect;
      if (progress < 0.5) {
        easeEffect = 2 * progress * progress;
      } else {
        easeEffect = -1 + (4 - 2 * progress) * progress;
      }
      
      const currentDistance = slideDistance * easeEffect;
      const verticalWobble = Math.sin(progress * Math.PI) * 2 * (Math.random() - 0.5);
      
      await page.mouse.move(
        handleBox.x + handleBox.width / 2 + currentDistance,
        handleBox.y + handleBox.height / 2 + verticalWobble,
        { steps: 1 }
      );
      
      await page.evaluate(() => {
        return new Promise(resolve => setTimeout(resolve, arguments[0]));
      }, Math.floor(Math.random() * 10) + 5);
    }
    
    // Release mouse button
    await page.mouse.up();
    
    // Wait to see if CAPTCHA is solved
    await page.waitForTimeout(3000);
    
    // Check if CAPTCHA is still present
    const captchaStillExists = await checkForCaptcha(page);
    return !captchaStillExists;
    
  } catch (error) {
    console.error('Error saat menyelesaikan puzzle CAPTCHA:', error);
    return false;
  }
}

/**
 * Handles rotate type CAPTCHA using SadCaptcha
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether CAPTCHA was solved successfully
 */
async function handleRotateCaptcha(page) {
  try {
    console.log('Menyelesaikan rotate CAPTCHA menggunakan SadCaptcha...');
    
    // Capture outer image
    const outerImageBase64 = await page.evaluate(() => {
      const outerImg = document.querySelector('.captcha-verify-image');
      if (!outerImg) return null;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = outerImg.width;
      canvas.height = outerImg.height;
      ctx.drawImage(outerImg, 0, 0);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    
    // Capture inner image (the part that needs to be rotated)
    const innerImageBase64 = await page.evaluate(() => {
      const innerImg = document.querySelector('.captcha_verify_img_rotate') || 
                      document.querySelector('.tiktok-rotate-captcha-inner');
      if (!innerImg) return null;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = innerImg.width;
      canvas.height = innerImg.height;
      ctx.drawImage(innerImg, 0, 0);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    
    if (!outerImageBase64 || !innerImageBase64) {
      console.log('Tidak dapat mengambil gambar rotate CAPTCHA');
      return false;
    }
    
    // Get solution from SadCaptcha
    const solution = await solveWithExternalService(outerImageBase64, 'rotate', innerImageBase64);
    
    if (!solution || typeof solution.angle !== 'number') {
      console.log('Gagal mendapatkan solusi rotate CAPTCHA');
      return false;
    }
    
    // Get slider dimensions to calculate rotation distance
    const sliderInfo = await page.evaluate(() => {
      const slidebar = document.querySelector('.captcha_verify_slide--slidebar');
      const slideIcon = document.querySelector('.secsdk-captcha-drag-icon');
      
      if (!slidebar || !slideIcon) return { totalLength: 300, iconLength: 50 };
      
      return {
        totalLength: slidebar.clientWidth,
        iconLength: slideIcon.clientWidth
      };
    });
    
    // Calculate slide distance based on rotation angle
    const slideDistance = ((sliderInfo.totalLength - sliderInfo.iconLength) * solution.angle) / 360;
    
    // Find and move the slider
    const sliderHandle = await page.$('.secsdk-captcha-drag-icon') || 
                         await page.$('.captcha-verify-slide--slidebar');
    
    if (!sliderHandle) {
      console.log('Tidak dapat menemukan slider handle');
      return false;
    }
    
    const handleBox = await sliderHandle.boundingBox();
    
    // Move cursor to slider
    await page.mouse.move(
      handleBox.x + handleBox.width / 2, 
      handleBox.y + handleBox.height / 2, 
      { steps: 10 }
    );
    
    // Press and hold mouse button
    await page.mouse.down();
    
    // Human-like slider movement
    const steps = Math.floor(Math.random() * 10) + 30;
    
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      
      // Easing function for natural movement
      let easeEffect;
      if (progress < 0.5) {
        easeEffect = 2 * progress * progress;
      } else {
        easeEffect = -1 + (4 - 2 * progress) * progress;
      }
      
      const currentDistance = slideDistance * easeEffect;
      
      await page.mouse.move(
        handleBox.x + handleBox.width / 2 + currentDistance,
        handleBox.y + handleBox.height / 2,
        { steps: 1 }
      );
      
      await page.evaluate(() => {
        return new Promise(resolve => setTimeout(resolve, arguments[0]));
      }, Math.floor(Math.random() * 10) + 5);
    }
    
    // Release mouse button
    await page.mouse.up();
    
    // Wait to see if CAPTCHA is solved
    await page.waitForTimeout(3000);
    
    // Check if CAPTCHA is still present
    const captchaStillExists = await checkForCaptcha(page);
    return !captchaStillExists;
    
  } catch (error) {
    console.error('Error saat menyelesaikan rotate CAPTCHA:', error);
    return false;
  }
}

/**
 * Handles shapes type CAPTCHA using SadCaptcha
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether CAPTCHA was solved successfully
 */
async function handleShapesCaptcha(page) {
  try {
    console.log('Menyelesaikan shapes CAPTCHA menggunakan SadCaptcha...');
    
    // Capture shapes image
    const shapeImageBase64 = await page.evaluate(() => {
      const shapeImg = document.querySelector('.captcha-verify-image');
      if (!shapeImg) return null;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = shapeImg.width;
      canvas.height = shapeImg.height;
      ctx.drawImage(shapeImg, 0, 0);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    
    if (!shapeImageBase64) {
      console.log('Tidak dapat mengambil gambar shapes CAPTCHA');
      return false;
    }
    
    // Get solution from SadCaptcha
    const solution = await solveWithExternalService(shapeImageBase64, 'shapes');
    
    if (!solution || 
        typeof solution.pointOneProportionX !== 'number' ||
        typeof solution.pointOneProportionY !== 'number' ||
        typeof solution.pointTwoProportionX !== 'number' ||
        typeof solution.pointTwoProportionY !== 'number') {
      console.log('Gagal mendapatkan solusi shapes CAPTCHA');
      return false;
    }
    
    // Get image dimensions to calculate click positions
    const imageInfo = await page.evaluate(() => {
      const img = document.querySelector('.captcha-verify-image');
      return img ? { width: img.clientWidth, height: img.clientHeight } : { width: 300, height: 200 };
    });
    
    // Calculate pixel positions for first and second clicks
    const firstClickX = Math.round(solution.pointOneProportionX * imageInfo.width);
    const firstClickY = Math.round(solution.pointOneProportionY * imageInfo.height);
    const secondClickX = Math.round(solution.pointTwoProportionX * imageInfo.width);
    const secondClickY = Math.round(solution.pointTwoProportionY * imageInfo.height);
    
    // Get absolute position of the CAPTCHA image
    const imgPosition = await page.evaluate(() => {
      const img = document.querySelector('.captcha-verify-image');
      if (!img) return { left: 0, top: 0 };
      
      const rect = img.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    });
    
    // First click
    await page.mouse.click(
      imgPosition.left + firstClickX, 
      imgPosition.top + firstClickY
    );
    
    // Wait between clicks
    await page.waitForTimeout(Math.floor(Math.random() * 300) + 200);
    
    // Second click
    await page.mouse.click(
      imgPosition.left + secondClickX, 
      imgPosition.top + secondClickY
    );
    
    // Wait to see if CAPTCHA is solved
    await page.waitForTimeout(3000);
    
    // Check if CAPTCHA is still present
    const captchaStillExists = await checkForCaptcha(page);
    return !captchaStillExists;
    
  } catch (error) {
    console.error('Error saat menyelesaikan shapes CAPTCHA:', error);
    return false;
  }
}

/**
 * Integration with SadCaptcha solving service
 * @param {string} imageBase64 Base64 encoded CAPTCHA image
 * @param {string} captchaType Type of CAPTCHA to solve
 * @param {string} additionalImageBase64 Additional image for puzzle/rotate captchas
 * @returns {Promise<object|null>} CAPTCHA solution or null if failed
 */
async function solveWithExternalService(imageBase64, captchaType, additionalImageBase64 = null) {
  try {
    console.log(`Menggunakan SadCaptcha untuk menyelesaikan ${captchaType} CAPTCHA...`);
    
    // Configure SadCaptcha API
    const SADCAPTCHA_BASE_URL = 'https://www.sadcaptcha.com/api/v1';
    const SADCAPTCHA_LICENSE_KEY = process.env.SADCAPTCHA_API_KEY || 'YOUR_API_KEY_HERE';
    
    let endpoint, payload, response;
    
    switch(captchaType) {
      case 'shapes':
        endpoint = `${SADCAPTCHA_BASE_URL}/shapes?licenseKey=${SADCAPTCHA_LICENSE_KEY}`;
        payload = { imageB64: imageBase64 };
        break;
        
      case 'rotate':
        endpoint = `${SADCAPTCHA_BASE_URL}/rotate?licenseKey=${SADCAPTCHA_LICENSE_KEY}`;
        payload = { 
          outerImageB64: imageBase64,
          innerImageB64: additionalImageBase64
        };
        break;
        
      case 'puzzle':
        endpoint = `${SADCAPTCHA_BASE_URL}/puzzle?licenseKey=${SADCAPTCHA_LICENSE_KEY}`;
        payload = { 
          puzzleImageB64: imageBase64,
          pieceImageB64: additionalImageBase64
        };
        break;
        
      default:
        console.log(`CAPTCHA type ${captchaType} tidak didukung oleh SadCaptcha`);
        return null;
    }
    
    // Make API request
    response = await axios.post(endpoint, payload);
    
    if (response.data) {
      console.log(`CAPTCHA solution received: ${JSON.stringify(response.data)}`);
      return response.data;
    }
    
    return null;
  } catch (error) {
    console.error('Error menggunakan SadCaptcha untuk CAPTCHA:', error);
    return null;
  }
}

/**
 * Gets CAPTCHA screenshot paths for analysis
 * @returns {Array<string>} Array of screenshot paths
 */
function getCaptchaScreenshots() {
  return captchaScreenshots;
}

module.exports = {
  checkForCaptcha,
  handleCaptcha,
  getCaptchaScreenshots
};