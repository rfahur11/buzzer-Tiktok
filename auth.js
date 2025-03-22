const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Pauses video player to prevent autoplay
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether the video was successfully paused
 */
async function pauseVideoPlayer(page) {
  try {
    console.log('Attempting to pause video player...');
    
    const paused = await page.evaluate(() => {
      // Try multiple strategies to pause video
      
      // Strategy 1: Find video element and pause it directly
      const findAndPauseVideo = () => {
        const videoElements = document.querySelectorAll('video');
        if (videoElements.length > 0) {
          for (const video of videoElements) {
            if (!video.paused) {
              console.log('Found playing video, pausing it directly');
              video.pause();
              return true;
            }
          }
        }
        return false;
      };
      
      // // Strategy 2: Click on common pause button elements
      // const clickPauseButton = () => {
      //   // Common selectors for pause buttons
      //   const pauseSelectors = [
      //     '[aria-label="Pause"]',
      //     '[data-e2e="video-play-pause-button"]',
      //     '.tiktok-play-button',
      //     '.video-play-button'
      //   ];
        
      //   for (const selector of pauseSelectors) {
      //     const pauseBtn = document.querySelector(selector);
      //     if (pauseBtn) {
      //       console.log(`Found pause button with selector: ${selector}`);
      //       pauseBtn.click();
      //       return true;
      //     }
      //   }
      //   return false;
      // };
      
      // // Strategy 3: Click on the video container to toggle pause
      // const clickVideoContainer = () => {
      //   // Common selectors for video containers
      //   const containerSelectors = [
      //     '#one-column-item-0',
      //     '.css-inw5a9-BasePlayerContainer-DivVideoPlayerContainer',
      //     '.css-1j3k693-DivContainer',
      //     '.css-41hm0z',
      //     '[class*="DivVideoPlayerContainer"]',
      //     '[class*="DivContainer"]'
      //   ];
        
      //   for (const selector of containerSelectors) {
      //     const container = document.querySelector(selector);
      //     if (container) {
      //       console.log(`Found video container with selector: ${selector}`);
      //       // First check if video is playing
      //       const video = container.querySelector('video');
      //       if (video && !video.paused) {
      //         container.click();
      //         return true;
      //       }
      //     }
      //   }
      //   return false;
      // };
      
      // // Strategy 4: Disable autoplay by finding and modifying the player settings
      // const disableAutoplay = () => {
      //   try {
      //     // Find player instance in window objects
      //     if (window.player && typeof window.player.pause === 'function') {
      //       window.player.pause();
      //       return true;
      //     }
          
      //     // Inject CSS to disable autoplay indicators
      //     const style = document.createElement('style');
      //     style.textContent = `
      //       [data-e2e="recommend-list-item-container"] {
      //         pointer-events: none !important;
      //       }
      //       .video-card-container {
      //         pointer-events: none !important;
      //       }
      //     `;
      //     document.head.appendChild(style);
      //     return true;
      //   } catch (e) {
      //     console.error('Error in disableAutoplay:', e);
      //     return false;
      //   }
      // };
      
      // Try all strategies
      return findAndPauseVideo() 
    });
    
    return paused;
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `❌ Error pausing video: ${error.message}`);
    return false;
  }
}

/**
 * Detects and dismisses floating popups and pauses video to prevent autoplay
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether any popup was detected and handled or video was paused
 */
async function dismissTikTokPopups(page) {
  console.log('Checking for TikTok floating popups and pausing video...');
  
  try {
    // Step 1: First try to pause video to prevent autoplay
    const videoPaused = await pauseVideoPlayer(page);
    if (videoPaused) {
      console.log('\x1b[32m%s\x1b[0m', '✅ Successfully paused video player');
    }
    
    // Step 2: Handle floating elements/popups
    // List of selectors for common TikTok popup close buttons
    const closeButtonSelectors = [
      // Selector spesifik yang Anda temukan
      '.css-mp9aqo-DivIconCloseContainer',
      // Selector lain yang mungkin mirip
      '[class*="DivIconCloseContainer"]',
      '.icon-close-container',
      // Selector umum untuk tombol close
      '[data-e2e="video-ad-close"]',
      'button[aria-label="Close"]',
      '.modal-btn-close',
      '.close-btn',
      '[data-e2e="modal-close-inner-button"]',
      // Opsi tombol "Tidak tertarik", "Tidak sekarang", dll
      'button:has-text("Not Now")',
      'button:has-text("Tidak Sekarang")',
      'button:has-text("Tidak Tertarik")',
      'button:has-text("Not Interested")'
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
          console.log('\x1b[32m%s\x1b[0m', '✅ Popup successfully dismissed!');          
        }
      } catch (error) {
        console.log(`Failed to handle selector ${selector}: ${error.message}`);
        // Continue to next selector
      }
    }
    
    // If no popup found with direct selectors, try the general detection approach
    if (!popupDismissed) {
      console.log('Trying general popup detection approach...');
      
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
        console.log('\x1b[32m%s\x1b[0m', '✅ Found and dismissed overlay using general detection');
        popupDismissed = true;
        
        // Wait for animation to complete
        await waitFor(1500);
      }
    }
    
    return videoPaused || popupDismissed;
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `❌ Error handling popups or pausing video: ${error.message}`);
    return false;
  }
}

