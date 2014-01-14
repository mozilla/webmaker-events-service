var express = require('express');
var Habitat = require('habitat');
var routes = require('./routes');

Habitat.load();

var app = express();
var env = new Habitat();
var db = require('./models')(
  env.get('DB_NAME'),
  env.get('DB_USER'),
  env.get('DB_PASSWORD')
);

app.use(express.logger('dev'));
app.use(express.compress());
app.use(express.json());
app.use(express.urlencoded());

app.use(app.router);


routes(app, db);

app.listen(env.get('PORT'), function () {
  console.log('Now listening on %d', env.get('PORT'));
});
