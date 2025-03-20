/**
 * Rotate CAPTCHA handler
 */

const { checkForCaptcha } = require('../detection');
const { solveWithExternalService } = require('../services/sadcaptcha');
const path = require('path');
const fs = require('fs').promises;

/**
 * Extracts and saves CAPTCHA images from blob URLs
 * @param {Object} page Puppeteer page object
 * @returns {Promise<{background: string, piece: string}>} Base64 images
 */
async function extractBlobCaptchaImages(page) {
  try {
    console.log('Mengekstrak gambar CAPTCHA dari URL blob...');
    
    const captchaImages = await page.evaluate(async () => {
      // Helper function to get image data from a blob URL or element
      async function getImageFromElement(imgElement) {
        return new Promise((resolve) => {
          if (!imgElement) {
            resolve(null);
            return;
          }
          
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png').split(',')[1]);
          };
          
          img.onerror = () => {
            console.error('Error loading image from blob URL');
            resolve(null);
          };
          
          // Use currentSrc if available, otherwise use src
          img.src = imgElement.currentSrc || imgElement.src;
        });
      }
      
      // Find the specific container for TikTok's rotation CAPTCHA
      const captchaContainer = document.querySelector('.cap-flex.cap-flex-col.cap-justify-center.cap-items-center');
      
      if (!captchaContainer) {
        console.log('Container CAPTCHA spesifik tidak ditemukan');
        return { error: 'Container not found' };
      }
      
      // Get all images in the container
      const imgElements = captchaContainer.querySelectorAll('img');
      
      if (imgElements.length < 2) {
        console.log('Tidak cukup elemen gambar ditemukan dalam container');
        return { error: 'Not enough image elements' };
      }
      
      // The first image is usually the background, the second is the rotatable piece
      const backgroundImg = imgElements[0];
      const pieceImg = imgElements[1];
      
      // Extract base64 data from both images
      const backgroundBase64 = await getImageFromElement(backgroundImg);
      const pieceBase64 = await getImageFromElement(pieceImg);
      
      return {
        background: backgroundBase64,
        piece: pieceBase64,
        debug: {
          backgroundSrc: backgroundImg.src,
          pieceSrc: pieceImg.src,
          containerClass: captchaContainer.className
        }
      };
    });
    
    if (captchaImages.error) {
      console.error('Error during image extraction:', captchaImages.error);
      return null;
    }
    
    // Save the extracted images
    if (captchaImages.background) {
      await saveImageForInspection(
        Buffer.from(captchaImages.background, 'base64'),
        'blob_captcha_background',
        'png'
      );
    }
    
    if (captchaImages.piece) {
      await saveImageForInspection(
        Buffer.from(captchaImages.piece, 'base64'),
        'blob_captcha_piece',
        'png'
      );
    }
    
    console.log('Debug info:', captchaImages.debug);
    
    return {
      background: captchaImages.background,
      piece: captchaImages.piece
    };
    
  } catch (error) {
    console.error('Error extracting blob CAPTCHA images:', error);
    return null;
  }
}

/**
 * Saves an image for inspection with timestamp
 * @param {Buffer|String} imageData Image data (buffer or base64)
 * @param {String} name Descriptive name for the image
 * @param {String} format Format to save (png/jpg)
 * @returns {String} Path to saved file
 */
