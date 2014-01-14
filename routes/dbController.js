module.exports = function(db) {

  var eden = require('node-eden');
  var faker = require('Faker');

  return {

    // Use with caution
    dev: {
      fake: function(req, res, next) {

        var fakeEvent = {
          title: faker.Company.bs(),
          description: faker.Lorem.paragraph(),
          address: faker.Address.streetAddress(),
          latitude: faker.Helpers.randomNumber(-90.0, 90.0),
          longitude: faker.Helpers.randomNumber(-180.0, 180.0),
          city: faker.Address.city(),
          beginDate: new Date(),
          country: faker.Name.firstName() + 'land',
          attendees: faker.Helpers.randomNumber(500),
          registerLink: 'https://' + faker.Internet.domainName() + '/eventpage',
          organizer: faker.Internet.email(),
          organizerId: faker.Name.firstName() + faker.Helpers.randomNumber(100),
          featured: false
        };

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
    },

    get: {
      all: function(req, res, next) {
        var limit = req.query.limit || 30;

        db.event
          .findAll({
            limit: limit
          })
          .success(function(data) {
            res.json(data);
          })
          .error(function(err) {
            res.statusCode = 500;
            next(new Error('There was a problem finding all events.'));
          });
      },
      id: function(req, res) {

        db.event
          .find(req.params.id)
          .success(function(data) {
            res.json(data);
          });

      }
    },

    post: function(req, res) {
      db.event
        .create(req.body)
        .save()
        .success(function(data) {
          res.json(data);
        })
        .error(function(err) {
          res.statusCode = 500;
          next(new Error('There was a problem creating the event.'));
        });
    },
    put: function(req, res) {
      var id = req.params.id;
      res.json({
        response: 'put'
      });
    },
    delete: function(req, res) {
      var id = req.params.id;
      res.json({
        response: 'deleted'
      });
    }
  };

};
