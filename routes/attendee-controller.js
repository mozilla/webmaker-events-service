module.exports = function (db, userClient) {
  return {
    get: {
      // /attendee/event/:id
      event: function (req, res) {
        var eventID = parseInt(req.params.id, 10);
        var eventData;
        var coorganizers = [];
        var user = req.session.user;

        // Grab attendee info if it's public, requesting user is admin/coorg, or user created event

        db.event.find({
          where: {
            id: eventID
          },
          include: [db.coorg, db.attendee]
        })
          .then(function success(event) {
            if (!event) {
              res.send(404);
            } else {
              eventData = event.dataValues;
            }

            eventData.coorganizers.forEach(function (coorg, index) {
              coorganizers.push(coorg.dataValues.userId);
            });

            var isAuthorizedConsumer = (user && (user.isAdmin || user.id === eventData.organizerId || coorganizers.indexOf(user.id) > -1));

            if (eventData.areAttendeesPublic || isAuthorizedConsumer) {

              var userIDs = [];
              var userHash = {};
              var unregisteredUsers = [];

              eventData.attendees.forEach(function (attendee) {
                if (attendee.userID) {
                  userIDs.push(attendee.userID);
                  userHash[attendee.userID] = attendee.dataValues;
                } else {
                  unregisteredUsers.push(attendee);
                }
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

                  userArray = userArray.concat(unregisteredUsers);

                  // Remove emails from public attendee lists
                  if (!isAuthorizedConsumer) {
                    userArray.forEach(function (user) {
                      if (user.dataValues) {
                        delete user.dataValues.email;
                      } else {
                        delete user.email;
                      }
                    });
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
      // /attendee/user/:id
      user: function (req, res) {
        var userID = parseInt(req.params.id, 10);

        if (req.session.user && (req.session.user.isAdmin || req.session.user.id === userID)) {
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
    // /attendee/?userid=USERNAME&eventid=EVENTID&checkin=true&rsvp=false
    post: function (req, res) {
      // Like parseInt, but...for boolean-like strings
      function parseBool(boolean) {
        return boolean === 'true' || boolean === '1';
      }

      var userID = parseInt(req.query.userid, 10);
      var eventID = parseInt(req.query.eventid, 10);
      var email = req.query.email;
      var didAttend = req.query.checkin ? parseBool(req.query.checkin) : undefined;
      var didRSVP = req.query.rsvp ? parseBool(req.query.rsvp) : undefined;
      var isPrivate = req.query.isPrivate ? parseBool(req.query.isPrivate) : undefined;

      var eventData;

      if (!((userID || email) && eventID)) {
        res.send(500, 'eventid must be specified and accompanied by a userid or email.');
      }

      db.event.find({
        where: {
          id: eventID
        }
      })
        .then(function success(event) {
          if (!event) {
            res.send(404);
          }

          eventData = event.dataValues;

          if (req.session.user && (req.session.user.isAdmin || req.session.user.id === userID || req.session.user.id === eventData.organizerId)) {
            // Make sure the event exists first
            db.event
              .find({
                where: {
                  id: eventID
                }
              })
              .then(function success(event) {
                eventData = event;

                if (!event) {
                  res.send(404, 'Event not found');
                } else {
                  var record = {
                    eventID: eventID
                  };

                  if (userID) {
                    record.userID = userID;
                  } else if (email) {
                    record.email = email;
                  }

                  return db.attendee
                    .find({
                      where: record
                    });
                }
              }, function fail() {
                res.send(500);
              })
              .then(function success(result) {
                // Break out if the event doesn't exist
                if (!eventData) {
                  return;
                }

                // Make sure RSVP doesn't exist already and store if not.

                var record = {
                  eventID: eventID
                };

                if (userID) {
                  record.userID = userID;
                } else if (email) {
                  record.email = email;
                }

                if (typeof didAttend === 'boolean') {
                  record.didAttend = didAttend;
                }

                if (typeof didRSVP === 'boolean') {
                  record.didRSVP = didRSVP;
                }

                if (typeof isPrivate === 'boolean') {
                  record.isPrivate = isPrivate;
                }

                if (!result) {
                  db.attendee
                    .create(record)
                    .then(function () {
                      res.send('Record created.');
                    });
                } else {
                  result.updateAttributes(record);

                  res.send('Record already exists. Updating.');
                }

              }, function failure(err) {
                res.send(500, 'Error.');
              });

          } else {
            res.send(401);
          }
        }, function fail() {
          res.send(500);
        });

    }
  };
};
