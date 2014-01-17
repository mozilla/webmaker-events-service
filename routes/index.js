module.exports = function(env, app, models) {

  var db = require('./dbController')(models);
  var dev = require('./devController')(models);
  var auth = require('./auth')(env);

  app.post('/auth', auth.token);

  app.get('/events', db.get.all);
  app.get('/events/:id', db.get.id);

  // Protected routes
  app.post('/events', auth.verify, db.post);
  app.put('/events/:id', auth.verify, db.put);
  app.delete('/events/:id', auth.verify, db.delete);

  // CAUTION: Use with 'dev' db only
  app.get('/dev/fake', auth.dev, dev.fake);

};
