module.exports = function(env) {

  var jwt = require('jsonwebtoken');
  var verify = require('browserid-verify')();
  var jwtAuth = require('express-jwt');

  return {

    // Protect dev-only routes
    dev: function (req, res, next) {
      if (!env.get('dev')) {
        return res.send(404, 'Nothing here.');
      }
      next();
    },

    // Issue tokens based on persona credentials
    token: function(req, res) {

      var audience = req.body.audience;
      var assertion = req.body.assertion;

      if (!audience || !assertion) {
        return res.send(401, 'Malformed request, you must include both audience and assertion.');
      }

      verify(assertion, audience, function(err, email, response) {
        if (err) {
          return res.send(401, 'Error verifying persona: ' + err);
        }

        // TODO: Add admin properly
        var userProfile = {
          email: email,
          admin: env.get('dev')
        };

        var token = jwt.sign(userProfile, env.get('secret'), {
          expiresInMinutes: 60 * 5
        });

        res.json({
          token: token,
          email: email
        });

      });

    },

    // Middleware for verifying tokens
    verify: jwtAuth({secret: env.get('secret')})

  };

};
