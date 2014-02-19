module.exports = function(db) {

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
      if (!req.session.email) {
        return res.send(403, 'You must authorize this event with a persona-verified email');
      }

      db.event
        .create(req.body)
        .success(function(data) {
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

          if (eventInstance) {
            // Authentication
            if (!req.devAdmin || !req.session.user.admin || !eventInstance.organizer === req.session.email) {
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
          } else {
            res.statusCode = 404;
            return res.json({
              error: 'No event found for id ' + id
            });
          }
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
          if (eventInstance) {
            // Authentication
            if (!req.devAdmin || !req.session.user.admin || !eventInstance.organizer === req.session.email) {
              return res.send(403, 'You are not authorized to edit this event');
            }
            eventInstance
              .destroy()
              .success(function(data) {
                res.json(data);
              })
              .error(function(err) {
                res.statusCode = 500;
                res.json(err);
              });
          } else {
            return res.send(404, 'No event found for id ' + id);
          }
        })
        .error(function(err) {
          res.send(500, err);
        });
    }
  };

};
