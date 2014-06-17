var Promise = require('bluebird');

module.exports = function(db) {
  return {
    rsvp: {
      // TODO: Add usernames and avatars to attendee data
      get: {
        // /rsvp/event/:id
        event: function(req, res) {
          var eventID = parseInt(req.params.id, 10);

          function getEvent(id) {
            return new Promise(function(resolve, reject) {
              db.event
                .find({
                  where: {
                    id: id
                  }
                })
                .then(function success(result) {
                  if (result) {
                    resolve.call(null, result);
                  } else {
                    reject.call(null);
                  }
                }, function failure(err) {
                  reject.call(null);
                });
            });
          }

          function getAttendanceInfo(eventID) {
            return new Promise(function(resolve, reject) {
              db.attendee
                .findAll({
                  where: {
                    eventID: eventID
                  }
                })
                .then(function success(result) {
                  if (result) {
                    resolve.call(null, result);
                  } else {
                    reject.call(null);
                  }
                }, function failure(err) {
                  reject.call(null);
                });
            });
          }

          // Grab attendee info if it's public, user is admin, or user created event
          getEvent(eventID)
            .then(function success(event) {
              var user = req.session.user;

              if (event.areAttendeesPublic ||
                (user && (user.isAdmin || user.username === event.organizerId))) {
                return getAttendanceInfo(eventID);
              } else {
                res.send(401);
              }
            }, function fail() {
              res.send(404);
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
          // Make sure RSVP doesn't exist already and store if not.
          db.attendee
            .find({
              where: {
                userID: userID,
                eventID: eventID
              }
            })
            .then(function success(result) {
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
                res.send('Record already exists.');
              }

            }, function failure(err) {
              res.send(500);
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
                result
                  .destroy()
                  .success(function(data) {
                    res.send('Record deleted');
                  })
                  .error(function(error) {
                    res.json(500, err);
                  });
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
