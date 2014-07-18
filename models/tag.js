module.exports = function (sequelize, t) {

  return sequelize.define('Tag', {
    name: t.STRING,
  });

};
