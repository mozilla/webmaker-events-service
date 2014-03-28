var hatchet = require('hatchet');

module.exports = function(db) {

  // Check if a user has write access to an event.
  function isAuthorized(req, eventInstance) {
    if (req.session.user && req.devAdmin || req.session.user.isAdmin || eventInstance.organizer === req.session.user.email) {
      return true;
    }
  }

  return {

    get: {
      all: function(req, res) {
        var limit = req.query.limit || 30;
        var order = req.query.order || 'beginDate';

        db.event
          .findAll({
            limit: limit,
            order: order,
            where: {
              beginDate: {
                gte: new Date()
              }
            }
          })
          .success(function(data) {
            res.json(data);
          })
          .error(function(err) {
            res.statusCode = 500;
            res.json(err);
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

      // Authentication
      if (!req.body) {
        return res.send(401, 'You may not create an empty event');
      }
      if (!req.session.user || !req.session.user.email) {
        return res.send(403, 'You must sign in with Webmaker to create an event');
      }

      db.event
        .create(req.body)
        .success(function(data) {
          hatchet.send('create_event', {
            eventId: data.getDataValue('id'),
            userId: req.session.user.id,
            user: req.session.user.username,
            email: req.session.user.email,
            sendEventCreationEmails: req.session.user.sendEventCreationEmails
          });
          res.json(data);
        })
        .error(function(err) {
          res.send(500, err);
        });
    },

    put: function(req, res) {
      var id = req.params.id;
      var updatedAttributes = req.body;

      // First, find the event
      db.event
        .find(id)
        .success(function(eventInstance) {

          // No event
          if (!eventInstance) {
            return res.send(404, 'No event found for id ' + id);
          }

          // Authentication
          if (!isAuthorized(req, eventInstance)) {
            return res.send(403, 'You are not authorized to edit this event');
          }

          eventInstance
            .updateAttributes(updatedAttributes)
            .success(function(data) {
              res.json(data);
            })
            .error(function(err) {
              res.send(500, err);
            });

        })
        .error(function(err) {
          res.send(500, err);
        });
    },

    delete: function(req, res) {
      var id = req.params.id;

      db.event
        .find(id)
        .success(function(eventInstance) {

          // No event
          if (!eventInstance) {
            return res.send(404, 'No event found for id ' + id);
          }

          // Authentication
          if (!isAuthorized(req, eventInstance)) {
            return res.send(403, 'You are not authorized to edit this event');
          }

          eventInstance
            .destroy()
            .success(function(data) {

              hatchet.send('delete_event', {
                eventId: data.getDataValue('id'),
                userId: req.session.user.id,
                email: req.session.user.email,
                sendEventCreationEmails: req.session.user.sendEventCreationEmails
              })
              res.json(data);
            })
            .error(function(err) {
              res.statusCode = 500;
              res.json(err);
            });
        })
        .error(function(err) {
          res.send(500, err);
        });
    }
  };

};
