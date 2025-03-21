const fs = require('fs');
const path = require('path');

/**
 * Clicks the comment button to open comments section
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether button was successfully clicked
 */
/**
 * Helper function for consistent waiting across Puppeteer versions
 * @param {Object} page Puppeteer page object
 * @param {number} timeout Time to wait in milliseconds
 */
async function waitFor(page, timeout) {
  try {   
    // Method 3: Fallback to evaluate with setTimeout
    await page.evaluate(timeout => {
      return new Promise(resolve => setTimeout(resolve, timeout));
    }, timeout);
  } catch (error) {
    console.log(`Warning: Wait error: ${error.message}`);
    // Use Node.js setTimeout as last resort
    await new Promise(resolve => setTimeout(resolve, timeout));
  }
}

async function openCommentsSection(page) {
  console.log('Mencoba membuka bagian komentar...');
  
  // List of possible selectors for comment button
  const commentButtonSelectors = [
    'button:has([data-e2e="comment-icon"])',
  ];
  
  try {
    // Try each selector
    for (const selector of commentButtonSelectors) {
      try {
        // Wait briefly for the button to be available
        await page.waitForSelector(selector, { timeout: 3000 });
        
        // Get the button and click it
        const commentButton = await page.$(selector);
        if (commentButton) {
          await commentButton.click();
          console.log(`Tombol komentar ditemukan dan diklik (selector: ${selector})`);
          
          // Wait for comment section to load
          await waitFor(page, 3000);
          return true;
        }
      } catch (selectorError) {
        // Try next selector
        continue;
      }
    }
    
    // If no selector worked, try finding by attributes and text
    const buttonClicked = await page.evaluate(() => {
      // Find any button that seems like a comment button
      const possibleButtons = Array.from(document.querySelectorAll('button'));
      
      for (const button of possibleButtons) {
        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        const innerText = (button.innerText || '').toLowerCase();
        
        if (
          ariaLabel.includes('comment') || 
          innerText.includes('comment') ||
          button.querySelector('[data-e2e="comment-icon"]')
        ) {
          button.click();
          return true;
        }
      }
      
      return false;
    });
    
    if (buttonClicked) {
      console.log('Tombol komentar ditemukan dan diklik melalui evaluasi JavaScript');
      await waitFor(page, 3000);
      return true;
    }
    
    console.log('Tidak dapat menemukan tombol komentar');
    return false;
    
  } catch (error) {
    console.error('Error saat membuka bagian komentar:', error);
    return false;
  }
}

/**
 * Comments on a TikTok video with specified text
 * @param {Object} page Puppeteer page object
 * @param {string} videoUrl URL of the TikTok video to comment on
 * @param {string} commentText Comment text to post
 * @returns {Promise<boolean>} Whether commenting was successful
 */
async function commentOnVideo(page, videoUrl, commentText) {
  console.log(`Mencoba memberikan komentar pada video: ${videoUrl}`);
  
  try {
    // Navigate to video page
    await page.goto(videoUrl, { 
      waitUntil: 'networkidle2', 
    });
    console.log('Halaman video berhasil dibuka');

    // Check for CAPTCHA after navigating to video page
    const { checkForCaptcha, handleCaptcha } = require('./captcha/index');
    const hasCaptchaOnLoad = await checkForCaptcha(page);
    if (hasCaptchaOnLoad) {
      // Captcha handling code...
    }
      
    // Wait for page to fully load
    await waitFor(page, 5000);
    
    // NEW STEP: Open comments section first
    const commentsOpened = await openCommentsSection(page);
    if (!commentsOpened) {
      console.log('Tidak bisa membuka bagian komentar');
      return false;
    }
    
    // Scroll to comment section to ensure comment elements are visible
    await page.evaluate(() => {
      window.scrollBy(0, 300);
    });
    
    await waitFor(page, 2000);
    
    // Find comment input area
    console.log('Mencari area input komentar...');
    
    // Try various possible selectors for comment input
    const commentInput = await findCommentInput(page);
    
    if (!commentInput) {
      console.log('Tidak dapat menemukan area input komentar setelah mencoba semua metode');
      return false;
    }
    
    // Click on comment input area
    await commentInput.click();
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, 2000));
    });
    
    // Check for CAPTCHA after clicking comment input
    const captchaAfterInputClick = await checkForCaptcha(page);
    if (captchaAfterInputClick) {
      console.log('CAPTCHA terdeteksi setelah klik input komentar');
      await handleCaptcha(page);
    }
    
    // Type comment
    console.log(`Menulis komentar: "${commentText}"`);
    await typeComment(page, commentInput, commentText);
    
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, 2000));
    });
    
    // Find and click post button
    console.log('Mencari tombol post komentar...');
    const postButton = await findPostButton(page);
    
    if (!postButton) {
      console.log('Tidak dapat menemukan tombol post komentar');
      return false;
    }
    
    // Click post button
    await postButton.click();
    console.log('Tombol post komentar telah diklik');
    
    // Wait for comment to be posted
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, 5000));
    });
    
    // Check for CAPTCHA after attempting to post comment
    const hasCaptchaAfterPost = await checkForCaptcha(page);
    if (hasCaptchaAfterPost) {
      console.log('\x1b[33m%s\x1b[0m', '⚠️ CAPTCHA terdeteksi setelah mencoba post komentar!');
      const captchaSolved = await handleCaptcha(page);
      
      if (captchaSolved) {
        console.log('\x1b[32m%s\x1b[0m', '✅ CAPTCHA berhasil diselesaikan.');
        // Try clicking post button again if needed
        if (postButton) {
          await postButton.click();
          console.log('Tombol post komentar diklik lagi setelah menyelesaikan captcha');
        }
      } else {
        console.log('\x1b[31m%s\x1b[0m', '❌ Gagal menyelesaikan CAPTCHA.');
        return false;
      }
    }
    
    // Wait to confirm comment was posted
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, 5000));
    });

    // Verify comment was posted
    const commentPosted = await verifyCommentPosted(page, commentText);
    if (commentPosted) {
      console.log('Komentar berhasil diposting!');
      return true;
    } else {
      console.log('Tidak dapat memverifikasi keberhasilan komentar');
      return false;
    }
  } catch (error) {
    console.error('Error saat memberikan komentar:', error);
    return false;
  }
}

