module.exports = function(env, app, models) {

  var db = require('./dbController')(models);
  var dev = require('./devController')(models);

  // Middleware to block dev routes
  function checkDev(req, res, next) {
    if (!env.get('dev')) {
      res.statusCode = 404;
      return res.send();
    }
    next();
  }

  app.get('/events', db.get.all);
  app.get('/events/:id', db.get.id);
  app.post('/events', db.post);
  app.put('/events/:id', db.put);
  app.delete('/events/:id', db.delete);

  // USE WITH CAUTION
  app.get('/dev/fake', checkDev, dev.fake);

};
