// Handle auto-like settings visibility
const enableAutoLike = document.getElementById('enable-auto-like');
const autoLikeSettings = document.getElementById('auto-like-settings');
const likeAccountCount = document.getElementById('like-account-count');
const customLikeCount = document.getElementById('custom-like-count');
const customLikeAccountCount = document.getElementById('custom-like-account-count');

// Initially hide the auto-like settings if disabled
autoLikeSettings.style.display = enableAutoLike.checked ? 'block' : 'none';

// Toggle auto-like settings visibility
enableAutoLike.addEventListener('change', function() {
    autoLikeSettings.style.display = this.checked ? 'block' : 'none';
});

// Handle custom like count selection
likeAccountCount.addEventListener('change', function() {
    customLikeCount.style.display = this.value === 'custom' ? 'block' : 'none';
});

// Add this to your form submission handlers
document.getElementById('manual-comment-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const videoUrl = document.getElementById('video-url').value;
    const commentText = document.getElementById('comment-text').value;
    const genderTarget = document.querySelector('input[name="comment-gender"]:checked').value;
    const accountToUse = document.getElementById('comment-account').value;
    const postToAllAccounts = document.getElementById('post-all-accounts').checked;
    
    // Like settings
    const enableLike = document.getElementById('enable-auto-like').checked;
    let likeCount = document.getElementById('like-account-count').value;
    
    if (likeCount === 'custom') {
        likeCount = document.getElementById('custom-like-account-count').value;
    }
    
    // Add this to your API call
    const commentData = {
        videoUrl,
        commentText,
        genderTarget,
        accountToUse,
        postToAllAccounts,
        likeSettings: {
            enabled: enableLike,
            accountCount: likeCount
        }
    };
    
    console.log('Submitting comment with data:', commentData);
    // Call your API here
});

// Similar updates needed for auto comment forms
document.getElementById('semi-auto-comment').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const videoUrl = document.getElementById('video-url').value;
    const commentText = document.getElementById('comment-text').value;
    const genderTarget = document.querySelector('input[name="comment-gender"]:checked').value;
    const accountToUse = document.getElementById('comment-account').value;
    const postToAllAccounts = document.getElementById('post-all-accounts').checked;
    
    // Like settings
    const enableLike = document.getElementById('enable-auto-like').checked;
    let likeCount = document.getElementById('like-account-count').value;
    
    if (likeCount === 'custom') {
        likeCount = document.getElementById('custom-like-account-count').value;
    }
    
    // Add this to your API call
    const commentData = {
        videoUrl,
        commentText,
        genderTarget,
        accountToUse,
        postToAllAccounts,
        likeSettings: {
            enabled: enableLike,
            accountCount: likeCount
        }
    };
    
    console.log('Submitting comment with data:', commentData);
    // Call your API here
});

document.getElementById('auto-comment').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const videoUrl = document.getElementById('video-url').value;
    const commentText = document.getElementById('comment-text').value;
    const genderTarget = document.querySelector('input[name="comment-gender"]:checked').value;
    const accountToUse = document.getElementById('comment-account').value;
    const postToAllAccounts = document.getElementById('post-all-accounts').checked;
    
    // Like settings
    const enableLike = document.getElementById('enable-auto-like').checked;
    let likeCount = document.getElementById('like-account-count').value;
    
    if (likeCount === 'custom') {
        likeCount = document.getElementById('custom-like-account-count').value;
    }
    
    // Add this to your API call
    const commentData = {
        videoUrl,
        commentText,
        genderTarget,
        accountToUse,
        postToAllAccounts,
        likeSettings: {
            enabled: enableLike,
            accountCount: likeCount
        }
    };
    
    console.log('Submitting comment with data:', commentData);
    // Call your API here
});

// Handle "Post comment using all active accounts" checkbox
document.addEventListener('DOMContentLoaded', function() {
    // For manual comment form
    const manualPostAllCheckbox = document.getElementById('manual-post-all-accounts');
    const commentAccountDropdown = document.getElementById('comment-account');
    
    if (manualPostAllCheckbox && commentAccountDropdown) {
        manualPostAllCheckbox.addEventListener('change', function() {
            commentAccountDropdown.disabled = this.checked;
            
            // If checked, add "All accounts" as the selected option
            if (this.checked) {
                commentAccountDropdown.selectedIndex = 0;
                const allAccountsOption = document.createElement('option');
                allAccountsOption.value = "all";
                allAccountsOption.text = "All Active Accounts";
                allAccountsOption.selected = true;
                commentAccountDropdown.appendChild(allAccountsOption);
            } else {
                // Remove "All accounts" option if exists
                const allOption = commentAccountDropdown.querySelector('option[value="all"]');
                if (allOption) {
                    commentAccountDropdown.removeChild(allOption);
                }
            }
        });
    }
    
    // For semi-auto comment form
    const semiAutoPostAllCheckbox = document.getElementById('semi-auto-post-all-accounts');
    const semiAutoCommentAccountDropdown = document.getElementById('semi-auto-comment-account');
    
    if (semiAutoPostAllCheckbox && semiAutoCommentAccountDropdown) {
        semiAutoPostAllCheckbox.addEventListener('change', function() {
            semiAutoCommentAccountDropdown.disabled = this.checked;
            
            // If checked, add "All accounts" as the selected option
            if (this.checked) {
                semiAutoCommentAccountDropdown.selectedIndex = 0;
                const allAccountsOption = document.createElement('option');
                allAccountsOption.value = "all";
                allAccountsOption.text = "All Active Accounts";
                allAccountsOption.selected = true;
                semiAutoCommentAccountDropdown.appendChild(allAccountsOption);
            } else {
                // Remove "All accounts" option if exists
                const allOption = semiAutoCommentAccountDropdown.querySelector('option[value="all"]');
                if (allOption) {
                    semiAutoCommentAccountDropdown.removeChild(allOption);
                }
            }
        });
    }
    
    // For auto comment form
    const autoPostAllCheckbox = document.getElementById('auto-post-all-accounts');
    const autoCommentAccountDropdown = document.getElementById('auto-comment-account');
    
    if (autoPostAllCheckbox && autoCommentAccountDropdown) {
        autoPostAllCheckbox.addEventListener('change', function() {
            autoCommentAccountDropdown.disabled = this.checked;
            
            // If checked, add "All accounts" as the selected option
            if (this.checked) {
                autoCommentAccountDropdown.selectedIndex = 0;
                const allAccountsOption = document.createElement('option');
                allAccountsOption.value = "all";
                allAccountsOption.text = "All Active Accounts";
                allAccountsOption.selected = true;
                autoCommentAccountDropdown.appendChild(allAccountsOption);
            } else {
                // Remove "All accounts" option if exists
                const allOption = autoCommentAccountDropdown.querySelector('option[value="all"]');
                if (allOption) {
                    autoCommentAccountDropdown.removeChild(allOption);
                }
            }
        });
    }
});