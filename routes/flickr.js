var Flickr = require('flickr-simple');

module.exports = function (env, db) {
  var flickr = new Flickr({
    api_key: env.get('FLICKR_API_KEY')
  });

  return function (req, res, next) {
    db.event
      .find({
        where: {
          id: req.params.id
        }
      })
      .then(function success(event) {
        if (!event || !event.flickrTag) {
          return res.send([]);
        }
        var flickrTagFormatted = event.flickrTag.split(',').join('+');
        flickr.photos.search({
          per_page: req.query.limit || 20,
          page: req.query.page || 1,
          tags: flickrTagFormatted
        }, function (err, data) {
          if (err) {
            return next(err);
          }
          res.json(data);
        });
      }, function error(err) {
        next(err);
      });
  };

};
