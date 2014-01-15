var Habitat = require('habitat');

Habitat.load();


// Configuration
var env = new Habitat();

// Heroku clearbase support
if (!env.get('DB_CONNECTIONSTRING') && env.get('CLEARDB_DATABASE_URL')) {
  env.set('DB_CONNECTIONSTRING', env.get('CLEARDB_DATABASE_URL'));
}

var db = require('./models')(env.get('db'));
var app = require('./config')(env, db);

// Add routes
require('./routes')(env, app, db);

// Run server
app.listen(env.get('PORT') || 1981, function () {
  console.log('Now listening on %d', env.get('PORT') || 1981);
});
