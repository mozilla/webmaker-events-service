module.exports = function (db) {
  return {
    get: function (req, res) {
      if (!req.query.like) {
        res.send(500, 'Must provide a "like" query value.');
      }

      db.tag
        .findAll({
          where: {
            name: {
              like: '%' + req.query.like + '%'
            }
          },
          attributes: ['name', ['COUNT(\'name\')', 'nameCount']],
          group: 'name',
          order: 'nameCount',
          limit: 20
        })
        .then(function success(tags) {
          var tagNames = [];

          tags.forEach(function (tag) {
            tagNames.push(tag.name);
          });

          res.json(tagNames);
        }, function fail() {
          res.send(500);
        });
    }
  };
};
