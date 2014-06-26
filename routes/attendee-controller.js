var Promise = require('bluebird');

module.exports = function(db, userClient) {
  return {
    rsvp: {
      get: {
        // /rsvp/event/:id
        event: function(req, res) {
          var eventID = parseInt(req.params.id, 10);
          var eventData;
          var coorganizers = [];
          var user = req.session.user;

          // Grab attendee info if it's public, requesting user is admin/coorg, or user created event

          db.event.find({
            where: {
              id: eventID
            },
            include: [ db.coorg, db.attendee ]
          })
          .then(function success (event) {
            if (!event) {
              res.send(404);
            } else {
              eventData = event.dataValues;
            }

            eventData.coorganizers.forEach(function (coorg, index) {
              coorganizers.push(coorg.dataValues.userId);
            });

            if (eventData.areAttendeesPublic ||
              (user && (user.isAdmin || user.username === eventData.organizerId || coorganizers.indexOf(user.id) > -1))) {

              var userIDs = [];
              var userHash = {};

              eventData.attendees.forEach(function (attendee) {
                userIDs.push(attendee.userID);
                userHash[attendee.userID] = attendee.dataValues;
              });

              // Get usernames and avatars from user IDs

              userClient.get.byIds(userIDs, function (err, users) {
                if (err) {
                  res.send(500, 'Login service is down.');
                } else {
                  users.users.forEach(function (user) {
                    userHash[user.id].username = user.username;
                    userHash[user.id].avatar = user.avatar;
                  });

                  var userArray = [];

                  for (var key in userHash) {
                    userArray.push(userHash[key]);
                  }

                  res.json(userArray);
                }
              });
            } else {
              res.send(401);
            }
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
