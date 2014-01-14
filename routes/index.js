module.exports = function(app, db) {
  var db = require('./dbController')(db);

  app.get('/events', db.get.all);
  app.get('/events/:id', db.get.id);
  app.post('/event', db.post);
  app.put('/event/:id', db.put);
  app.delete('/event/:id', db.delete);

};
