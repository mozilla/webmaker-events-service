module.exports = function(sequelize, t) {

  return sequelize.define('RSVP', {
    username: t.STRING,
    eventID: t.INTEGER
  });

};
