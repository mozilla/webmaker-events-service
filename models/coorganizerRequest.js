module.exports = function (sequelize, t) {

  return sequelize.define('CoorganizerRequests', {
    email: {
      type: t.STRING,
      allowNull: false
    },
    token: {
      type: t.UUID,
      allowNull: false,
      defaultValue: t.UUIDV4
    },
    denied: {
      type: t.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  });

};
