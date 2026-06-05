const Settings = require('../models/Settings');

// Middleware factory — checks a boolean field on Settings document.
// Usage: checkSettings('registrationEnabled')
function checkSettings(field) {
  return async (req, res, next) => {
    try {
      const settings = await Settings.findOne({});
      if (settings && settings[field] === false) {
        return res.status(403).json({ error: `Feature disabled: ${field}` });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = checkSettings;
