const { checkForCaptcha, handleCaptcha } = require('./captcha/index');

/**
 * Gets the current like count from a TikTok video
 * @param {Object} page Puppeteer page object
 * @returns {Promise<number>} Current like count or -1 if not found
 */
async function getLikeCount(page) {
  try {
    const likeCount = await page.evaluate(() => {
      // Try various possible selectors for like count element
      const selectors = [
        '[data-e2e="like-count"]',
        'span[data-e2e="like-count"]',
        'strong[data-e2e="like-count"]',
        'span[data-e2e="browse-like-count"]',
        // Additional selectors for newer TikTok UI versions
        '.tiktok-1kw3fsb-StrongText',
        '.tiktok-1e4uhe3-StrongText'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
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
      }
      
      // Alternative approach: try to find any element containing the like count
      const possibleLikeElements = document.querySelectorAll('strong, span');
      for (const element of possibleLikeElements) {
        // Check if element is near like button
        const likeButton = document.querySelector('[data-e2e="like-icon"]');
        if (likeButton && element.getBoundingClientRect().left < likeButton.getBoundingClientRect().left + 100) {
          const text = element.innerText.trim();
          if (/^\d+(\.\d+)?[KMB]?$/.test(text)) {
            if (text.endsWith('K')) {
              return parseFloat(text.replace('K', '')) * 1000;
            } else if (text.endsWith('M')) {
              return parseFloat(text.replace('M', '')) * 1000000;
            } else if (text.endsWith('B')) {
              return parseFloat(text.replace('B', '')) * 1000000000;
            } else {
              return parseInt(text) || 0;
            }
          }
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
 * Checks if a video is already liked
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether the video is liked
 */
async function checkLikeStatus(page) {
  try {
    return await page.evaluate(() => {
      // Check various selectors for active like button
      const selectors = [
        '[data-e2e="like-icon"].active',
        '[data-e2e="like-icon"][class*="active"]',
        '[data-e2e="like-icon"] svg[fill="#FE2C55"]',
        '.like-button-active',
        'button[aria-label="Liked"]',
        'button[aria-label="Dislike"]', // English version
        'button[aria-label="Batal Suka"]', // Indonesian version
        // Additional selectors for newer UI
        'svg[fill="rgb(254, 44, 85)"]',
        'button[data-e2e="like-icon"][aria-pressed="true"]'
      ];
      
      for (const selector of selectors) {
        if (document.querySelector(selector)) {
          return true;
        }
      }
      
      // Alternative: Check SVG fill color if present
      const likeIcon = document.querySelector('[data-e2e="like-icon"] svg') || 
                       document.querySelector('button[aria-label="Like"] svg') ||
                       document.querySelector('button[aria-label="Suka"] svg');
      
      if (likeIcon) {
        // Check if fill attribute is TikTok red color
        const fill = likeIcon.getAttribute('fill');
        if (fill && (fill === '#FE2C55' || fill === 'rgb(254, 44, 85)')) {
          return true;
        }
        
        // Check styles if attribute is not set
        const computedStyle = window.getComputedStyle(likeIcon);
        const fillColor = computedStyle.fill || computedStyle.color;
        
        if (fillColor && (fillColor === '#FE2C55' || fillColor === 'rgb(254, 44, 85)')) {
          return true;
        }
      }
      
      return false;
    });
  } catch (error) {
    console.error('Error when checking like status:', error);
    return false;
  }
}

/**
 * Attempts to find and click the like button using multiple strategies
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether the like button was found and clicked
 */
async function findAndClickLikeButton(page) {
  // Strategy 1: Using direct selectors
  const likeButtonSelectors = [
    '[data-e2e="like-icon"]',
    'button[aria-label="Like"]',
    'button[aria-label="Suka"]',
    '.like-button',
    // Try more general selectors with SVG search
    'button:has(svg[fill="currentColor"])'
  ];
  
  let likeButton = null;
  
  // Try all possible selectors for like button
  for (const selector of likeButtonSelectors) {
    try {
      likeButton = await page.$(selector);
      if (likeButton) {
        console.log(`Found like button with selector: ${selector}`);
        
        // Ensure button is in view and wait a moment
        await page.evaluate(el => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return new Promise(resolve => setTimeout(resolve, 1000));
        }, likeButton);
        
        // Click the button
        await likeButton.click();
        console.log('Clicked like button');
        return true;
      }
    } catch (error) {
      // Continue to next selector
    }
  }
  
  // Strategy 2: Using page.evaluate for better detection
  if (!likeButton) {
    console.log('Trying alternative method to find like button...');
    
    try {
      const clicked = await page.evaluate(() => {
        // Find all buttons and check various attributes
        const buttons = Array.from(document.querySelectorAll('button'));
        
        // Function to find like button with various criteria
        const findLikeButton = () => {
          for (const button of buttons) {
            // Check for like text
            const hasLikeText = (button.innerText || '').toLowerCase().includes('like');
            
            // Check for heart icon
            const hasHeartIcon = button.innerHTML.includes('svg') && 
                              (button.innerHTML.includes('heart') || 
                               button.innerHTML.includes('like'));
            
            // Check aria-label
            const ariaLabel = button.getAttribute('aria-label') || '';
            const hasLikeLabel = ariaLabel.toLowerCase().includes('like') || 
                               ariaLabel.toLowerCase().includes('suka');
            
            // Check position (usually at bottom or side of video)
            const rect = button.getBoundingClientRect();
            const isInLikePosition = rect.bottom > window.innerHeight * 0.6;
            
            // Check for data-e2e attribute
            const hasDataE2E = button.getAttribute('data-e2e') === 'like-icon';
            
            if (hasLikeText || hasHeartIcon || hasLikeLabel || 
                (isInLikePosition && button.querySelector('svg')) || hasDataE2E) {
              return button;
            }
          }
          
          return null;
        };
        
        const likeBtn = findLikeButton();
        if (!likeBtn) return false;
        
        // Ensure button is visible
        likeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Wait a moment and click
        return new Promise(resolve => {
          setTimeout(() => {
            likeBtn.click();
            resolve(true);
          }, 1000);
        });
      });
      
      if (clicked) {
        console.log('Successfully clicked like button using alternative method');
        return true;
      }
    } catch (error) {
      console.error('Error with alternative like button method:', error);
    }
  }
  
  // Strategy 3: Using JavaScript events for more reliable clicking
  console.log('Trying event-based method to trigger like...');
  
  try {
    const eventSuccess = await page.evaluate(() => {
      const findLikeButton = () => {
        const selectors = [
          '[data-e2e="like-icon"]',
          'button[aria-label="Like"]',
          'button[aria-label="Suka"]'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) return element;
        }
        
        return null;
      };
      
      const likeButton = findLikeButton();
      if (!likeButton) return false;
      
      // First focus the element
      likeButton.focus();
      
      // Then dispatch a sequence of events for more robust clicking
      return new Promise(resolve => {
        setTimeout(() => {
          // Mouse down event
          likeButton.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0
          }));
          
          setTimeout(() => {
            // Mouse up event
            likeButton.dispatchEvent(new MouseEvent('mouseup', {
              bubbles: true,
              cancelable: true,
              view: window,
              button: 0
            }));
            
            // Click event
            likeButton.dispatchEvent(new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              button: 0
            }));
            
            resolve(true);
          }, 100);
        }, 100);
      });
    });
    
    if (eventSuccess) {
      console.log('Successfully liked using event-based method');
      return true;
    }
  } catch (error) {
    console.error('Error with event-based like method:', error);
  }
  
  console.log('Failed to find like button after trying all methods');
  return false;
}

