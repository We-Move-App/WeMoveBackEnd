const generateOtpEmailTemplate = (otp, name = "User") => {
  const subject = "Your OTP Code";

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Hello ${name},</h2>
      <p>Your One-Time Password (OTP) is:</p>
      <h1 style="letter-spacing: 5px; color: #2E86C1;">${otp}</h1>
      <p>This OTP is valid for <strong>5 minutes</strong>.</p>
      <p>If you did not request this, please ignore this email.</p>
      <br/>
      <p>Regards,<br/><strong>${process.env.EMAIL_SENDER_NAME}</strong></p>
    </div>
  `;

  const textContent = `Hello ${name}, your OTP is ${otp}. It is valid for 5 minutes.`;

  return { subject, htmlContent, textContent };
};

module.exports = { generateOtpEmailTemplate };
