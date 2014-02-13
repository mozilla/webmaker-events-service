module.exports = function(env, app, models, login) {

  var db = require('./dbController')(models);
  var dev = require('./devController')(models);
  var auth = require('./auth')(env);

  app.get('/', function(req, res) {
    res.send('Webmaker Events Service is up and running');
  });

  app.get('/events', db.get.all);
  app.get('/events/:id', db.get.id);

  // Protected routes
  app.post('/events', auth.verifyUser, db.post);
  app.put('/events/:id', auth.verifyUser, db.put);
  app.delete('/events/:id', auth.verifyUser, db.delete);

  // Login
  app.post('/verify', login.handlers.verify);
  app.post('/authenticate', login.handlers.authenticate);
  app.post('/create', login.handlers.create);
  app.post('/logout', login.handlers.logout);
  app.post('/check-username', login.handlers.exists);

  // CAUTION: Use with 'dev' db only
  app.get('/dev/fake', auth.dev, dev.fake);

};
