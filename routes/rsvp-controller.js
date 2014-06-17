module.exports = function(db) {
  return {
    get: {
      event: function(req, res) {
        res.send('get:event');
      },
      user: function(req, res) {
        res.send('get:user');
      }
    },
    post: function(req, res) {
      var username = req.query.username;
      var eventID = req.query.eventid;

      // TODO : only let user rsvp themselve and not others

      // Make sure RSVP doesn't exist already and store if not.
      db.rsvp
        .find({
          where: {
            username: username,
            eventID: eventID
          }
        })
        .then(function success(result) {
          if (!result) {
            db.rsvp
              .create({
                username: username,
                eventID: eventID
              })
              .then(function() {
                res.send('Record created.');
              });
          } else {
            res.send('Record already exists.');
          }

        }, function failure(err) {
          res.json(500, err);
        });
    },
    delete: function(req, res) {
      var username = req.query.username;
      var eventID = req.query.eventid;

    }
  };
};
