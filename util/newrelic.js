/**
 * Only really load newrelic if the
 */
var newrelic;

if (!process.env.WITHOUT_NEW_RELIC) {
  newrelic = require('newrelic');
} else {
  console.log('Running without New Relic hooks');
  newrelic = {
    addCustomParameter: function () {
      // no need to do anything
    }
  };
}

module.exports = newrelic;
