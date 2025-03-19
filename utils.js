const fs = require('fs');
const path = require('path');

/**
 * Collection of screenshot paths for tracking and cleanup
 * @type {Array<string>}
 */
let screenshotPaths = [];

/**
 * Creates a human-like delay using page.evaluate
 * @param {Object} page Puppeteer page object
 * @param {number} minTime Minimum delay in milliseconds
 * @param {number} maxTime Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
async function humanDelay(page, minTime = 1000, maxTime = 3000) {
  const delayTime = Math.floor(minTime + Math.random() * (maxTime - minTime));
  await page.evaluate((time) => {
    return new Promise(resolve => setTimeout(resolve, time));
  }, delayTime);
  return delayTime;
}

/**
 * Generates a random delay time in milliseconds
 * @param {number} min Minimum delay in milliseconds
 * @param {number} max Maximum delay in milliseconds
 * @returns {number} Random delay time
 */
function getRandomDelay(min = 1000, max = 3000) {
  return Math.floor(min + Math.random() * (max - min));
}

/**
 * Takes a screenshot and stores it in the specified directory
 * @param {Object} page Puppeteer page object
 * @param {string} name Base name for the screenshot
 * @param {string} folder Subfolder within data/screenshots
 * @returns {Promise<string>} Path to the saved screenshot
 */
async function takeScreenshot(page, name, folder = 'debug') {
  try {
    // Ensure directory exists
    const screenshotDir = path.join(__dirname, `../data/screenshots/${folder}`);
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    // Create filename with timestamp
    const timestamp = Date.now();
    const filename = `${name}_${timestamp}.png`;
    const screenshotPath = path.join(screenshotDir, filename);
    
    // Take screenshot
    await page.screenshot({ path: screenshotPath });
    
    // Add to tracking array
    screenshotPaths.push(screenshotPath);
    
    console.log(`Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    console.error('Error taking screenshot:', error);
    return null;
  }
}

/**
 * Cleans up all tracked screenshots
 * @returns {Promise<void>}
 */
async function cleanupScreenshots() {
  console.log(`Cleaning up ${screenshotPaths.length} screenshot files...`);
  
  for (const filePath of screenshotPaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Successfully deleted file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
    }
  }
  
  // Reset array after cleanup
  screenshotPaths = [];
  console.log('Screenshot cleanup complete');
}

/**
 * Returns console text with color
 * @param {string} text Text to colorize
 * @param {string} color Color name - 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan'
 * @returns {string} Colorized text
 */
function colorText(text, color) {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
  };
  
  return `${colors[color] || ''}${text}${colors.reset}`;
}

/**
 * Creates a colorized status log
 * @param {string} message Message to log
 * @param {'success'|'error'|'warning'|'info'} status Status type
 */
function logStatus(message, status = 'info') {
  const statusSymbols = {
    success: '✅ ',
    error: '❌ ',
    warning: '⚠️ ',
    info: 'ℹ️ '
  };
  
  const statusColors = {
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'cyan'
  };
  
  const symbol = statusSymbols[status] || '';
  const color = statusColors[status] || 'reset';
  
  console.log(colorText(`${symbol}${message}`, color));
}

/**
 * Checks if an element is visible in the viewport
 * @param {Object} page Puppeteer page object
 * @param {string} selector CSS selector for element
 * @returns {Promise<boolean>} Whether element is visible
 */
async function isElementVisible(page, selector) {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }, selector);
}

/**
 * Scrolls element into view with natural behavior
 * @param {Object} page Puppeteer page object
 * @param {string} selector CSS selector for element
 * @returns {Promise<boolean>} Whether scroll was successful
 */
async function scrollToElement(page, selector) {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return false;
    
    // Scroll to element with smooth behavior
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center'
    });
    
    return true;
  }, selector);
}

/**
 * Randomizes typing speed for more human-like interaction
 * @param {number} baseDelay Base delay in milliseconds
 * @returns {number} Randomized typing delay
 */
function getTypingDelay(baseDelay = 100) {
  // Add natural variance to typing speed
  return baseDelay + Math.random() * (baseDelay / 2);
}

/**
 * Generates randomized mouse movement path between points
 * @param {number} startX Starting X coordinate
 * @param {number} startY Starting Y coordinate
 * @param {number} endX Ending X coordinate
 * @param {number} endY Ending Y coordinate
 * @param {number} steps Number of movement steps
 * @returns {Array<{x: number, y: number}>} Array of coordinates
 */
function generateMousePath(startX, startY, endX, endY, steps = 10) {
  const path = [];
  
  // Add some random control points for natural curve
  const controlPoint1 = {
    x: startX + (endX - startX) * (0.3 + Math.random() * 0.2),
    y: startY + (endY - startY) * (0.3 + Math.random() * 0.2) + (Math.random() * 20 - 10)
  };
  
  const controlPoint2 = {
    x: startX + (endX - startX) * (0.7 + Math.random() * 0.2),
    y: startY + (endY - startY) * (0.7 + Math.random() * 0.2) + (Math.random() * 20 - 10)
  };
  
  // Generate bezier curve points
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    
    // Cubic bezier formula
    const x = Math.pow(1 - t, 3) * startX +
              3 * Math.pow(1 - t, 2) * t * controlPoint1.x +
              3 * (1 - t) * Math.pow(t, 2) * controlPoint2.x +
              Math.pow(t, 3) * endX;
              
    const y = Math.pow(1 - t, 3) * startY +
              3 * Math.pow(1 - t, 2) * t * controlPoint1.y +
              3 * (1 - t) * Math.pow(t, 2) * controlPoint2.y +
              Math.pow(t, 3) * endY;
              
    path.push({ x: Math.round(x), y: Math.round(y) });
  }
  
  return path;
}

/**
 * Parses human-readable number strings (e.g., "1.5K", "2M") into integers
 * @param {string} text Text containing numbers with K/M/B suffixes
 * @returns {number} Parsed integer value
 */
function parseNumberText(text) {
  if (!text) return 0;
  
  // Convert text to string and clean up
  text = String(text).trim();
  
  // Handle K/M/B suffixes
  if (text.endsWith('K') || text.endsWith('k')) {
    return parseFloat(text.replace(/[Kk]/, '')) * 1000;
  } else if (text.endsWith('M') || text.endsWith('m')) {
    return parseFloat(text.replace(/[Mm]/, '')) * 1000000;
  } else if (text.endsWith('B') || text.endsWith('b')) {
    return parseFloat(text.replace(/[Bb]/, '')) * 1000000000;
  } else {
    // Remove non-digit characters except decimal points
    return parseInt(text.replace(/[^\d]/g, '')) || 0;
  }
}

/**
 * Creates directories if they don't exist
 * @param {string} dirPath Directory path to ensure
 * @returns {boolean} Whether directory exists/was created
 */
function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
    return true;
  } catch (error) {
    console.error(`Failed to create directory ${dirPath}:`, error);
    return false;
  }
}

module.exports = {
  humanDelay,
  getRandomDelay,
  takeScreenshot,
  cleanupScreenshots,
  colorText,
  logStatus,
  isElementVisible,
  scrollToElement,
  getTypingDelay,
  generateMousePath,
  parseNumberText,
  ensureDirectoryExists
};