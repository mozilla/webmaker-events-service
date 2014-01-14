module.exports = function(db) {

  var eden = require('node-eden');
  var faker = require('Faker');

  return {

    // Use with caution
    dev: {
      fake: function(req, res) {
        res.json({
          title: faker.Company.bs(),
          description: faker.Lorem.paragraph(),
          address: faker.Address.streetAddress(),
          latitude: faker.Address.latitutde,
          longitude: faker.Address.longitude,
          city: faker.Address.city(),
          beginDate: new Date(),
          country: faker.Name.firstName() + 'land',
          attendees: faker.Helpers.randomNumber(500),
          registerLink: 'https://' + faker.Internet.domainName() + '/eventpage',
          organizer: faker.Internet.email(),
          organizerId: faker.Name.firstName() + faker.Helpers.randomNumber(100),
          featured: false
        });
      }
    },

    get: {
      all: function(req, res, next) {
        var limit = req.query.limit || 30;

        db.event
          .findAll()
          .limit(limit)
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
