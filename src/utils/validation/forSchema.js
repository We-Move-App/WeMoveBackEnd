const mongoose = require("mongoose");
const { Schema } = mongoose;

// Validation for full name
function validateFullName(fullName) {
  const regex = /^[a-zA-Z\s]+$/; // Allows only alphabets and spaces
  return regex.test(fullName);
}

function validateIfscCode() {
  const regex = [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Please provide a valid IFSC code"]
  return regex
}

// Validation for email
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Basic email regex
  return regex.test(email);
}

// Validation for phone number
function validatePhoneNumber(phoneNumber) {
  const regex = /^\+?[1-9]\d{8,14}$/;
  return regex.test(phoneNumber);
}

function securePinValidator(pin) {
  const regex = /^\d{4}$/;
  return regex.test(pin);
}

const validateDOB = (dob) => {
  if (!dob) return { isValid: false, message: "Date of Birth is required" };

  const today = new Date();
  const birthDate = new Date(dob);

  if (isNaN(birthDate.getTime())) {
    return { isValid: false, message: "Invalid date format" };
  }

  const age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  const isOldEnough = age > 18 || (age === 18 && hasBirthdayPassed);

  return isOldEnough
    ? { isValid: true }
    : { isValid: false, message: "User must be at least 18 years old" };
};

const validateDOBForUser = (dob) => {
  if (!dob) return { isValid: false, message: "Date of Birth is required" };

  const birthDate = new Date(dob);

  if (isNaN(birthDate.getTime())) {
    return { isValid: false, message: "Invalid date format" };
  }

  return { isValid: true };
};

const ImageSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, auto: true },
    public_id: { type: String },
    url: { type: String, required: true },
    fileName: { type: String },
    fileType: { type: String },
  },
  { _id: false }
);

module.exports = {
  validateFullName,
  validateEmail,
  validatePhoneNumber,
  securePinValidator,
  validateDOB,
  validateDOBForUser,
  ImageSchema,
  validateIfscCode
};
