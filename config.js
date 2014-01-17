module.exports = function(env, db) {
  var express = require('express');
  var app = express();

  app.use(express.logger('dev'));
  app.use(express.compress());
  app.use(express.json());
  app.use(express.urlencoded());

  // TODO: Don't allow all origins
  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  // Dev flag sets admin to true
  app.use(function(req, res, next) {
    if(env.get('dev')) {
      req.admin = true;
    }
    next();
  });

  app.use(app.router);

  return app;
};
