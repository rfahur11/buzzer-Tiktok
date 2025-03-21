const { checkForCaptcha, handleCaptcha } = require('./captcha/index');

/**
 * Helper function to wait for a specific amount of time
 * @param {number} timeout Time to wait in milliseconds
 * @returns {Promise<void>}
 */
async function waitFor(timeout) {
  return new Promise(resolve => setTimeout(resolve, timeout));
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
    // Check for CAPTCHA before attempting to like
    const hasCaptchaBeforeLike = await checkForCaptcha(page);
    if (hasCaptchaBeforeLike) {
      console.log('CAPTCHA detected before liking');
      const captchaSolved = await handleCaptcha(page);
      if (!captchaSolved) {
        console.error('Failed to solve CAPTCHA');
        return false;
      }
    }
    
    // Get initial like count 
    const initialLikeCount = await getLikeCount(page);
    console.log(`Initial like count: ${initialLikeCount}`);
    
    // Find and click the like button
    const likeClicked = await findAndClickLikeButton(page);
    if (!likeClicked) {
      console.log('Could not click like button');
      return false;
    }
    
    // Wait for like count to update
    await waitFor(3000);
    
    // Get new like count
    const newLikeCount = await getLikeCount(page);
    console.log(`New like count: ${newLikeCount}`);
    
    // If like count increased, like was successful
    if (initialLikeCount >= 0 && newLikeCount > initialLikeCount) {
      console.log('Like count increased, video successfully liked!');
      return true;
    }
    
    // If like count decreased, we might have clicked an already liked video
    if (initialLikeCount >= 0 && newLikeCount < initialLikeCount) {
      console.log('Like count decreased - video was already liked and we unliked it. Clicking again to revert...');
      
      // Wait a moment before clicking again
      await waitFor(1000);
      
      // Try clicking again to revert the unlike action
      const retryClicked = await findAndClickLikeButton(page);
      if (!retryClicked) {
        console.log('Could not click like button on retry');
        return false;
      }
      
      // Wait for UI to update
      await waitFor(3000);
      
      // Check final like count
      const finalLikeCount = await getLikeCount(page);
      console.log(`Final like count after retry: ${finalLikeCount}`);
      
      // Success if like count increased from the "unliked" state
      if (finalLikeCount > newLikeCount) {
        console.log('Successfully reverted to liked state');
        return true;
      }
    }
    
    // If like count didn't change significantly, try one more time
    if (Math.abs(newLikeCount - initialLikeCount) <= 1) {
      console.log('Like count relatively unchanged, trying one more time...');
      
      // Try clicking once more
      await findAndClickLikeButton(page);
      await waitFor(3000);
      
      // Check final count
      const finalRetryCount = await getLikeCount(page);
      console.log(`Final like count after retry: ${finalRetryCount}`);
      
      if (finalRetryCount > initialLikeCount) {
        console.log('Successfully liked the video on retry!');
        return true;
      }
    }
    
    console.log('Failed to like the video after attempts');
    return false;
    
  } catch (error) {
    console.error('Error in likeVideo function:', error);
    return false;
  }
}

module.exports = {
  getLikeCount,
  findAndClickLikeButton,
  likeVideo
};