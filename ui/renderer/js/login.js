// Login tab functionality
document.addEventListener('DOMContentLoaded', () => {
    // Login option tab switching
    const loginOptionTabs = document.querySelectorAll('.option-tabs .option-tab');
    const loginOptionContents = document.querySelectorAll('.login-option-content');
    
    // Add click event listeners to each login option tab
    loginOptionTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const option = tab.getAttribute('data-login-option');
            
            // Remove active class from all tabs and contents
            loginOptionTabs.forEach(t => t.classList.remove('active'));
            loginOptionContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding content
            const activeContent = document.getElementById(`${option}-login`);
            if (activeContent) {
                activeContent.classList.add('active');
            }
            
            console.log(`Switched to ${option} login tab`);
        });
    });
    
    // Main tab switching (Login, Comment, Logs)
    const mainNavButtons = document.querySelectorAll('.main-nav .nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    mainNavButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Remove active class from all buttons and tab contents
            mainNavButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Show corresponding tab content
            const activeTab = document.getElementById(tabId);
            if (activeTab) {
                activeTab.classList.add('active');
            }
        });
    });
    
    // Similar code for comment option tabs
    const commentOptionTabs = document.querySelectorAll('[data-comment-option]');
    const commentOptionContents = document.querySelectorAll('.comment-option-content');
    
    commentOptionTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const option = tab.getAttribute('data-comment-option');
            
            // Remove active class from all tabs and contents
            commentOptionTabs.forEach(t => t.classList.remove('active'));
            commentOptionContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding content
            const activeContent = document.getElementById(`${option}-comment`);
            if (activeContent) {
                activeContent.classList.add('active');
            }
        });
    });
});

