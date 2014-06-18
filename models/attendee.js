module.exports = function(sequelize, t) {

  return sequelize.define('Attendee', {
    userID: {
      type: t.INTEGER,
      allowNull: false
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
    isMentor: {
      type: t.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    isCoorg: {
      type: t.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
  });

};
