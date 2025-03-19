const fs = require('fs');
const path = require('path');

/**
 * Loads comments from a JSON file
 * @param {string} commentFile Name of the comment file to load
 * @returns {Array} Array of comment objects
 */
function loadComments(commentFile) {
  try {
    // Path relative to src directory
    const filePath = path.join(__dirname, './data', commentFile);
    
    // Try to read and parse the file
    const fileData = fs.readFileSync(filePath, 'utf8');
    const comments = JSON.parse(fileData);
    
    console.log(`Berhasil memuat ${comments.length} komentar dari file ${commentFile}`);
    
    return comments;
  } catch (error) {
    console.error(`Error saat memuat file ${commentFile}:`, error);
    return [];
  }
}

/**
 * Loads user account information from JSON
 * @returns {Array} Array of user account objects with email, password, and gender
 */
function loadUserAccounts() {
  try {
    // Path relative to src directory
    const filePath = path.join(__dirname, './data/user.json');
    
    // Try to read and parse the file
    const fileData = fs.readFileSync(filePath, 'utf8');
    const users = JSON.parse(fileData);
    
    console.log(`Berhasil memuat ${users.length} akun dari file JSON`);
    
    // Map to consistent property names and handle potential case inconsistencies
    return users.map(user => ({
      email: user.Email || user.email,
      password: user.Pasword || user.Password || user.password, // Handle the typo "Pasword" from original code
      gender: user.Gender || user.gender
    }));
  } catch (error) {
    console.error('Error saat memuat file user.json:', error);
    return [];
  }
}

/**
 * Selects a comment based on user gender
 * @param {Array} comments Array of comment objects
 * @param {string} gender Gender to filter comments by ('male', 'female', etc.)
 * @returns {string} Selected comment text
 */
function selectCommentByGender(comments, gender) {
  // Check if comments have gender property
  const hasGenderProperty = comments.some(comment => comment.hasOwnProperty('gender'));
  
  if (hasGenderProperty && gender) {
    // Filter comments that match the specified gender
    const matchingComments = comments.filter(comment => 
      comment.gender && comment.gender.toLowerCase() === gender.toLowerCase()
    );
    
    // If we found matching comments, select one randomly
    if (matchingComments.length > 0) {
      const randomIndex = Math.floor(Math.random() * matchingComments.length);
      return matchingComments[randomIndex].comment;
    }
  }
  
  // If no gender match or no gender property exists, select random comment
  const randomIndex = Math.floor(Math.random() * comments.length);
  return comments[randomIndex].comment || comments[randomIndex].text || "";
}

/**
 * Gets the path for storing cookies for a specific user
 * @param {string} email User's email address
 * @returns {string} Full path to the cookie file
 */
function getCookiePath(email) {
  // Create safe filename from email
  const cookieFileName = `cookies_${email.replace('@', '_').replace('.', '_')}.json`;
  
  // Ensure cookies directory exists
  const cookiesDir = path.join(__dirname, './data/cookies');
  if (!fs.existsSync(cookiesDir)) {
    fs.mkdirSync(cookiesDir, { recursive: true });
  }
  
  return path.join(cookiesDir, cookieFileName);
}

/**
 * Saves cookies to a file for later use
 * @param {string} email User's email address
 * @param {Array} cookies Array of cookie objects from Puppeteer
 * @returns {boolean} Whether the cookies were saved successfully
 */
function saveCookies(email, cookies) {
  try {
    const cookiePath = getCookiePath(email);
    
    fs.writeFileSync(cookiePath, JSON.stringify(cookies));
    console.log('Cookies berhasil disimpan untuk penggunaan selanjutnya');
    return true;
  } catch (error) {
    console.error('Error saat menyimpan cookies:', error);
    return false;
  }
}

/**
 * Loads cookies for a specific user
 * @param {string} email User's email address
 * @returns {Array|null} Array of cookie objects or null if not found
 */
function loadCookies(email) {
  try {
    const cookiePath = getCookiePath(email);
    
    if (fs.existsSync(cookiePath)) {
      const cookiesString = fs.readFileSync(cookiePath, 'utf8');
      const cookies = JSON.parse(cookiesString);
      
      // Filter out expired cookies
      const now = new Date();
      const validCookies = cookies.filter(cookie => 
        !cookie.expires || new Date(cookie.expires * 1000) > now
      );
      
      if (validCookies.length > 0) {
        console.log('Cookies yang tersimpan berhasil dimuat');
        return validCookies;
      }
    }
    
    return null;
  } catch (error) {
    console.log('Tidak ada cookies yang tersimpan atau error saat memuat cookies:', error);
    return null;
  }
}

/**
 * Ensures the necessary directories exist in the data structure
 */
function ensureDirectoryStructure() {
  const directories = [
    path.join(__dirname, './data'),
    path.join(__dirname, './data/cookies'),
    path.join(__dirname, './data/captcha-screenshots')
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Directory created: ${dir}`);
    }
  });
}

// Initialize directory structure when module is loaded
ensureDirectoryStructure();

module.exports = {
  loadComments,
  loadUserAccounts,
  selectCommentByGender,
  getCookiePath,
  saveCookies,
  loadCookies,
  ensureDirectoryStructure
};