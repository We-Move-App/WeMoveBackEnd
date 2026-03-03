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

module.exports = { translateLn };
