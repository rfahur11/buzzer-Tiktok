/**
 * CAPTCHA Handlers Module
 * 
 * Exports specialized handlers for different types of CAPTCHAs
 */

// Import individual CAPTCHA type handlers
const { handlePuzzleCaptcha } = require('./puzzle');
const { handleRotateCaptcha } = require('./rotate');
const { handleShapesCaptcha } = require('./shapes');

/**
 * Export all CAPTCHA type handlers 
 * 
 * These handlers are specialized functions for solving specific types of CAPTCHAs
 * that TikTok might present during automation.
 * 
 * Each handler takes a Puppeteer page object and returns a Promise<boolean>
 * indicating whether the CAPTCHA was successfully solved.
 */
module.exports = {
  handlePuzzleCaptcha,
  handleRotateCaptcha,
  handleShapesCaptcha
};