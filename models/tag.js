module.exports = function (sequelize, t) {

  return sequelize.define('Tag', {
    name: {
      // Must be 191 utf8 characters or less to fit within max index size
      type: t.STRING(191),
      unique: true,
      set: function (value) {
        return this.setDataValue('name', value.toString().toLowerCase());
      }
    }
  });

};
