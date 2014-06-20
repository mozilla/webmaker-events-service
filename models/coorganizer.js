module.exports = function(sequelize, t) {

  return sequelize.define('Coorganizer', {
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
    },
    setterMethods: {
      username: function(data) {
        this._username = data;
      }
    }
  });

};
