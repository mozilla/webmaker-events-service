module.exports = function (sequelize, t) {

  return sequelize.define('Tag', {
    name: {
      type: t.STRING,
      set: function(value) {
        return this.setDataValue('name', value.toString().toLowerCase())
      }
    }
  });

};
