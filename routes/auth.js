module.exports = function (env) {

  return {

    // Protect dev-only routes
    dev: function (req, res, next) {
      if (!env.get('dev')) {
        return res.send(404, 'Nothing here.');
      }
      next();
    },

    // Verify that a valid cookie is set
    verifyUser: function (req, res, next) {
      if (!req.session.user || !req.session.user.username) {
        return res.send(401, 'No valid user session was set.');
      }
      next();
    },

    // Verify that a user is an administrator
    verifyAdmin: function (req, res, next) {
      if (!req.session.user || !req.session.user.isAdmin) {
        return res.send(401, 'User isn\'t an admin.');
      }
      next();
    }

  };

};
