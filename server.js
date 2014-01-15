var Habitat = require('habitat');

// Configuration
var env = Habitat.load();
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
