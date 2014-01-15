var Sequelize = require('sequelize');

module.exports = function(options) {

  options = options || {};

  var sequelize;

  // MySQL with connection string
  if (options.connectionstring) {
    sequelize = new Sequelize(options.connectionstring);

  // MySQL with settings
  } else if (options.dialect == 'mysql') {
    sequelize = new Sequelize(options.database, options.user, options.password, {
      host: options.host || 'localhost',
      port: options.port || 3306
    });

  // Sqlite (Default)
  } else {
    sequelize = new Sequelize(options.database, options.user, options.password, {
      dialect: 'sqlite',
      storage: options.storage || 'events.sqlite'
    });
  }

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
