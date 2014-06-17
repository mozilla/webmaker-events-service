module.exports = function (env, app, models, login) {

  var events = require('./event-controller')(models);
  var dev = require('./dev-controller')(models);
  var rsvp = require('./rsvp-controller.js')(models);
  var auth = require('./auth')(env);
  var cors = require('./cors')(env);

  // Healthcheck
  app.get('/', function (req, res) {
    res.send('Webmaker Events Service is up and running');
  });
  app.get('/healthcheck', dev.healthcheck(env));

  app.get('/events', cors.withAuth, events.get.all);
  app.get('/events/:id', cors.withAuth, events.get.id);

  // Protected routes
  app.post('/events', cors.withAuth, auth.verifyUser, events.post);
  app.put('/events/:id', cors.withAuth, auth.verifyUser, events.put);
  app.delete('/events/:id', cors.withAuth, auth.verifyUser, events.delete);

  // RSVP

  app.get('/rsvp/event/:id', cors.withAuth, rsvp.get.event);
  app.get('/rsvp/user/:id', cors.withAuth, rsvp.get.user);
  app.post('/rsvp', cors.withAuth, rsvp.post);

  // Login
  app.options('*', cors.withAuth);

  // CAUTION: Use with 'dev' db only
  app.get('/dev/fake', cors.readOnly, auth.dev, dev.fake);

};
