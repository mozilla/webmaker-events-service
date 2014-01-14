module.exports = function(db) {

  var eden = require('node-eden');

  return {

    // Use with caution
    dev: {
      fake: function(req, res) {
        db.event
          .create({
            title: eden.word() + ' ' + eden.word() + ' ' + eden.word(),
            description: 'lorem ipsum dolor sit amet',
            address: Math.floor(Math.random() * 500) + eden.word() + ' st.',
            city: eden.word() + 'ville',
            country: eden.word() + 'land',
            attendees: Math.floor(Math.random() * 100),
            registerLink: 'http://webmaker.org',
            organizer: eden.eve() + '@' + eden.word() + '.com',
            organizerId: eden.eve() + Math.floor(Math.random() * 100),
            featured: false
          })
          .save()
          .success(function(data) {
            res.json(data);
          })
          .error(function(err) {
            res.statusCode = 500;
            next(new Error('There was a problem finding all events.'));
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
      console.log(req.body);
      res.send('post');
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
