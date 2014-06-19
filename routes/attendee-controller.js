var Promise = require('bluebird');

module.exports = function(db) {
  return {
    rsvp: {
      // TODO: Add usernames and avatars to attendee data
      get: {
        // /rsvp/event/:id
        event: function(req, res) {
          var eventID = parseInt(req.params.id, 10);

          // Grab attendee info if it's public, requesting user is admin, or user created event

          db.event
            .find({
              where: {
                id: eventID
              }
            })
            .then(function success(event) {
              var user = req.session.user;

              if (!event) {
                res.send(404);
              }

              if (event.areAttendeesPublic ||
                (user && (user.isAdmin || user.username === event.organizerId))) {
                return db.attendee.findAll({
                  where: {
                    eventID: eventID
                  }
                });
              } else {
                res.send(401);
              }
            }, function fail() {
              res.send(500);
            })
            .then(function success(attendees) {
              res.json(attendees);
            }, function fail() {
              res.send(500);
            });

        },
        // /rsvp/user/:id
        user: function(req, res) {
          var userID = parseInt(req.params.id, 10);

          if (req.session.user && req.session.user.id === userID) {
            db.attendee
              .findAll({
                where: {
                  userID: userID
                }
              })
              .then(function success(result) {
                res.json(result);
              }, function failure(err) {
                res.send(500);
              });

          } else {
            res.send(401, 'Not authorized.');
          }
        }
      },
      // /rsvp/?userid=USERNAME&eventid=EVENTID
      post: function(req, res) {
        var userID = parseInt(req.query.userid, 10);
        var eventID = parseInt(req.query.eventid, 10);

        // Ensure user is authorized to RSVP
        if (req.session.user && req.session.user.id === userID) {

          // Make sure the event exists first
          db.event
            .find({
              where: {
                id: eventID
              }
            })
            .then(function success(event) {
              if (!event) {
                res.send(404, 'Event not found');
              } else {
                return db.attendee
                  .find({
                    where: {
                      userID: userID,
                      eventID: eventID
                    }
                  });
              }
            }, function fail() {
              res.send(500);
            })
            .then(function success(result) {
              // Make sure RSVP doesn't exist already and store if not.
              if (!result) {
                db.attendee
                  .create({
                    userID: userID,
                    eventID: eventID,
                    didRSVP: true
                  })
                  .then(function() {
                    res.send('Record created. User RSVP\'d.');
                  });
              } else {
                result.updateAttributes({
                  didRSVP: true
                });
                res.send('Record already exists. Updating RSVP to true.');
              }

            }, function failure(err) {
              res.send(500, 'Error.');
            });
        } else {
          res.send(401, 'Not authorized.');
        }

      },
      // /rsvp/?user=USERNAME&event=EVENTID
      delete: function(req, res) {
        var userID = parseInt(req.query.userid, 10);
        var eventID = parseInt(req.query.eventid, 10);

        // Ensure user is authorized to delete their RSVP
        if (req.session.user && req.session.user.id === userID) {
          db.attendee
            .find({
              where: {
                userID: userID,
                eventID: eventID
              }
            })
            .then(function success(result) {
              if (result) {
                result.updateAttributes({
                  didRSVP: false
                });
                res.send('Un-RSVP\'d user.');
              } else {
                res.send('Record doesn\'t exist.');
              }
            }, function failure(err) {
              res.send(500);
            });
        } else {
          res.send(401, 'Not authorized.');
        }

      }
    }
  };
};
