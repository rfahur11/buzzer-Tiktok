/**
 * Shapes CAPTCHA handler
 * 
 * Handles the shapes type CAPTCHA where specific points need to be
 * clicked in the correct order
 */

const { checkForCaptcha } = require('../detection');
const { solveWithExternalService } = require('../services/rapidapi');

/**
 * Handles TikTok shapes CAPTCHA
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

module.exports = {
  handleShapesCaptcha
};