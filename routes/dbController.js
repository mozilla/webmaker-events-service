module.exports = function(db) {

  return {

    get: {
      all: function(req, res) {
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
      db.event
        .create(req.body)
        .success(function(data) {
          res.json(data);
        })
        .error(function(err) {
          res.statusCode = 500;
          res.json(err);
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
            eventInstance
              .updateAttributes(updatedAttributes)
              .success(function(data) {
                res.json(data);
              })
              .error(function(err) {
                res.statusCode = 500;
                res.json(err);
              });
          } else {
            res.statusCode = 404;
            return res.json({
              error: 'No event found for id ' + id
            });
          }
        })
        .error(function(err) {
          res.statusCode = 500;
          res.json(err);
        });
    },

    delete: function(req, res) {
      var id = req.params.id;

      db.event
        .find(id)
        .success(function(eventInstance) {
          if (eventInstance) {
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
            res.statusCode = 404;
            return res.json({
              error: 'No event found for id ' + id
            });
          }
        })
        .error(function(err) {
          res.statusCode = 500;
          res.json(err);
        });
    }
  };

};
