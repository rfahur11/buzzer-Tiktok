const { tiktokLogin } = require('./auth');
const { commentOnVideo } = require('./comment');
const { likeVideo } = require('./like');
const { 
  loadComments, 
  loadUserAccounts, 
  selectCommentByGender,
  ensureDirectoryStructure 
} = require('./data-loader');
const { 
  humanDelay, 
  logStatus, 
  takeScreenshot,
  cleanupScreenshots 
} = require('./utils.js');

// Track active browser instances for proper cleanup
const activeBrowsers = [];

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
        // Login with current account
        const loginResult = await tiktokLogin(account.email, account.password);
        
        if (loginResult.success) {
          browser = loginResult.browser;
          page = loginResult.page;
          activeBrowsers.push(browser);
          
          logStatus(`Successfully logged in as ${account.email}`, 'success');
          
          // Take screenshot of successful login (optional)
          if (options.takeScreenshots) {
            await takeScreenshot(page, `login_success_${account.email.replace('@', '_')}`, 'login');
          }
          
          // Process each target video
          for (const videoUrl of targetVideos) {
            logStatus(`Processing video: ${videoUrl}`, 'info');
            
            // Comment on video if comment datasets exist
            if (commentDatasets.length > 0) {
              // Select random dataset and generate gender-appropriate comment
              const randomDataset = commentDatasets[Math.floor(Math.random() * commentDatasets.length)];
              const selectedComment = selectCommentByGender(randomDataset, account.gender);
              
              // Attempt to comment on the video
              const commentSuccess = await commentOnVideo(page, videoUrl, selectedComment);
              
              if (commentSuccess) {
                logStatus(`Comment posted successfully: "${selectedComment}"`, 'success');
              } else {
                logStatus(`Failed to comment on video`, 'error');
              }
              
              // Add small delay between comment and like
              await humanDelay(page, 3000, 5000);
            }
            
            // Attempt to like the video
            const likeSuccess = await likeVideo(page);
            
            if (likeSuccess) {
              logStatus('Like added successfully', 'success');
            } else {
              logStatus('Failed to like video', 'error');
            }
            
            // Random delay between videos
            const waitTime = await humanDelay(page, 15000, 30000);
            logStatus(`Waiting ${Math.round(waitTime/1000)} seconds before next video`, 'info');
          }
          
          // // Navigate to home before logout
          // await page.goto('https://www.tiktok.com/', { waitUntil: 'networkidle2' });
          
        //   // Remove from active browsers list after closing
        //   activeBrowsers.splice(activeBrowsers.indexOf(browser), 1);
        //   await browser.close();
        //   logStatus(`Completed account: ${account.email}`, 'success');
        // } else {
        //   logStatus(`Login failed for account: ${account.email}`, 'error');
        //   if (browser) {
        //     activeBrowsers.splice(activeBrowsers.indexOf(browser), 1);
        //     await browser.close();
        //   }
        }
        
        // Wait random interval before next account
        // const waitTime = Math.floor(3000 + Math.random() * 6000);
        // logStatus(`Waiting ${Math.round(waitTime/1000)} seconds before next account`, 'info');
        // await new Promise(resolve => setTimeout(resolve, waitTime));
        
      } catch (error) {
        logStatus(`Error with account ${account.email}: ${error.message}`, 'error');
        console.error(error);
        
        // Take error screenshot
        if (page) {
          await takeScreenshot(page, `error_${account.email.replace('@', '_')}`, 'errors');
        }
        
        // Close browser on error
        // if (browser) {
        //   activeBrowsers.splice(activeBrowsers.indexOf(browser), 1);
        //   await browser.close();
        // }
      }
    }
    
    // Process completion
    const totalTime = (Date.now() - startTime) / 1000;
    logStatus(`All accounts processed. Total time: ${totalTime.toFixed(2)} seconds`, 'success');
    
    // Clean up screenshots if configured
    if (options.cleanScreenshots) {
      await cleanupScreenshots();
    }
    
  } catch (error) {
    logStatus(`Fatal error in automation process: ${error.message}`, 'error');
    console.error(error);
  }
}

/**
 * Graceful cleanup when process is interrupted
 */
async function cleanupOnExit() {
  logStatus('Process interrupted, cleaning up...', 'warning');
  
  // Close all active browsers
  for (const browser of activeBrowsers) {
    try {
      await browser.close();
      logStatus('Closed browser instance', 'info');
    } catch (error) {
      logStatus(`Error closing browser: ${error.message}`, 'error');
    }
  }
  
  process.exit(0);
}

/**
 * Process command line arguments for configuration
 * @returns {Object} Configuration options
 */
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const options = {
    takeScreenshots: false,
    cleanScreenshots: true,
    targetVideos: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--screenshots' || arg === '-s') {
      options.takeScreenshots = true;
    }
    else if (arg === '--keep-screenshots' || arg === '-k') {
      options.cleanScreenshots = false;
    }
    else if (arg === '--videos' || arg === '-v') {
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
  --screenshots, -s       Take screenshots during automation
  --keep-screenshots, -k  Don't delete screenshots after completion
  --videos, -v <urls>     Comma-separated list of TikTok video URLs to target
  --help, -h              Show this help message
      `);
      process.exit(0);
    }
  }
  
  return options;
}

// Register cleanup handlers
process.on('SIGINT', cleanupOnExit);
process.on('SIGTERM', cleanupOnExit);
process.on('uncaughtException', (error) => {
  logStatus(`Uncaught exception: ${error.message}`, 'error');
  console.error(error);
  cleanupOnExit();
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