const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { tiktokLogin } = require('../auth');
const { commentOnVideo } = require('../comment');
const { loadUserAccounts, loadComments, selectCommentByGender } = require('../data-loader');
const { logStatus } = require('../utils');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;
// Track active browser instances
let activeBrowsers = [];

function createWindow() {
  // Create the browser window with security features
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'TikTok Automation',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  // Load the index.html of the app
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when Electron is ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up browser instances when app is quitting
app.on('before-quit', async () => {
  try {
    for (const browser of activeBrowsers) {
      await browser.close();
    }
    activeBrowsers = [];
  } catch (error) {
    console.error('Error closing browsers:', error);
  }
});

// IPC HANDLERS

// Get saved accounts list
ipcMain.handle('get-saved-accounts', async () => {
  try {
    // Load accounts from user.json
    const accounts = loadUserAccounts();
    
    // Check if there are cookies for each account (indicating they were logged in before)
    const savedAccounts = accounts.map(account => {
      const cookieFileName = `cookies_${account.email.replace('@', '_').replace('.', '_')}.json`;
      const cookiePath = path.join(__dirname, '../data/cookies', cookieFileName);
      
      return {
        email: account.email,
        gender: account.gender || null,
        hasCookies: fs.existsSync(cookiePath)
      };
    });
    
    return { success: true, accounts: savedAccounts };
  } catch (error) {
    logStatus(`Error loading saved accounts: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
});

// Handle manual login
ipcMain.handle('login-manual', async (event, { email, password, gender }) => {
  try {
    logStatus(`Starting login for ${email}...`, 'info');
    
    const loginResult = await tiktokLogin(email, password);
    
    if (loginResult.success) {
      // Add browser to active browsers list
      activeBrowsers.push(loginResult.browser);
      
      // Save gender information if provided
      if (gender) {
        // This would be implemented in the data-loader.js to save gender info
        // For now, we'll just log it
        logStatus(`Account gender set to: ${gender}`, 'info');
      }
      
      return {
        success: true,
        email,
        gender,
        message: `Successfully logged in as ${email}`
      };
    } else {
      logStatus(`Login failed for ${email}`, 'error');
      return { success: false, error: 'Login failed' };
    }
  } catch (error) {
    logStatus(`Login error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
});

// Handle automatic login using saved account data
ipcMain.handle('login-auto', async (event, { email }) => {
  try {
    // Find account details
    const accounts = loadUserAccounts();
    const account = accounts.find(acc => acc.email === email);
    
    if (!account) {
      return { success: false, error: 'Account not found in user.json' };
    }
    
    logStatus(`Starting automatic login for ${email}...`, 'info');
    const loginResult = await tiktokLogin(account.email, account.password);
    
    if (loginResult.success) {
      // Add browser to active browsers
      activeBrowsers.push(loginResult.browser);
      
      return {
        success: true,
        email: account.email,
        gender: account.gender,
        message: `Successfully logged in as ${account.email}`
      };
    } else {
      logStatus(`Auto login failed for ${email}`, 'error');
      return { success: false, error: 'Login failed' };
    }
  } catch (error) {
    logStatus(`Auto login error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
});

// Handle semi-automatic login (using saved credentials but with manual gender selection)
ipcMain.handle('login-semi-auto', async (event, { email, gender }) => {
  try {
    // Find account details
    const accounts = loadUserAccounts();
    const account = accounts.find(acc => acc.email === email);
    
    if (!account) {
      return { success: false, error: 'Account not found in user.json' };
    }
    
    logStatus(`Starting semi-automatic login for ${email} with gender: ${gender}...`, 'info');
    const loginResult = await tiktokLogin(account.email, account.password);
    
    if (loginResult.success) {
      // Add browser to active browsers
      activeBrowsers.push(loginResult.browser);
      
      return {
        success: true,
        email: account.email,
        gender: gender, // Use the manually specified gender
        message: `Successfully logged in as ${account.email}`
      };
    } else {
      logStatus(`Semi-auto login failed for ${email}`, 'error');
      return { success: false, error: 'Login failed' };
    }
  } catch (error) {
    logStatus(`Semi-auto login error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
});

// Upload JSON user data
ipcMain.handle('upload-user-data', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      title: 'Select User Data JSON File'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'No file selected' };
    }

    const filePath = result.filePaths[0];
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const userData = JSON.parse(fileContent);

    // Basic validation
    if (!Array.isArray(userData)) {
      return { success: false, error: 'Invalid format: User data must be an array' };
    }

    // Return the user data to the renderer
    return { success: true, data: userData };
  } catch (error) {
    logStatus(`Error uploading user data: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
});

// Upload JSON comment data
ipcMain.handle('upload-comment-data', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      title: 'Select Comment Data JSON File'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'No file selected' };
    }

    const filePath = result.filePaths[0];
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const commentData = JSON.parse(fileContent);

    // Basic validation
    if (!Array.isArray(commentData)) {
      return { success: false, error: 'Invalid format: Comment data must be an array' };
    }

    // Return the comment data to the renderer
    return { success: true, data: commentData };
  } catch (error) {
    logStatus(`Error uploading comment data: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
});

// Handle commenting on a video
ipcMain.handle('comment-on-video', async (event, { 
  email, 
  videoUrl, 
  commentText, 
  commentMode,
  gender,
  commentData
}) => {
  try {
    const page = await findPageForAccount(email);
    
    if (!page) {
      return { success: false, error: 'Browser session not found for this account' };
    }
    
    let finalComment = commentText;
    
    // For automatic modes, select comment based on mode
    if (commentMode === 'auto' && commentData) {
      // In full auto mode, select comment with matching gender
      const selectedComment = selectCommentByGender(commentData, gender);
      if (selectedComment) {
        finalComment = selectedComment.comment;
      } else {
        return { success: false, error: 'No suitable comment found for this gender' };
      }
    }
    // For semi-auto, the comment text is already selected from uploaded data
    
    logStatus(`Commenting on video as ${email}: "${finalComment}"`, 'info');
    
    const result = await commentOnVideo(page, videoUrl, finalComment);
    
    if (result) {
      logStatus('Comment posted successfully!', 'success');
      return { success: true, message: 'Comment posted successfully' };
    } else {
      logStatus('Failed to post comment', 'error');
      return { success: false, error: 'Failed to post comment' };
    }
  } catch (error) {
    logStatus(`Comment error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
});

// Helper function to find page/browser by account email
async function findPageForAccount(email) {
  // In a real implementation, this would track which page belongs to which account
  // For now, simplifying by returning the first page of the first browser
  if (activeBrowsers.length === 0) {
    return null;
  }
  
  const pages = await activeBrowsers[0].pages();
  if (pages.length === 0) {
    return null;
  }
  
  return pages[0];
}

// Send log messages to renderer
function sendLogToRenderer(message, type = 'info') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log-message', { message, type });
  }
  
  // Also log to console
  logStatus(message, type);
}

// Log handler from renderer
ipcMain.on('log', (event, { message, type = 'info' }) => {
  logStatus(message, type);
});