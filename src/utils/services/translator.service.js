const en = require("../locales/en");
const fr = require("../locales/fr");

const languages = { en, fr };

const translateLn = (lang = "en", key) => {
  try {
    const selected = languages[lang] || languages.en;

    if (!selected[key]) {
      return languages.en[key] || "Something went wrong";
    }

    return selected[key];
  } catch (err) {
    return "Something went wrong";
  }
};

const formatTranslatedActivity = (activity, ln) => {
  if (!activity) return "";

  if (activity === "Logged in successfully") {
    return translateLn(ln, "Logged in successfully");
  }

  if (activity.startsWith("Created a new Admin with username:")) {
    const username = activity.split("username:")[1].trim();

    return `${translateLn(ln, "CREATED_ADMIN_USERNAME")} ${username}`;
  }

  if (activity.startsWith("Created a new SubAdmin with username:")) {
    const username = activity.split("username:")[1].trim();

    return `${translateLn(ln, "CREATED_SUBADMIN_USERNAME")} ${username}`;
  }

  return activity; // fallback raw log
};

module.exports = { translateLn, formatTranslatedActivity };
