const { tiktokLogin } = require('./auth');
const { likeVideo } = require('./like');
// const { commentOnVideo } = require('./comment');
const { checkForCaptcha, handleCaptcha } = require('./captcha/index');
const { 
  loadComments, 
  loadUserAccounts, 
  selectCommentByGender,
  ensureDirectoryStructure 
} = require('./data-loader');
const { humanDelay, logStatus } = require('./utils.js');




// Track active browser instances for proper cleanup
const activeBrowsers = [];

/**
 * Helper function to check and solve CAPTCHA if present
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether CAPTCHA was solved or not present
 */
async function checkAndSolveCaptcha(page) {
  try {
    // Check for CAPTCHA
    const hasCaptcha = await checkForCaptcha(page);
    
    if (hasCaptcha) {
      logStatus('CAPTCHA detected, attempting to solve...', 'warning');
      const captchaSolved = await handleCaptcha(page);
      
      if (captchaSolved) {
        logStatus('CAPTCHA solved successfully', 'success');
        // Wait to ensure page is fully loaded after CAPTCHA
        await humanDelay(page, 3000, 5000);
        return true;
      } else {
        logStatus('Failed to solve CAPTCHA', 'error');
        return false;
      }
    }
    
    // No CAPTCHA found
    return true;
  } catch (error) {
    logStatus(`Error during CAPTCHA check/solve: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Main function to manage automation of multiple TikTok accounts
 * @param {Object} options Configuration options
 * @returns {Promise<void>}
 */
async function manageMultipleAccounts(options = {}) {
  const startTime = Date.now();
  logStatus('Starting TikTok automation process', 'info');

  // Ensure data directories exist
  ensureDirectoryStructure();

  try {
    // Load target videos (default or from options)
    const targetVideos = options.targetVideos || [
      'https://www.tiktok.com/@glosyhacks/video/7438458721350585656'
      // Add more URLs as needed
    ];

    // Load user accounts
    const accounts = loadUserAccounts();
    if (accounts.length === 0) {
      logStatus('No accounts loaded, process terminated', 'error');
      return;
    }

    logStatus(`Processing ${accounts.length} accounts`, 'info');
    
    // Load comment datasets
    const commentDatasets = [
      loadComments('sila.json'),
      loadComments('fay.json')
    ].filter(dataset => dataset.length > 0);
    
    if (commentDatasets.length === 0) {
      logStatus('No comment data loaded, comments will be skipped', 'warning');
    }

    // Process each account
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      logStatus(`Processing account ${i+1}/${accounts.length}: ${account.email}`, 'info');
      
      let browser = null;
      let page = null;
      
      try {
        // Login dengan current account dan langsung ke video target pertama
        const firstVideoUrl = targetVideos[0]; // Ambil URL video pertama
        const loginResult = await tiktokLogin(account.email, account.password, firstVideoUrl);
        
        if (loginResult.success) {
          browser = loginResult.browser;
          page = loginResult.page;
          activeBrowsers.push(browser);
          
          logStatus(`Successfully logged in as ${account.email}`, 'success');
          
          // Proses video pertama yang sudah terbuka
          logStatus(`Processing first video: ${firstVideoUrl}`, 'info');
          
          // Tambahkan delay untuk pastikan halaman interaktif
          await humanDelay(page, 2000, 3000);
          
          // Cek CAPTCHA pada halaman video
          const initialCaptchaSolved = await checkAndSolveCaptcha(page);
          if (!initialCaptchaSolved) {
            logStatus('Could not solve initial CAPTCHA, skipping this video', 'error');
          } else {
            // Proses like video pertama
            logStatus('Attempting to like the video...', 'info');
            const likeSuccess = await likeVideo(page);
            
            if (likeSuccess) {
              logStatus('Successfully liked the video', 'success');
            } else {
              logStatus('Failed to like the video', 'warning');
            }
            
            // Tambahkan delay kecil antara like dan komentar
            await humanDelay(page, 2000, 3000);
            
            // Proses komentar jika dataset komentar tersedia
            if (commentDatasets.length > 0) {
              // Pilih dataset komentar secara acak
              const randomDataset = commentDatasets[Math.floor(Math.random() * commentDatasets.length)];
              
              // Pilih komentar berdasarkan gender akun
              const selectedComment = selectCommentByGender(randomDataset, account.gender || 'neutral');
              
              logStatus(`Attempting to comment: "${selectedComment}"`, 'info');
              const commentSuccess = await commentOnVideo(page, selectedComment);
              
              if (commentSuccess) {
                logStatus(`Comment posted successfully: "${selectedComment}"`, 'success');
              } else {
                logStatus('Failed to post comment', 'warning');
              }
            }
          }
          
          // Proses video-video selanjutnya mulai dari indeks 1
          for (let j = 1; j < targetVideos.length; j++) {  // Gunakan 'j' bukan 'i' karena 'i' sudah digunakan
            const videoUrl = targetVideos[j];
            logStatus(`Processing video ${j+1}/${targetVideos.length}: ${videoUrl}`, 'info');
            
            try {
              // Navigate to the next video
              await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 60000 });
              logStatus('Video page loaded successfully', 'info');
              
              // Delay untuk pastikan halaman interaktif
              await humanDelay(page, 2000, 3000);
              
              // Cek CAPTCHA pada halaman video
              const captchaSolved = await checkAndSolveCaptcha(page);
              if (!captchaSolved) {
                logStatus('Could not solve CAPTCHA, skipping this video', 'error');
                continue; // Skip to next video
              }
              
              // Proses like video
              logStatus('Attempting to like the video...', 'info');
              const likeSuccess = await likeVideo(page);
              
              if (likeSuccess) {
                logStatus('Successfully liked the video', 'success');
              } else {
                logStatus('Failed to like the video', 'warning');
              }
              
              // Tambahkan delay kecil antara like dan komentar
              await humanDelay(page, 2000, 3000);
              
              // Proses komentar jika dataset komentar tersedia
              if (commentDatasets.length > 0) {
                // Pilih dataset komentar secara acak
                const randomDataset = commentDatasets[Math.floor(Math.random() * commentDatasets.length)];
                
                // Pilih komentar berdasarkan gender akun
                const selectedComment = selectCommentByGender(randomDataset, account.gender || 'neutral');
                
                logStatus(`Attempting to comment: "${selectedComment}"`, 'info');
                const commentSuccess = await commentOnVideo(page, selectedComment);
                
                if (commentSuccess) {
                  logStatus(`Comment posted successfully: "${selectedComment}"`, 'success');
                } else {
                  logStatus('Failed to post comment', 'warning');
                }
              }
              
              // Delay sebelum lanjut ke video berikutnya
              await humanDelay(page, 3000, 5000);
              
            } catch (videoError) {
              logStatus(`Error processing video ${videoUrl}: ${videoError.message}`, 'error');
              
              // Cek apakah ada CAPTCHA setelah error (mungkin muncul karena aktivitas mencurigakan)
              await checkAndSolveCaptcha(page);
            }
          }
        }
      }
       catch (error) {
        logStatus(`Error with account ${account.email}: ${error.message}`, 'error');
        console.error(error);
        
        // // Close browser on error
        // if (browser) {
        //   activeBrowsers.splice(activeBrowsers.indexOf(browser), 1);
        //   await browser.close();
        // }
      }
    }
    
    // Process completion
    const totalTime = (Date.now() - startTime) / 1000;
    logStatus(`All accounts processed. Total time: ${totalTime.toFixed(2)} seconds`, 'success');
    
  } catch (error) {
    logStatus(`Fatal error in automation process: ${error.message}`, 'error');
    console.error(error);
  }
}

/**
 * Graceful cleanup when process is interrupted
 */
// async function cleanupOnExit() {
//   logStatus('Process interrupted, cleaning up...', 'warning');
  
//   // Close all active browsers
//   for (const browser of activeBrowsers) {
//     try {
//       await browser.close();
//       logStatus('Closed browser instance', 'info');
//     } catch (error) {
//       logStatus(`Error closing browser: ${error.message}`, 'error');
//     }
//   }
  
//   process.exit(0);
// }

/**
 * Process command line arguments for configuration
 * @returns {Object} Configuration options
 */
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const options = {
    targetVideos: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--videos' || arg === '-v') {
      if (i + 1 < args.length) {
        try {
          options.targetVideos = args[++i].split(',');
        } catch (e) {
          console.error('Invalid video list format. Use comma-separated URLs.');
        }
      }
    }
    else if (arg === '--help' || arg === '-h') {
      console.log(`
            TikTok Automation Tool

            Options:
              --videos, -v <urls>     Comma-separated list of TikTok video URLs to target
              --help, -h              Show this help message`);
      process.exit(0);
    }
  }
  
  return options;
}

// Register cleanup handlers
// process.on('SIGINT', cleanupOnExit);
// process.on('SIGTERM', cleanupOnExit);
process.on('uncaughtException', (error) => {
  logStatus(`Uncaught exception: ${error.message}`, 'error');
  console.error(error);
  // cleanupOnExit();
});

// Start the automation process with command line options
if (require.main === module) {
  const options = parseCommandLineArgs();
  manageMultipleAccounts(options).catch(error => {
    logStatus(`Automation process failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  });
}

// Export for use in other files
module.exports = {
  manageMultipleAccounts
};