/**
 * Handles TikTok login process with cookie management and captcha handling
 * @param {string} email User's email address
 * @param {string} password User's password
 * @param {string} targetVideoUrl Optional target video URL to navigate to after successful login
 * @returns {Promise<{success: boolean, page: Page, browser: Browser}>} Login result with browser objects
 */
async function tiktokLogin(email, password, targetVideoUrl = null) {
  console.log('Memulai proses login TikTok...');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      '--window-size=1280,800',
      '--start-maximized',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Anti-detection measures
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      delete navigator.__proto__.webdriver;
    });
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Load cookies logic
    const cookieFileName = `cookies_${email.replace('@', '_').replace('.', '_')}.json`;
    const cookiePath = path.join(__dirname, './data/cookies', cookieFileName);
    
    let hasCookies = false;
    
    try {
      if (fs.existsSync(cookiePath)) {
        const cookiesString = fs.readFileSync(cookiePath, 'utf8');
        const cookies = JSON.parse(cookiesString);
        
        const now = new Date();
        const validCookies = cookies.filter(cookie => 
          !cookie.expires || new Date(cookie.expires * 1000) > now
        );
        
        if (validCookies.length > 0) {
          await page.setCookie(...validCookies);
          hasCookies = true;
          console.log('Cookies yang tersimpan berhasil dimuat');
        }
      }
    } catch (error) {
      console.log('Tidak ada cookies yang tersimpan atau error saat memuat cookies:', error);
    }
    
    // Cookie-based login check
    if (hasCookies) {
      // Langsung navigasi ke URL target jika tersedia, jika tidak ke homepage
      const initialUrl = targetVideoUrl || 'https://www.tiktok.com/';
      console.log(`Navigasi dengan cookies ke: ${initialUrl}`);
      
      await page.goto(initialUrl, { 
        waitUntil: 'networkidle2',
        timeout: 0
      });

      await dismissTikTokPopups(page);
      
      // Cek apakah ada captcha setelah menavigasi ke halaman
      const hasCaptcha = await checkForCaptcha(page);
      if (hasCaptcha) {
        console.log('\x1b[33m%s\x1b[0m', '⚠️ CAPTCHA terdeteksi!');
        // Gunakan API SadCaptcha untuk menyelesaikan captcha
        const captchaSolved = await handleCaptcha(page);
        
        if (captchaSolved) {
          console.log('\x1b[32m%s\x1b[0m', '✅ CAPTCHA berhasil diselesaikan.');
        } else {
          console.log('\x1b[31m%s\x1b[0m', '❌ Gagal menyelesaikan CAPTCHA.');
        }
      }
      
      // Gunakan page.evaluate sebagai pengganti page.waitForTimeout
      await page.evaluate(() => {
        return new Promise(resolve => setTimeout(resolve, 5000));
      });
      
      // Cek apakah sudah login
      const isLoggedIn = await page.evaluate(() => {
        const profileLink = document.querySelector('a[data-e2e="nav-profile"]');
        if (profileLink) {
          const href = profileLink.getAttribute('href');
          return href !== '/@' && href.includes('/@');
        }
        return false;
      });
      
      if (isLoggedIn) {
        console.log('Berhasil login menggunakan cookies tersimpan!');
        return {
          success: true,
          page: page,
          browser: browser
        };
      } else {
        console.log('Cookies tidak valid lagi, akan melakukan login manual');
      }
    }
    
    // Manual login process
    console.log('Mengakses halaman login TikTok...');
    await page.goto('https://www.tiktok.com/login/phone-or-email/email', { 
      waitUntil: 'networkidle2',
      timeout: 0
    });

    // Cek apakah ada captcha pada halaman login
    const hasCaptchaOnLogin = await checkForCaptcha(page);
    if (hasCaptchaOnLogin) {
      console.log('\x1b[33m%s\x1b[0m', '⚠️ CAPTCHA terdeteksi pada halaman login!');
      // Gunakan API SadCaptcha untuk menyelesaikan captcha
      const captchaSolved = await handleCaptcha(page);
      
      if (captchaSolved) {
        console.log('\x1b[32m%s\x1b[0m', '✅ CAPTCHA berhasil diselesaikan.');
      } else {
        console.log('\x1b[31m%s\x1b[0m', '❌ Gagal menyelesaikan CAPTCHA.');
      }
    }
    
    await page.waitForSelector('.tiktok-11to27l-InputContainer', { visible: true});
    console.log('Halaman login telah dimuat');
    
    // Simulasi perilaku manusia - gunakan evaluate untuk delay
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    });
    
    console.log('Mengisi email/username...');
    await page.type('.tiktok-11to27l-InputContainer', email, {
      delay: 100 + Math.random() * 100
    });
    
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1500));
    });
    
    console.log('Mengisi password...');
    await page.type('.tiktok-wv3bkt-InputContainer', password, {
      delay: 120 + Math.random() * 80
    });
    
    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    });
    
    console.log('Memeriksa status tombol login...');
    await page.waitForFunction(() => {
      const loginButton = document.querySelector('button[data-e2e="login-button"]');
      return loginButton && !loginButton.disabled;
    }, { }).catch(() => {
      console.log('Tombol login mungkin masih disabled, akan mencoba mengklik');
    });
    
    console.log('Mengklik tombol login...');
    await page.click('button[data-e2e="login-button"]');

    // Cek apakah captcha muncul setelah klik login
    const hasCaptchaAfterLogin = await checkForCaptcha(page);
    if (hasCaptchaAfterLogin) {
      console.log('\x1b[33m%s\x1b[0m', '⚠️ CAPTCHA terdeteksi setelah klik login!');
      // Gunakan API SadCaptcha untuk menyelesaikan captcha
      const captchaSolved = await handleCaptcha(page);
      
      if (captchaSolved) {
        console.log('\x1b[32m%s\x1b[0m', '✅ CAPTCHA berhasil diselesaikan.');
        
        // Tunggu navigasi setelah captcha diselesaikan
        await page.waitForNavigation({ 
          waitUntil: 'networkidle2',
          timeout: 0
        }).catch(e => {
          console.log('Navigasi timeout setelah menyelesaikan captcha.');
        });
      } else {
        console.log('\x1b[31m%s\x1b[0m', '❌ Gagal menyelesaikan CAPTCHA.');
      }
    } else {
      // Lanjutkan dengan normal navigation wait
      await page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: 0
      }).catch(e => {
        console.log('Navigasi timeout, mungkin ada CAPTCHA atau verifikasi lain.');
      });
    }
    
    // Login success check
    const isSuccess = page.url().includes('tiktok.com/foryou') || 
                      page.url().includes('tiktok.com/following') || 
                      await page.evaluate(() => {
                        return document.querySelector('a[data-e2e="profile-icon"]') !== null;
                      });
    
    if (isSuccess) {
      console.log('Login berhasil!');
      
      // Save cookies for future use
      try {
        const cookies = await page.cookies();
        
        const cookiesDir = path.join(__dirname, './data/cookies');
        if (!fs.existsSync(cookiesDir)) {
          fs.mkdirSync(cookiesDir, { recursive: true });
        }
        
        fs.writeFileSync(cookiePath, JSON.stringify(cookies));
        console.log('Cookies berhasil disimpan untuk penggunaan selanjutnya');
      } catch (error) {
        console.error('Error saat menyimpan cookies:', error);
      }
      
      // Navigasi ke URL video target jika ada setelah berhasil login manual
      if (targetVideoUrl) {
        console.log(`Login berhasil, navigasi ke video target: ${targetVideoUrl}`);
        await page.goto(targetVideoUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 60000 
        }).catch(e => {
          console.log(`Navigasi ke video target timeout: ${e.message}`);
        });
        
        // Cek captcha setelah navigasi ke video target
        const hasCaptchaOnTarget = await checkForCaptcha(page);
        if (hasCaptchaOnTarget) {
          console.log('\x1b[33m%s\x1b[0m', '⚠️ CAPTCHA terdeteksi pada halaman video target!');
          await handleCaptcha(page);
        }
      }
    } else {
      console.log('Login tidak berhasil');
    }
    
    return {
      success: isSuccess,
      page: page,
      browser: browser
    };
    
  } catch (error) {
    console.error('Terjadi kesalahan saat login:', error);
    await browser.close();
    throw error;
  }
}

