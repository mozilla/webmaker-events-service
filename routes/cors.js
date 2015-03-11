module.exports = function (env) {
  var allowedDomains = env.get('ALLOWED_DOMAINS').split(' ');

  var allowHeaders = 'Content-Type, Authorization, X-CSRF-Token, Accept-Ranges, Range-Unit, Content-Range, Range';
  var exposeHeaders = 'Content-Type, Accept-Ranges, Range-Unit, Content-Range';

  return {
    // Use this CORS middleware for any protected routes that need credentials (cookies)
    withAuth: function (req, res, next) {
      // Only 1 domain can be served up with Allow-Origin, so we'll use the incoming one if allowed
      if (allowedDomains.indexOf(req.headers.origin) > -1) {
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE');
        res.header('Access-Control-Allow-Headers', allowHeaders);
        res.header('Access-Control-Expose-Headers', exposeHeaders);
        res.header('Access-Control-Allow-Credentials', true);
      }

      next();
    },

    // Use this CORS middleware for any read-only routes that need CORS
    readOnly: function (req, res, next) {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      res.header('Access-Control-Allow-Headers', allowHeaders);
      res.header('Access-Control-Expose-Headers', exposeHeaders);
      next();
    }
  };
};
