module.exports = function (env, app, models, login) {

  var events = require('./event-controller')(models);
  var dev = require('./dev-controller')(models);
  var attendee = require('./attendee-controller.js')(models);
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
  app.get('/rsvp/event/:id', cors.withAuth, attendee.rsvp.get.event);
  app.get('/rsvp/user/:id', cors.withAuth, auth.verifyUser, attendee.rsvp.get.user);
  app.post('/rsvp', cors.withAuth, auth.verifyUser, attendee.rsvp.post);
  app.delete('/rsvp', cors.withAuth, auth.verifyUser, attendee.rsvp.delete);

  // Login
  app.options('*', cors.withAuth);

  // CAUTION: Use with 'dev' db only
  app.get('/dev/fake', cors.readOnly, auth.dev, dev.fake);

};