async function saveImageForInspection(imageData, name, format = 'png') {
  try {
    // Create folder structure
    const captchaDir = path.join(__dirname, '../../../temp/captcha_images');
    await fs.mkdir(captchaDir, { recursive: true });
    
    // Add timestamp to prevent overwriting
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.${format}`;
    const filePath = path.join(captchaDir, filename);
    
    // Convert from base64 if needed
    let imageBuffer = imageData;
    if (typeof imageData === 'string') {
      imageBuffer = Buffer.from(imageData, 'base64');
    }
    
    // Save the file
    await fs.writeFile(filePath, imageBuffer);
    
    // Get absolute path for easier finding
    const absolutePath = path.resolve(filePath);
    console.log(`💾 Gambar CAPTCHA disimpan: ${absolutePath}`);
    
    return absolutePath;
  } catch (error) {
    console.error(`Error saving image for inspection: ${error.message}`);
    return null;
  }
}

/**
 * Helper function for waiting that works across Puppeteer versions
 * @param {Object} page Puppeteer page object
 * @param {number} timeout Time to wait in ms
 */
async function waitFor(page, timeout) {
  try {
    if (typeof page.waitForTimeout === 'function') {
      await page.waitForTimeout(timeout);
    } else if (typeof page.waitFor === 'function') {
      await page.waitFor(timeout);
    } else {
      await page.evaluate(t => new Promise(resolve => setTimeout(resolve, t)), timeout);
    }
  } catch (error) {
    await new Promise(resolve => setTimeout(resolve, timeout));
  }
}

/**
 * Captures screenshot of a specific element
 * @param {Object} page Puppeteer page object
 * @param {string} selector CSS selector for element
 * @param {string} filename Filename to save screenshot
 * @returns {Promise<string|null>} Base64 image data or null if failed
 */
async function captureElementScreenshot(page, selector, filename) {
  try {
    // Find the element
    const element = await page.$(selector);
    if (!element) {
      console.log(`Element not found for selector: ${selector}`);
      return null;
    }
    
    // Get element dimensions
    const box = await element.boundingBox();
    if (!box) {
      console.log(`Element not visible for selector: ${selector}`);
      return null;
    }
    
    // Take screenshot of the specific area
    const screenshotBuffer = await page.screenshot({
      clip: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height
      },
      encoding: 'binary'
    });
    
    // Save screenshot for debugging
    const tempDir = path.join(__dirname, '../../../temp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(path.join(tempDir, filename), screenshotBuffer);
    } catch (err) {
      console.log(`Failed to save debug screenshot: ${err.message}`);
    }
    
    // Convert to base64
    return screenshotBuffer.toString('base64');
  } catch (error) {
    console.error(`Error capturing screenshot of element: ${error.message}`);
    return null;
  }
}

/**
 * Compresses an image by resizing it
 * @param {string} base64Image Base64 encoded image
 * @param {number} maxWidth Maximum width for the compressed image
 * @returns {Promise<string>} Compressed base64 image
 */
async function compressImage(page, base64Image, maxWidth = 500) {
  try {
    // Use browser to compress the image with canvas
    return await page.evaluate((imgData, maxW) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
          // Calculate new dimensions maintaining aspect ratio
          let newWidth = img.width;
          let newHeight = img.height;
          
          if (newWidth > maxW) {
            const ratio = maxW / newWidth;
            newWidth = maxW;
            newHeight = Math.floor(img.height * ratio);
          }
          
          // Draw to canvas with new dimensions
          const canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          
          // Convert back to base64 with reduced quality
          const compressedData = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressedData.split(',')[1]); // Remove data:image prefix
        };
        img.src = 'data:image/png;base64,' + imgData;
      });
    }, base64Image, maxWidth);
  } catch (error) {
    console.error('Error compressing image:', error);
    return base64Image; // Return original if compression fails
  }
}

/**
 * Handles TikTok rotation CAPTCHA
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether CAPTCHA was solved successfully
 */
/**
 * Handles TikTok rotation CAPTCHA
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether CAPTCHA was solved successfully
 */
async function handleRotateCaptcha(page) {
  try {
    console.log('Menyelesaikan rotate CAPTCHA menggunakan metode blob URL...');
    
    // Wait for all images to load properly
    await waitFor(page, 2000);
    
    // LANGKAH 1: Ekstrak gambar CAPTCHA menggunakan metode blob URL saja
    console.log('Mengekstrak gambar CAPTCHA dari URL blob...');
    const blobCaptchaImages = await extractBlobCaptchaImages(page);
    
    // Jika ekstraksi gagal, langsung gagalkan proses
    if (!blobCaptchaImages || !blobCaptchaImages.background || !blobCaptchaImages.piece) {
      console.log('❌ Gagal mengekstrak gambar CAPTCHA dari URL blob');
      return false;
    }
    
    console.log('✅ Berhasil mengekstrak gambar CAPTCHA dari URL blob');
    
    // Ambil data gambar base64
    let outerImageBase64 = blobCaptchaImages.background;
    let innerImageBase64 = blobCaptchaImages.piece;
    
    // LANGKAH 2: Simpan gambar untuk pemeriksaan manual
    console.log('Menyimpan gambar CAPTCHA untuk pemeriksaan manual...');
    
    // Convert base64 to buffer for saving as image files
    const outerImageBuffer = Buffer.from(outerImageBase64, 'base64');
    const innerImageBuffer = Buffer.from(innerImageBase64, 'base64');
    
    // Save with descriptive names and timestamps
    const outerImagePath = await saveImageForInspection(outerImageBuffer, 'captcha_background', 'png');
    const innerImagePath = await saveImageForInspection(innerImageBuffer, 'captcha_rotate_piece', 'png');
    
    console.log('\nUntuk melihat gambar CAPTCHA:');
    console.log(`1. Buka file explorer ke: ${path.join(__dirname, '../../../temp/captcha_images')}`);
    console.log('2. Atau jalankan perintah berikut di Command Prompt:');
    console.log(`   start "" "${outerImagePath}"`);
    console.log(`   start "" "${innerImagePath}"\n`);
    
    // LANGKAH 3: Kompres gambar sebelum dikirim ke API
    console.log('Compressing images before sending to API...');
    outerImageBase64 = await compressImage(page, outerImageBase64, 400);
    innerImageBase64 = await compressImage(page, innerImageBase64, 200);
    
    // LANGKAH 4: Kirim ke SadCaptcha untuk mendapatkan solusi
    console.log('Sending images to SadCaptcha...');
    console.log(`Outer image size: ~${Math.round(outerImageBase64.length * 0.75 / 1024)} KB`);
    console.log(`Inner image size: ~${Math.round(innerImageBase64.length * 0.75 / 1024)} KB`);
    
    const solution = await solveWithExternalService(outerImageBase64, 'rotate', innerImageBase64);
    
    if (!solution || typeof solution.angle !== 'number') {
      console.log('Gagal mendapatkan solusi rotate CAPTCHA');
      return false;
    }
    
    console.log(`SadCaptcha returned solution with angle: ${solution.angle}°`);
    
    // LANGKAH 5: Cari dan interaksi dengan slider
    const sliderHandleSelectors = [
      '.secsdk-captcha-drag-icon',
      '.captcha-verify-slide-button',
      '.drag-button',
      '#captcha_slide_button',
      'button[id*="slide"]',
      '.TUXButton--disabled',
      '.secsdk-captcha-drag-icon',
      // Tambahkan selector baru untuk slider modern TikTok
      '.cap-h-40.cap-cursor-grab.cap-rounded-full'
    ];
    
    let sliderHandle = null;
    
    for (const selector of sliderHandleSelectors) {
      sliderHandle = await page.$(selector);
      if (sliderHandle) {
        console.log(`Found slider handle with selector: ${selector}`);
        break;
      }
    }
    
    if (!sliderHandle) {
      console.log('Tidak dapat menemukan slider handle');
      return false;
    }
    
    // Get slider information for calculations
    const handleBox = await sliderHandle.boundingBox();
    const sliderInfo = await page.evaluate(() => {
      const slidebar = document.querySelector('.captcha_verify_slide--slidebar') || 
                      document.querySelector('.cap-flex.cap-w-full.cap-h-40') ||
                      document.querySelector('[class*="slidebar"]');
      
      const slideIcon = document.querySelector('.secsdk-captcha-drag-icon') ||
                       document.querySelector('#captcha_slide_button') ||
                       document.querySelector('.cap-h-40.cap-cursor-grab');
      
      if (!slidebar || !slideIcon) {
        return { totalLength: 300, iconLength: 50 };
      }
      
      return {
        totalLength: slidebar.clientWidth || 300,
        iconLength: slideIcon.clientWidth || 50
      };
    });
    
    // Calculate slide distance based on rotation angle
    const slideDistance = ((sliderInfo.totalLength - sliderInfo.iconLength) * solution.angle) / 360;
    
    console.log(`Moving slider by ${slideDistance.toFixed(2)}px for ${solution.angle}° rotation`);

    // Posisi awal slider
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    const endX = startX + slideDistance;

    // 1. Pindahkan kursor ke posisi awal dengan sedikit gerakan alami
    await page.mouse.move(startX, startY, { steps: 5 }); // Gerakan kecil menuju slider
    await waitFor(page, Math.random() * 100 + 50); // Jeda kecil seperti manusia (50-150ms)

    // 2. Tekan tombol mouse (klik dan tahan)
    await page.mouse.down();

    // 3. Geser slider dengan durasi tetap dan sedikit variasi
    const duration = 1000;
    const steps = 20;
    const stepTime = duration / steps;

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const currentX = startX + (slideDistance * progress);
      // Tambahkan sedikit variasi Y untuk mensimulasikan ketidaksempurnaan manusia
      const randomY = startY + (Math.random() * 4 - 2); // Variasi kecil ±2px
      
      await page.mouse.move(currentX, randomY, { steps: 1 });
      await waitFor(page, stepTime); // Jeda per langkah sesuai durasi total
    }

    // 4. Pastikan posisi akhir tepat
    await page.mouse.move(endX, startY); // Akhiri di posisi pasti

    // 5. Lepaskan tombol mouse
    await page.mouse.up();

    // 6. Tunggu untuk verifikasi CAPTCHA
    await waitFor(page, 3000);

    // LANGKAH 7: Periksa apakah CAPTCHA berhasil diselesaikan
    const captchaStillExists = await checkForCaptcha(page);
    return !captchaStillExists;

    } catch (error) {
      console.error('Error saat menyelesaikan rotate CAPTCHA:', error);
      return false;
    }
}

module.exports = {
  handleRotateCaptcha
};