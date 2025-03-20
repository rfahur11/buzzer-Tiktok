const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('tiktokAPI', {
  // Account management
  getSavedAccounts: () => ipcRenderer.invoke('get-saved-accounts'),
  
  // Login functions
  loginManual: (email, password, gender) => 
    ipcRenderer.invoke('login-manual', { email, password, gender }),
  
  loginAuto: (email) => 
    ipcRenderer.invoke('login-auto', { email }),
    
  loginSemiAuto: (email, gender) => 
    ipcRenderer.invoke('login-semi-auto', { email, gender }),
    
  // Data upload functions
  uploadUserData: () => ipcRenderer.invoke('upload-user-data'),
  uploadCommentData: () => ipcRenderer.invoke('upload-comment-data'),
  
  // Comment functions
  commentOnVideo: (email, videoUrl, commentText, commentMode, gender, commentData) => 
    ipcRenderer.invoke('comment-on-video', { 
      email, 
      videoUrl, 
      commentText, 
      commentMode,
      gender,
      commentData
    }),
  
  // Log functions
  sendLog: (message, type = 'info') => 
    ipcRenderer.send('log', { message, type }),
    
  onLogMessage: (callback) => 
    ipcRenderer.on('log-message', (event, data) => callback(data)),
    
  // App lifecycle functions
  closeAccount: (email) => 
    ipcRenderer.invoke('close-account', { email })
});

// Set up a notification when the preload script has loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log('TikTok Automation preload script loaded');
  
  // Indicate to the DOM that the API is available
  const appRoot = document.documentElement;
  if (appRoot) {
    appRoot.classList.add('api-ready');
  }
});