// const rateLimit = require("express-rate-limit");
// const rateLimitConfig = require("../config/rateLiimitConfig"); 

// const ratelimiter = rateLimit({
//   windowMs: rateLimitConfig.windowMs,
//   max: rateLimitConfig.max, 
//     message: "Too many requests, please try again later.", 
// });

const OTP_LIMIT = 3; // Max OTP attempts
const BLOCK_DURATION = 60 * 60; // 1 hour in seconds


  // ===============|| CHECK OTP LIMIT ||======================
  async function checkOtpLimit(userEmail) {
    const key = `otp_attempts:${userEmail}`;
  
    // Get OTP attempts
    const attempts = await redis.get(key);
  
    if (attempts && parseInt(attempts) >= OTP_LIMIT) {
      return { blocked: true, message: "Too many OTP attempts. Try again in 1 hour." };
    }
  
    return { blocked: false };
  }
  
  // ===============|| INCREASE OTP LIMIT ||======================
  async function increaseOtpCount(userEmail) {
    const key = `otp_attempts:${userEmail}`;
  
    const attempts = await redis.incr(key); // Increase count
  
    if (attempts === 1) {
      await redis.expire(key, BLOCK_DURATION); // Set expiration on first attempt
    }
  }
  
  async function resetOtpCount(userEmail) {
    const key = `otp_attempts:${userEmail}`;
    await redis.del(key); // Reset attempts manually if needed
  }
  

// module.exports = {ratelimiter};
