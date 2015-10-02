module.exports = function (db) {
  var Faker = require('../util/faker');
  var faker = new Faker();

  return {
    healthcheck: function (env) {
      var info = {
        http: 'okay',
        version: require('../package').version,
        'ALLOWED_DOMAINS': env.get('ALLOWED_DOMAINS'),
        'COOKIE_DOMAIN': env.get('COOKIE_DOMAIN')
      };
      return function (req, res) {
        res.json(info);
      };
    },

    fakeSession: function (req, res) {
      req.session = faker.session(req.query.isAdmin, req.query.isSuperMentor, req.query.isMentor);
      res.send(200);
    },

    // Use with caution
    fake: function (req, res, next) {
      if (req.query.amount) {
        var fakeEvents = faker.events(+req.query.amount);
        db.event
          .bulkCreate(fakeEvents)
          .success(function (data) {
            res.json(data);
          })
          .error(function (err) {
            res.statusCode = 500;
            res.json(err);
          });
      } else {
        var fakeEvent = faker.event();
        db.event
          .create(fakeEvent)
          .success(function (data) {
            res.json(data);
          })
          .error(function (err) {
            res.statusCode = 500;
            res.json(err);
          });
      }
    }
  };
};
