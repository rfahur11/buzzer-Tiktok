const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Handles TikTok login process with cookie management and captcha handling
 * @param {string} email User's email address
 * @param {string} password User's password
 * @returns {Promise<{success: boolean, page: Page, browser: Browser}>} Login result with browser objects
 */
async function tiktokLogin(email, password) {
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
    const cookiePath = path.join(__dirname, '../data/cookies', cookieFileName);
    
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
      await page.goto('https://www.tiktok.com/', { 
        waitUntil: 'networkidle2',
        timeout: 0
      });

      
      // Cek apakah ada captcha setelah menavigasi ke halaman
      const hasCaptcha = await checkForCaptcha(page);
      if (hasCaptcha) {
        console.log('\x1b[33m%s\x1b[0m', '⚠️ CAPTCHA terdeteksi pada halaman utama!');
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
        // Bisa ditambahkan retry atau langkah lain disini jika perlu
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
        
        const cookiesDir = path.join(__dirname, '../data/cookies');
        if (!fs.existsSync(cookiesDir)) {
          fs.mkdirSync(cookiesDir, { recursive: true });
        }
        
        fs.writeFileSync(cookiePath, JSON.stringify(cookies));
        console.log('Cookies berhasil disimpan untuk penggunaan selanjutnya');
      } catch (error) {
        console.error('Error saat menyimpan cookies:', error);
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