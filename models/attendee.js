module.exports = function (sequelize, t) {

  return sequelize.define('Attendee', {
    userID: {
      type: t.INTEGER,
      allowNull: true
    },
    email: {
      type: t.STRING,
      validate: {
        isEmail: true
      },
      allowNull: true
    },
    didRSVP: {
      type: t.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    didAttend: {
      type: t.BOOLEAN,
      allowNull: true // Prevent false negatives caused by user being checked in
    },
    sentEventReminder: {
      type: t.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  });

};
