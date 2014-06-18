module.exports = function(sequelize, t) {

  return sequelize.define('Mentor', {
    userId: {
      type: t.INTEGER,
      allowNull: false
    }
  }, {
    getterMethods: {
      avatar: function() {
        return this._avatar;
      },
      username: function() {
        return this._username;
      }
    }
  });

};
