module.exports = function (env, app, models, login) {

  var db = require('./dbController')(models);
  var dev = require('./devController')(models);
  var auth = require('./auth')(env);
  var cors = require('./cors')(env);

  // Healthcheck
  app.get('/', function (req, res) {
    res.send('Webmaker Events Service is up and running');
  });
  app.get('/healthcheck', dev.healthcheck(env));

  app.get('/events', cors.withAuth, db.get.all);
  app.get('/events/:id', cors.withAuth, db.get.id);
  app.get('/tag', cors.readOnly, db.tag.get);

  // Protected routes
  app.post('/events', cors.withAuth, auth.verifyUser, db.post);
  app.put('/events/:id', cors.withAuth, auth.verifyUser, db.put);
  app.delete('/events/:id', cors.withAuth, auth.verifyUser, db.delete);
  app.post('/tag', cors.withAuth, db.tag.post);

  // Login
  app.options('*', cors.withAuth);

  // CAUTION: Use with 'dev' db only
  app.get('/dev/fake', cors.readOnly, auth.dev, dev.fake);

};
