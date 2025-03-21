const { checkForCaptcha, handleCaptcha } = require('./captcha/index');
const fs = require('fs');
const path = require('path');

// Pastikan direktori debug-screenshots ada
const debugDir = path.join(__dirname, 'data', 'debug-screenshots');
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}

/**
 * Helper function to wait for a specific amount of time
 * @param {number} timeout Time to wait in milliseconds
 * @returns {Promise<void>}
 */
async function waitFor(timeout) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * Detects and dismisses floating popups, especially those with class css-mp9aqo-DivIconCloseContainer
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether any popup was detected and handled
 */
async function dismissTikTokPopups(page) {
  console.log('Checking for TikTok floating popups...');
  
  try {
    // List of selectors for common TikTok popup close buttons
    const closeButtonSelectors = [
      // Selector spesifik yang Anda temukan
      '.css-mp9aqo-DivIconCloseContainer',
    ];
    
    let popupDismissed = false;
    
    // Try direct selector approach first
    for (const selector of closeButtonSelectors) {
      try {
        // Check if element is visible
        const isVisible = await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          if (!element) return false;
          
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          
          return style.display !== 'none' && 
                style.visibility !== 'hidden' && 
                style.opacity !== '0' &&
                rect.width > 0 &&
                rect.height > 0;
        }, selector);
        
        if (isVisible) {
          console.log(`Found popup with selector: ${selector}`);
          
          // Click the close button
          await page.evaluate((sel) => {
            const closeButton = document.querySelector(sel);
            if (closeButton) {
              closeButton.click();
              console.log(`Clicked close button with selector: ${sel}`);
            }
          }, selector);
          
          // Wait for animation to complete
          await waitFor(1000);
          
          popupDismissed = true;
          console.log('Popup successfully dismissed!');
          
          // Take a debug screenshot if popup was found and clicked
          await page.screenshot({
            path: path.join(debugDir, `popup_dismissed_${Date.now()}.png`),
            fullPage: false
          });
          break;
        }
      } catch (error) {
        console.log(`Failed to handle selector ${selector}: ${error.message}`);
        // Continue to next selector
      }
    }
    
    // If no popup found with direct selectors, try the general detection approach
    if (!popupDismissed) {
      console.log('Trying general popup detection approach...');
      
      // Take before screenshot for debugging
      await page.screenshot({
        path: path.join(debugDir, `before_general_detection_${Date.now()}.png`),
        fullPage: false
      });
      
      const foundOverlay = await page.evaluate(() => {
        // Find elements that might be popups/overlays
        // 1. Look for overlay containers based on position and z-index
        const overlays = Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          
          // Element needs to be visible
          if (style.display === 'none' || style.visibility === 'hidden' || 
              style.opacity === '0' || rect.width < 10 || rect.height < 10) {
            return false;
          }
          
          // Element should have high z-index and be positioned absolutely/fixed
          const zIndex = parseInt(style.zIndex);
          const isPositioned = style.position === 'fixed' || style.position === 'absolute';
          const isProminent = !isNaN(zIndex) && zIndex > 100;
          
          // Element should overlap with typical like button locations
          // (typically bottom of screen or right side)
          const overlapsLikeArea = 
              (rect.bottom > window.innerHeight * 0.5 && rect.left < window.innerWidth * 0.3) || 
              (rect.right > window.innerWidth * 0.7);
          
          return isPositioned && (isProminent || overlapsLikeArea);
        });
        
        // Check if we found any potential overlays
        if (overlays.length === 0) return false;
        
        // Try to find close buttons in the overlays
        for (const overlay of overlays) {
          // Look for close buttons or icons
          const closeElements = [
            // Direct children that might be close buttons
            ...overlay.querySelectorAll('[class*="close"]'),
            ...overlay.querySelectorAll('svg'),
            ...overlay.querySelectorAll('button'),
            // Elements with X or close icon
            ...overlay.querySelectorAll('[aria-label="Close"]'),
            ...overlay.querySelectorAll('[aria-label="Tutup"]')
          ];
          
          // Filter to likely close buttons
          const closeButtons = closeElements.filter(el => {
            const rect = el.getBoundingClientRect();
            // Close buttons are typically small
            return rect.width > 0 && rect.width < 50 && rect.height > 0 && rect.height < 50;
          });
          
          if (closeButtons.length > 0) {
            // Sort by position (prefer top-right positioned elements as they're typically close buttons)
            closeButtons.sort((a, b) => {
              const aRect = a.getBoundingClientRect();
              const bRect = b.getBoundingClientRect();
              // Score based on proximity to top-right corner
              const aScore = aRect.top + (window.innerWidth - aRect.right);
              const bScore = bRect.top + (window.innerWidth - bRect.right);
              return aScore - bScore;
            });
            
            // Click the best candidate
            closeButtons[0].click();
            console.log("Clicked a likely close button");
            return true;
          }
        }
        
        return false;
      });
      
      if (foundOverlay) {
        console.log('Found and dismissed overlay using general detection');
        popupDismissed = true;
        
        // Wait for animation to complete
        await waitFor(1500);
        
        // Take after screenshot
        await page.screenshot({
          path: path.join(debugDir, `after_general_detection_${Date.now()}.png`),
          fullPage: false
        });
      }
    }
    
    return popupDismissed;
  } catch (error) {
    console.error('Error dismissing TikTok popups:', error);
    return false;
  }
}

