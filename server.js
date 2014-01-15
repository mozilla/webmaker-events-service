var Habitat = require('habitat');

Habitat.load();

// Configuration
var env = new Habitat();
var db = require('./models')({
  db: env.get('DB_NAME'),
  user: env.get('DB_USER'),
  password: env.get('DB_PASSWORD')
});
var app = require('./config')(env, db);

// Add routes
require('./routes')(env, app, db);

// Run server
app.listen(env.get('PORT') || 1981, function () {
  console.log('Now listening on %d', env.get('PORT') || 1981);
});
