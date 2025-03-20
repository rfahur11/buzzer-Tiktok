tiktok-automation-app/
├── package.json                    # Project configuration
├── main.js                         # Electron main process
├── preload.js                      # Secure preload script for IPC
├── auth.js                         # TikTok authentication
├── comment.js                      # Comment automation
├── like.js                         # Like automation functionality
├── captcha.js                      # Captcha handling functionality
├── data-loader.js                  # Data loading functionality
├── utils.js                        # Utility functions
├── src/
│   └── captcha/                    # Captcha handling modules
│       ├── captcha-detector.js     # Captcha detection logic
│       ├── captcha-solver.js       # Captcha solving integration
│       └── captcha-service.js      # API integration with captcha services
├── data/
│   ├── cookies/                    # Directory for saved cookies
│   ├── captcha-screenshots/        # Captcha screenshots
│   ├── user.json                   # User accounts
│   ├── settings.json               # Application settings
│   └── *.json                      # Comment data files
└── renderer/
    ├── index.html                  # Main app HTML
    ├── login.html                  # Login page
    ├── comments.html               # Comments page
    ├── likes.html                  # Likes page (NEW)
    ├── logs.html                   # Logs page
    ├── settings.html               # Settings page (NEW)
    ├── css/
    │   ├── main.css                # Main styles
    │   ├── login.css               # Login styles
    │   ├── comments.css            # Comment styles
    │   ├── likes.css               # Like styles (NEW)
    │   └── settings.css            # Settings styles (NEW)
    └── js/
        ├── renderer.js             # Main renderer script
        ├── login.js                # Login page script
        ├── comments.js             # Comments page script
        ├── likes.js                # Likes page script (NEW)
        ├── logs.js                 # Logs page script
        └── settings.js             # Settings page script (NEW)


UI masih kurang fitur headless