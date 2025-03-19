/**
 * CAPTCHA detection module
 * 
 * Functions to detect presence and type of CAPTCHA challenges
 */

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
   * Identifies the type of CAPTCHA presented
   * @param {Object} page Puppeteer page object
   * @returns {Promise<string>} Detailed CAPTCHA type identifier
   */
  async function identifyCaptchaType(page) {
    return await page.evaluate(() => {
      // First check the text content for clear indicators
      const pageText = document.body.innerText.toLowerCase();
      
      // Detect by clear text indicators first
      if (pageText.includes('rotate') || 
          pageText.includes('putar') ||
          pageText.includes('fit the puzzle') ||
          pageText.includes('drag the slider to fit')){
        return 'rotate';
      }
      
      if (pageText.includes('puzzle piece') || 
          pageText.includes('drag the puzzle piece into place')) {
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
  
  module.exports = {
    checkForCaptcha,
    identifyCaptchaType
  };