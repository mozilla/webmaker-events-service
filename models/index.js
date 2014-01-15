var Sequelize = require('sequelize');

module.exports = function(options) {

  // Init db with sqlite
  // TODO: allow mysql or sqlitse
  var sequelize = new Sequelize(options.db, options.user, options.password, {
    dialect: 'sqlite',
    storage: options.storage || 'events.sqlite',
  });

  // Import models
  var Event = sequelize.import(__dirname + '/event.js');

  // Sync
  sequelize.sync().complete(function (err) {
    if (err) {
      console.log(err);
    } else {
      console.log('Successfully synced.')
    }
  });

  // Export models
  return {
    event: Event
  };

};
