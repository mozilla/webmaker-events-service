module.exports = function(db) {

  var Faker = require('../util/faker');
  var faker = new Faker();

  return {
    healthcheck: function(env) {
      return function (req, res) {
        res.send({
          version: require('../package').version,
          'LOGIN_URL': env.get('LOGIN_URL'),
          'ALLOWED_DOMAINS': env.get('ALLOWED_DOMAINS'),
          'COOKIE_DOMAIN': env.get('COOKIE_DOMAIN')
        });
      };
    },

    // Use with caution
    fake: function(req, res, next) {

      if (req.query.amount) {

        var fakeEvents = faker.events(+req.query.amount);

        db.event
          .bulkCreate(fakeEvents)
          .success(function(data) {
            res.json(data);
          })
          .error(function(err) {
            res.statusCode = 500;
            res.json(err);
          });

      } else {

        var fakeEvent = faker.event();

        db.event
          .create(fakeEvent)
          .success(function(data) {
            res.json(data);
          })
          .error(function(err) {
            res.statusCode = 500;
            res.json(err);
          });
      }
    }
  };

};
