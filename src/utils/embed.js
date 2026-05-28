const config = require('../config');

function requestFooter(username) {
  return {
    text: `${config.defaultFooter} | Requested by ${username}`
  };
}

module.exports = {
  requestFooter
};