/**
 * Placeholder for checkForCaptcha function - will be imported from captcha.js
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether captcha is detected
 */
async function checkForCaptcha(page) {
  // This will be imported from captcha.js
  // Temporary implementation for file structure purposes
  return await page.evaluate(() => {
    // Cek berbagai elemen yang menunjukkan adanya captcha
    const captchaIndicators = [
      // Elemen container captcha
      document.querySelector('.captcha-verify-container'),
      document.querySelector('.secsdk-captcha-wrapper'),
      document.querySelector('.captcha_verify_container'),
      document.querySelector('.tiktok-captcha'),
      
      // Teks yang menunjukkan captcha
      document.body.innerText.includes('captcha'),
      document.body.innerText.includes('Captcha'),
      document.body.innerText.includes('Slide to verify'),
      document.body.innerText.includes('Geser untuk memverifikasi'),
      document.body.innerText.includes('Drag the puzzle'),
      
      // Elemen slide bar captcha
      document.querySelector('.captcha-verify-slide--slidebar'),
      document.querySelector('.secsdk-captcha-drag-icon')
    ];
    
    // Return true jika salah satu indicator ada
    return captchaIndicators.some(indicator => indicator);
  });
}

/**
 * Placeholder for handleCaptcha function - will be imported from captcha.js
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether captcha was solved successfully
 */
async function handleCaptcha(page) {
  // This will be imported from captcha.js
  // Temporary implementation for file structure purposes
  console.log('Handling captcha...');
  return false;
}

module.exports = {
  tiktokLogin
};