/**
 * Gets the current like count from a TikTok video
 * @param {Object} page Puppeteer page object
 * @returns {Promise<number>} Current like count or -1 if not found
 */
async function getLikeCount(page) {
  try {
    const likeCount = await page.evaluate(() => {
      // Try to find the like count element
      const element = document.querySelector('[data-e2e="like-count"]');
      
      if (element) {
        // Get text and convert "K" or "M" if present
        let text = element.innerText.trim();
        
        if (text.endsWith('K')) {
          return parseFloat(text.replace('K', '')) * 1000;
        } else if (text.endsWith('M')) {
          return parseFloat(text.replace('M', '')) * 1000000;
        } else if (text.endsWith('B')) {
          return parseFloat(text.replace('B', '')) * 1000000000;
        } else {
          // Remove non-digit characters and parse
          return parseInt(text.replace(/[^\d]/g, '')) || 0;
        }
      }
      
      return -1; // Cannot find element
    });
    
    return likeCount;
  } catch (error) {
    console.error('Error when getting like count:', error);
    return -1;
  }
}

/**
 * Attempts to find and click the like button using a direct Puppeteer approach
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether the like button was found and clicked
 */
async function findAndClickLikeButton(page) {
  console.log('Attempting to find and click like button...');
  
  // List of possible selectors for like button
  const likeButtonSelectors = [
    'button:has([data-e2e="like-icon"])',
    '[data-e2e="like-icon"]'
  ];
  
  try {
    // Try each selector
    for (const selector of likeButtonSelectors) {
      try {
        // Wait briefly for the button to be available
        await page.waitForSelector(selector, { timeout: 3000 });
        
        // Get the button and click it
        const likeButton = await page.$(selector);
        if (likeButton) {
          // Scroll to make sure button is visible
          await page.evaluate(el => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, likeButton);
          
          // Wait a moment for any animations to finish
          await waitFor(1000);
          
          // Click the button
          await likeButton.click();
          console.log(`Like button found and clicked (selector: ${selector})`);
          
          // Wait for UI to update
          await waitFor(2000);
          return true;
        }
      } catch (selectorError) {
        // Try next selector
        continue;
      }
    }
    
    // If all selectors fail, try a more robust method using page.evaluate
    console.log('Trying fallback method for finding like button...');
    
    const clicked = await page.evaluate(() => {
      // Find like buttons based on visual position and properties
      const allButtons = Array.from(document.querySelectorAll('button'));
      
      // Filter buttons that look like like buttons
      const possibleLikeButtons = allButtons.filter(btn => {
        // Check if it has an SVG child
        const hasSvg = btn.querySelector('svg');
        if (!hasSvg) return false;
        
        // Check position (usually at bottom or side of video)
        const rect = btn.getBoundingClientRect();
        const isInLikePosition = rect.bottom > window.innerHeight * 0.5;
        
        // Check if it has heart or like related attributes
        const hasLikeAttr = 
          btn.getAttribute('aria-label')?.toLowerCase().includes('like') ||
          btn.innerHTML.toLowerCase().includes('like') ||
          btn.getAttribute('data-e2e')?.includes('like');
        
        return (isInLikePosition && hasSvg) || hasLikeAttr;
      });
      
      // If we found possible like buttons, click the first one
      if (possibleLikeButtons.length > 0) {
        const likeButton = possibleLikeButtons[0];
        
        // Ensure the button is in view
        likeButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Small delay for scroll
        return new Promise(resolve => {
          setTimeout(() => {
            likeButton.click();
            console.log('Clicked like button using fallback method');
            resolve(true);
          }, 500);
        });
      }
      
      return false;
    });
    
    if (clicked) {
      return true;
    }
    
    console.log('Could not find like button after trying all methods');
    return false;
    
  } catch (error) {
    console.error('Error finding/clicking like button:', error);
    return false;
  }
}

