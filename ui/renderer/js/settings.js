// Settings tab functionality
document.addEventListener('DOMContentLoaded', () => {
    const enableHeadless = document.getElementById('enable-headless');
    const autoSolveCaptcha = document.getElementById('auto-solve-captcha');
    const captchaService = document.getElementById('captcha-service');
    const captchaApiKey = document.getElementById('captcha-api-key');
    const saveSettingsBtn = document.getElementById('save-settings');
    const settingsSavedMessage = document.getElementById('settings-saved-message');
    
    // Load settings when tab is shown
    document.querySelector('button[data-tab="settings-tab"]').addEventListener('click', loadSettings);
    
    // Load settings
    async function loadSettings() {
        try {
            // Try to get settings from IPC / localStorage
            let settings;
            
            if (window.tiktokAPI && window.tiktokAPI.getSettings) {
                // Get settings from main process if available
                settings = await window.tiktokAPI.getSettings();
            } else {
                // Fallback to localStorage
                const savedSettings = localStorage.getItem('tiktok-automation-settings');
                settings = savedSettings ? JSON.parse(savedSettings) : getDefaultSettings();
            }
            
            // Apply settings to form
            enableHeadless.checked = settings.headless;
            autoSolveCaptcha.checked = settings.autoSolveCaptcha;
            captchaService.value = settings.captchaService || 'none';
            captchaApiKey.value = settings.captchaApiKey || '';
            
            console.log('Settings loaded');
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    // Save settings
    saveSettingsBtn.addEventListener('click', async () => {
        const settings = {
            headless: enableHeadless.checked,
            autoSolveCaptcha: autoSolveCaptcha.checked,
            captchaService: captchaService.value,
            captchaApiKey: captchaApiKey.value
        };
        
        try {
            if (window.tiktokAPI && window.tiktokAPI.saveSettings) {
                // Save via IPC if available
                await window.tiktokAPI.saveSettings(settings);
            } else {
                // Fallback to localStorage
                localStorage.setItem('tiktok-automation-settings', JSON.stringify(settings));
            }
            
            // Show success message
            settingsSavedMessage.style.display = 'inline-block';
            setTimeout(() => {
                settingsSavedMessage.style.display = 'none';
            }, 3000);
            
            console.log('Settings saved');
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    });
    
    // Default settings
    function getDefaultSettings() {
        return {
            headless: true,
            autoSolveCaptcha: true,
            captchaService: 'none',
            captchaApiKey: ''
        };
    }
    
    // Initialize settings
    // loadSettings();
});