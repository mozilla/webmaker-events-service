if (process.env.NEW_RELIC_ENABLED) {
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

var db = require('./models')(env.get('db'));
var app = require('./config')(env, db);

// Run server
app.listen(env.get('PORT', 1989), function () {
  console.log('Now listening on %d', env.get('PORT', 1989));
});
