module.exports = function(env) {
  return {

    // Use this CORS middleware for any protected routes that need credentials (cookies)
    withAuth: function(req, res, next) {
      res.header('Access-Control-Allow-Origin', env.get('ALLOWED_DOMAINS'));
      res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
      res.header('Access-Control-Allow-Credentials', true);
      next();
    },

    // Use this CORS middleware for any read-only routes that need CORS
    readOnly: function(req, res, next) {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
      next();
    }

  };

};
