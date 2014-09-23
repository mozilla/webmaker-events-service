try {
  require('newrelic');
} catch (newrelic_error) {
  // If newrelic is throwing an error, that means it's not properly configured
  // On local dev, you can safely ignore this error
  console.log(newrelic_error.message);
  process.env.NEW_RELIC_NO_CONFIG_FILE = 'true';
  process.env.NEW_RELIC_ENABLED = 'false';
  require('newrelic');
}

var Habitat = require('habitat');
Habitat.load();

// Configuration
var env = new Habitat();

// Heroku clearbase support
if (!env.get('DB_CONNECTIONSTRING') && env.get('cleardbDatabaseUrl')) {
  env.set('DB_CONNECTIONSTRING', env.get('cleardbDatabaseUrl').replace('?reconnect=true', ''));
}

var userClient = new(require('webmaker-user-client'))({
  endpoint: env.get('LOGIN_URL_WITH_AUTH')
});
var db = require('./models')(env.get('db'), env.get('EVENTS_FRONTEND_URL'), userClient);
var app = require('./config')(env, db, userClient);

// Run server
app.listen(env.get('PORT', 1989), function () {
  console.log('Now listening on %d', env.get('PORT', 1989));
});
