module.exports = function(app, db) {
  var db = require('./dbController')(db);

  app.get('/events', db.get.all);
  app.get('/events/:id', db.get.id);
  app.post('/events', db.post);
  app.put('/events/:id', db.put);
  app.delete('/events/:id', db.delete);

  // Take this out later
  app.get('/dev/fake', db.dev.fake);

};