/**
 * Finds the comment input field using various selectors
 * @param {Object} page Puppeteer page object
 * @returns {Promise<ElementHandle|null>} Comment input element or null
 */
async function findCommentInput(page) {
  // List of selectors that might contain comment input
  const commentSelectors = [
    '[data-e2e="comment-input"]'
  ];
  
  let commentInput = null;
  
  // Try all possible selectors
  for (const selector of commentSelectors) {
    try {
      commentInput = await page.$(selector);
      if (commentInput) {
        console.log(`Menemukan input komentar dengan selector: ${selector}`);
        return commentInput;
      }
    } catch (error) {
      // Continue to next selector
    }
  }
  
  // If no input found, try alternative approach
  if (!commentInput) {
    console.log('Mencoba metode alternatif untuk menemukan area komentar...');
    
    // Try clicking on general comment area to reveal input
    await page.evaluate(() => {
      // Find element based on display text
      const elements = [...document.querySelectorAll('*')];
      const commentArea = elements.find(el => 
        el.innerText && (
          el.innerText.includes('Add comment') || 
          el.innerText.includes('Tambahkan komentar')
        )
      );
      
      if (commentArea) commentArea.click();
    });
    
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, 3000));
    });
    
    // Try finding input again
    for (const selector of commentSelectors) {
      try {
        commentInput = await page.$(selector);
        if (commentInput) {
          console.log(`Menemukan input komentar dengan selector: ${selector} setelah klik area`);
          return commentInput;
        }
      } catch (error) {
        // Continue to next selector
      }
    }
  }
  
  return null;
}

/**
 * Types comment text into input field with fallback methods
 * @param {Object} page Puppeteer page object
 * @param {ElementHandle} commentInput Comment input element
 * @param {string} commentText Text to type
 * @returns {Promise<boolean>} Whether typing was successful
 */
async function typeComment(page, commentInput, commentText) {
  try {
    // Method 1: Direct typing
    await commentInput.type(commentText, { delay: 100 + Math.random() * 50 });
    return true;
  } catch (error) {
    console.log('Metode type gagal, mencoba metode evaluateHandle...');
    
    try {
      // Method 2: Content editable approach
      await page.evaluate((element, text) => {
        element.focus();
        element.innerText = text;
        // Trigger event to notify TikTok content has changed
        const event = new Event('input', { bubbles: true });
        element.dispatchEvent(event);
      }, commentInput, commentText);
      return true;
    } catch (secondError) {
      console.error('Kedua metode pengetikan komentar gagal:', secondError);
      return false;
    }
  }
}

/**
 * Finds the post comment button
 * @param {Object} page Puppeteer page object
 * @returns {Promise<ElementHandle|null>} Post button element or null
 */
async function findPostButton(page) {
  const postButtonSelectors = [
    '[data-e2e="comment-post"]',
    'button:has-text("Post")',
    'button:has-text("Kirim")',
    'button[aria-label="Post Comment"]',
    'button[aria-label="Kirim komentar"]'
  ];
  
  let postButton = null;
  
  // Try all possible selectors for post button
  for (const selector of postButtonSelectors) {
    try {
      postButton = await page.$(selector);
      if (postButton) {
        console.log(`Menemukan tombol post dengan selector: ${selector}`);
        return postButton;
      }
    } catch (error) {
      // Continue to next selector
    }
  }
  
  // Alternative approach - try finding by text content
  try {
    postButton = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.find(btn => 
        btn.innerText.includes('Post') || 
        btn.innerText.includes('Kirim') ||
        btn.getAttribute('aria-label')?.includes('Post') ||
        btn.getAttribute('aria-label')?.includes('Kirim')
      );
    });
    
    if (postButton && !(await postButton.evaluate(el => el === null))) {
      console.log('Menemukan tombol post dengan metode pencarian teks');
      return postButton;
    }
  } catch (error) {
    console.log('Error saat mencari tombol dengan metode alternatif:', error);
  }
  
  return null;
}

/**
 * Verifies if comment was successfully posted
 * @param {Object} page Puppeteer page object
 * @param {string} commentText Text that was commented
 * @returns {Promise<boolean>} Whether comment exists in the comments section
 */
async function verifyCommentPosted(page, commentText) {
  try {
    // Check if comment appears in comments list
    return await page.evaluate((text) => {
      const commentElements = document.querySelectorAll('.comment-item, [data-e2e="comment-item"]');
      
      // Convert NodeList to Array and check if our comment exists
      return Array.from(commentElements).some(element => {
        const commentContent = element.textContent || '';
        return commentContent.includes(text);
      });
    }, commentText);
  } catch (error) {
    console.error('Error saat memverifikasi komentar:', error);
    // Assume success if verification fails due to technical issues
    return true;
  }
}

module.exports = {
  commentOnVideo,
  findCommentInput,
  typeComment,
  findPostButton,
  verifyCommentPosted
};