/**
 * Main function to like a TikTok video
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether the like was successfully applied
 */
async function likeVideo(page) {
  console.log('Attempting to like video...');
  
  try {
    // Wait for loading to complete
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, 3000));
    });
    
    // Check for CAPTCHA before liking
    const hasCaptchaBeforeLike = await checkForCaptcha(page);
    if (hasCaptchaBeforeLike) {
      console.log('\x1b[33m%s\x1b[0m', '⚠️ CAPTCHA detected before liking!');
      const captchaSolved = await handleCaptcha(page);
      
      if (captchaSolved) {
        console.log('\x1b[32m%s\x1b[0m', '✅ CAPTCHA successfully solved.');
      } else {
        console.log('\x1b[31m%s\x1b[0m', '❌ Failed to solve CAPTCHA. Skipping like.');
        return false;
      }
    }
    
    // Get initial like count
    const initialLikeCount = await getLikeCount(page);
    console.log(`Initial like count: ${initialLikeCount}`);
    
    // Check if already liked
    const initialLikeStatus = await checkLikeStatus(page);
    
    if (initialLikeStatus) {
      console.log('Video already liked previously');
      return true;
    }
    
    // Find and click like button
    const likeClicked = await findAndClickLikeButton(page);
    
    if (!likeClicked) {
      console.log('Could not find or click like button');
      return false;
    }
    
    // Wait for like action to register
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, 2000));
    });
    
    // Check for CAPTCHA after attempting like
    const hasCaptchaAfterLike = await checkForCaptcha(page);
    if (hasCaptchaAfterLike) {
      console.log('\x1b[33m%s\x1b[0m', '⚠️ CAPTCHA detected after like attempt!');
      const captchaSolved = await handleCaptcha(page);
      
      if (captchaSolved) {
        console.log('\x1b[32m%s\x1b[0m', '✅ CAPTCHA successfully solved.');
        
        // Try liking again after solving CAPTCHA
        await findAndClickLikeButton(page);
        
        await page.evaluate(() => {
          return new Promise(resolve => setTimeout(resolve, 2000));
        });
      } else {
        console.log('\x1b[31m%s\x1b[0m', '❌ Failed to solve CAPTCHA.');
        return false;
      }
    }
    
    // Verify like was successful
    const newLikeStatus = await checkLikeStatus(page);
    
    // Wait a moment for like count to update
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, 3000));
    });
    
    // Check new like count (may not always change in UI)
    const newLikeCount = await getLikeCount(page);
    
    console.log(`Like status after clicking: ${newLikeStatus ? 'Liked' : 'Not liked'}`);
    console.log(`New like count: ${newLikeCount}`);
    
    // Success if like status changed or count increased
    const success = newLikeStatus || (newLikeCount > initialLikeCount && initialLikeCount >= 0);
    
    if (success) {
      console.log('Video successfully liked!');
    } else {
      console.log('Seems like the like action failed');
    }
    
    return success;
  } catch (error) {
    console.error('Error when liking video:', error);
    
    // Take screenshot for debugging
    try {
      const screenshotPath = `./data/debug-screenshots/like_error_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
      console.log(`Error screenshot saved to ${screenshotPath}`);
    } catch (screenshotError) {
      console.error('Could not save error screenshot:', screenshotError);
    }
    
    return false;
  }
}

module.exports = {
  likeVideo,
  getLikeCount,
  checkLikeStatus,
  findAndClickLikeButton
};