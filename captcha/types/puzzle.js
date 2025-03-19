/**
 * Puzzle CAPTCHA handler
 * 
 * Handles the sliding puzzle type CAPTCHA where a piece needs to be
 * moved into the correct position to complete an image
 */

const { checkForCaptcha } = require('../detection');
const { solveWithExternalService } = require('../services/rapidapi');

/**
 * Handles TikTok sliding puzzle CAPTCHA
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether CAPTCHA was solved successfully
 */
async function handlePuzzleCaptcha(page) {
  try {
    console.log('Menyelesaikan puzzle CAPTCHA menggunakan SadCaptcha...');
    
    // Extract the background and puzzle piece images
    const [backgroundImageBase64, puzzlePieceBase64] = await page.evaluate(() => {
      // Find the container with both images
      const container = document.querySelector('.captcha_verify_container') || 
                        document.querySelector('.secsdk-captcha-wrapper');
      
      if (!container) return [null, null];
      
      // Find background and puzzle piece elements
      const backgroundImg = container.querySelector('.captcha-verify-image') || 
                          container.querySelector('.captcha_verify_img_slide') ||
                          container.querySelector('img[class*="background"]');
      
      const puzzlePieceImg = container.querySelector('.captcha_verify_img_piece') || 
                           container.querySelector('.captcha-verify-piece') ||
                           container.querySelector('img[class*="piece"]');
      
      if (!backgroundImg || !puzzlePieceImg) return [null, null];
      
      // Create canvas for background
      const bgCanvas = document.createElement('canvas');
      const bgCtx = bgCanvas.getContext('2d');
      bgCanvas.width = backgroundImg.width;
      bgCanvas.height = backgroundImg.height;
      bgCtx.drawImage(backgroundImg, 0, 0);
      const bgDataUrl = bgCanvas.toDataURL('image/png').split(',')[1];
      
      // Create canvas for puzzle piece
      const pieceCanvas = document.createElement('canvas');
      const pieceCtx = pieceCanvas.getContext('2d');
      pieceCanvas.width = puzzlePieceImg.width;
      pieceCanvas.height = puzzlePieceImg.height;
      pieceCtx.drawImage(puzzlePieceImg, 0, 0);
      const pieceDataUrl = pieceCanvas.toDataURL('image/png').split(',')[1];
      
      return [bgDataUrl, pieceDataUrl];
    });
    
    if (!backgroundImageBase64 || !puzzlePieceBase64) {
      console.log('Tidak dapat mengambil gambar puzzle CAPTCHA');
      return false;
    }
    
    // Get solution from SadCaptcha
    const solution = await solveWithExternalService(backgroundImageBase64, 'puzzle', puzzlePieceBase64);
    
    if (!solution || typeof solution.offsetX !== 'number') {
      console.log('Gagal mendapatkan solusi puzzle CAPTCHA');
      return false;
    }
    
    // Get slider information
    const sliderHandle = await page.$('.secsdk-captcha-drag-icon') || 
                         await page.$('.captcha-verify-slide-button') ||
                         await page.$('.drag-button');
    
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
    
    // Human-like slider movement with easing
    const steps = Math.floor(Math.random() * 10) + 30;
    const targetX = handleBox.x + solution.offsetX;
    
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      
      // Easing function for natural movement (ease out cubic)
      const easeEffect = 1 - Math.pow(1 - progress, 3);
      
      // Calculate current position with easing
      const currentX = handleBox.x + (solution.offsetX * easeEffect);
      
      // Add small random variations to make movement more human-like
      const randomY = handleBox.y + handleBox.height / 2 + (Math.random() * 2 - 1);
      
      // Move to the new position
      await page.mouse.move(currentX, randomY, { steps: 1 });
      
      // Add random delay between moves
      if (i < steps && i % 5 === 0) {
        await page.waitForTimeout(Math.random() * 30);
      }
    }
    
    // Make sure we end exactly at the target position
    await page.mouse.move(targetX, handleBox.y + handleBox.height / 2);
    
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

module.exports = {
  handlePuzzleCaptcha
};