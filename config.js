module.exports = function (env, db, userClient) {
  var express = require('express');
  var messina = require('messina')('webmaker-events-service-' + env.get('NODE_ENV'));
  var WebmakerAuth = require('webmaker-auth');
  var routes = require('./routes');

  // Check required config
  if (!env.get('LOGIN_URL')) {
    console.log('You need to specify LOGIN_URL (The location of the Webmaker login server, e.g. http://localhost:3000) in your .env');
  }
  if (!env.get('ALLOWED_DOMAINS')) {
    console.log('You need to specify ALLOWED_DOMAINS (The location of the webmaker-events front-end server, e.g. http://localhost:1981) in your .env');
  }

  var app = express();
  var auth = new WebmakerAuth({
    loginURL: env.get('LOGIN_URL'),
    authLoginURL: env.get('LOGIN_URL_WITH_AUTH'),
    secretKey: env.get('SESSION_SECRET'),
    forceSSL: env.get('FORCE_SSL'),
    domain: env.get('COOKIE_DOMAIN')
  });

  if (env.get('ENABLE_GELF_LOGS')) {
    messina.init();
    app.use(messina.middleware());
  } else {
    app.use(express.logger('dev'));
  }
  app.use(express.compress());
  app.use(express.json());
  app.use(express.urlencoded());

  app.use(auth.cookieParser());
  app.use(auth.cookieSession());

  // Dev flag sets admin to true
  app.use(function (req, res, next) {
    if (env.get('dev')) {
      req.admin = true;
    }
    next();
  });

  app.use(app.router);

  // Add routes
  routes(env, app, db, userClient);

  return app;
};