/**
 * Main function to like a video on TikTok based on like count change
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether the video was successfully liked
 */
async function likeVideo(page) {
  console.log('Starting process to like video...');
  
  try {
    // First, check and dismiss any popups
    await dismissTikTokPopups(page);
    
    // Pengecekan CAPTCHA pertama - sebelum melakukan apapun
    const hasCaptchaAtStart = await checkForCaptcha(page);
    if (hasCaptchaAtStart) {
      console.log('\x1b[33m%s\x1b[0m', '⚠️ CAPTCHA detected at start of like process');
      const captchaSolvedAtStart = await handleCaptcha(page);
      if (!captchaSolvedAtStart) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Failed to solve initial CAPTCHA, aborting like process');
        return false;
      }
      console.log('\x1b[32m%s\x1b[0m', '✅ Initial CAPTCHA solved, continuing...');
      
      // Setelah menyelesaikan CAPTCHA, tunggu sejenak untuk UI menyesuaikan
      await waitFor(2500);

    }
    
    // Get initial like count 
    const initialLikeCount = await getLikeCount(page);
    console.log(`Initial like count: ${initialLikeCount}`);
    
    // Helper function untuk menangani CAPTCHA selama proses like
    async function handlePossibleCaptcha() {
      const hasCaptcha = await checkForCaptcha(page);
      if (hasCaptcha) {
        console.log('\x1b[33m%s\x1b[0m', '⚠️ CAPTCHA detected during like process');
        const captchaSolved = await handleCaptcha(page);
        if (!captchaSolved) {
          console.error('\x1b[31m%s\x1b[0m', '❌ Failed to solve CAPTCHA during like process');
          return false;
        }
        console.log('\x1b[32m%s\x1b[0m', '✅ CAPTCHA solved, continuing like process');
        await waitFor(2000);
        return true;
      }
      return true; // No CAPTCHA found, continue normally
    }
    
    // Find and click the like button
    const likeClicked = await findAndClickLikeButton(page);
    if (!likeClicked) {
      console.log('Could not click like button on first attempt');
      
      // Periksa CAPTCHA yang mungkin muncul setelah gagal klik pertama
      if (!await handlePossibleCaptcha()) return false;
      
      // Coba sekali lagi
      const retryClick = await findAndClickLikeButton(page);
      if (!retryClick) {
        // Coba dengan pendekatan JavaScript langsung jika masih gagal
        console.log('Trying direct JavaScript approach to click like button...');
        const jsClick = await page.evaluate(() => {
          // Temukan semua elemen yang mungkin berkaitan dengan like button
          const possibleLikeButtons = [
            document.querySelector('[data-e2e="like-icon"]'),
            document.querySelector('button[aria-label="Like"]'),
            document.querySelector('button[aria-label="Suka"]'),
            ...Array.from(document.querySelectorAll('button')).filter(b => 
              b.innerHTML.includes('svg') && 
              (b.getAttribute('aria-label')?.includes('like') || 
               b.innerHTML.toLowerCase().includes('like'))
            )
          ].filter(Boolean); // Remove nulls
          
          if (possibleLikeButtons.length > 0) {
            // Scroll to button first
            possibleLikeButtons[0].scrollIntoView({behavior: 'smooth', block: 'center'});
            
            // Use a small delay before clicking
            return new Promise(resolve => {
              setTimeout(() => {
                possibleLikeButtons[0].click();
                resolve(true);
              }, 500);
            });
          }
          return false;
        });
        
        if (!jsClick) {
          // Take a debug screenshot if we still can't click
          console.log('\x1b[31m%s\x1b[0m', '❌ Failed to click like button after multiple attempts');
          await page.screenshot({
            path: path.join(debugDir, `like_button_not_found_${Date.now()}.png`),
            fullPage: true
          });
          return false;
        }
      }
    }
    
    // Wait for like count to update
    await waitFor(3000);
    
    // Periksa CAPTCHA yang mungkin muncul setelah klik
    if (!await handlePossibleCaptcha()) return false;
    
    // Get new like count
    const newLikeCount = await getLikeCount(page);
    console.log(`New like count: ${newLikeCount}`);
    
    // If like count increased, like was successful
    if (initialLikeCount >= 0 && newLikeCount > initialLikeCount) {
      console.log('\x1b[32m%s\x1b[0m', '✅ Like count increased, video successfully liked!');
      return true;
    }
    
    // If like count decreased, we might have clicked an already liked video
    if (initialLikeCount >= 0 && newLikeCount < initialLikeCount) {
      console.log('Like count decreased - video was already liked and we unliked it. Clicking again to revert...');
      
      // Periksa CAPTCHA sebelum mencoba revert
      if (!await handlePossibleCaptcha()) return false;
           
      // Try clicking again to revert the unlike action
      const retryClicked = await findAndClickLikeButton(page);
      if (!retryClicked) {
        console.log('\x1b[31m%s\x1b[0m', '❌ Could not click like button on revert attempt');
        return false;
      }
      
      // Wait for UI to update
      await waitFor(3000);
      
      // Periksa CAPTCHA setelah klik revert
      if (!await handlePossibleCaptcha()) return false;
      
      // Check final like count
      const finalLikeCount = await getLikeCount(page);
      console.log(`Final like count after revert: ${finalLikeCount}`);
      
      // Success if like count increased from the "unliked" state
      if (finalLikeCount > newLikeCount) {
        console.log('\x1b[32m%s\x1b[0m', '✅ Successfully reverted to liked state');
        return true;
      }
    }
    
    // If like count didn't change significantly, try one more time with extra checks
    if (Math.abs(newLikeCount - initialLikeCount) <= 1) {
      console.log('Like count relatively unchanged, trying one more time...');
      
      // Periksa CAPTCHA terlebih dahulu
      if (!await handlePossibleCaptcha()) return false;
           
      // Try clicking once more
      await findAndClickLikeButton(page);
      await waitFor(3000);
      
      // Periksa CAPTCHA final
      if (!await handlePossibleCaptcha()) return false;
      
      // Check final count
      const finalRetryCount = await getLikeCount(page);
      console.log(`Final like count after retry: ${finalRetryCount}`);
      
      if (finalRetryCount > initialLikeCount) {
        console.log('\x1b[32m%s\x1b[0m', '✅ Successfully liked the video on retry!');
        return true;
      }
    }
    
    // Tak ada perubahan signifikan setelah semua upaya
    console.log('\x1b[33m%s\x1b[0m', '⚠️ No significant change in like count after attempts');
    
    // Lakukan screenshot final untuk debugging
    await page.screenshot({
      path: path.join(debugDir, `like_final_state_${Date.now()}.png`),
      fullPage: false
    });
    
    // Kita anggap berhasil jika proses berjalan tanpa error, meskipun like count tidak berubah
    // (karena terkadang TikTok tidak memperbarui count dengan segera)
    console.log('Process completed without errors, assuming success');
    return true;
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `❌ Error in likeVideo function: ${error.message}`);
    
    // Take a screenshot on error for debugging
    try {
      await page.screenshot({
        path: path.join(debugDir, `like_error_${Date.now()}.png`),
        fullPage: true
      });
    } catch (screenshotError) {
      console.log('Failed to take error screenshot:', screenshotError.message);
    }
    
    return false;
  }
}

module.exports = {
  getLikeCount,
  findAndClickLikeButton,
  dismissTikTokPopups,
  likeVideo
};