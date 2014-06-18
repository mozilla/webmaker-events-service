var Sequelize = require('sequelize');

module.exports = function(options) {

  options = options || {};

  var sequelize;

  // MySQL with settings
  if (options.dialect == 'mysql' && options.database) {
    sequelize = new Sequelize(options.database, options.user, options.password, {
      logging: console.log,
      host: options.host  || 'localhost',
      port: options.port || 3306,
      dialectOptions: {
        'SSL_VERIFY_SERVER_CERT': options.cert
      }
    });

  // MySQL with connection string
  } else if (options.connectionstring) {
    sequelize = new Sequelize(options.connectionstring);

  // Sqlite (Default)
  } else {
    sequelize = new Sequelize(options.database, options.user, options.password, {
      dialect: 'sqlite',
      storage: options.storage || 'events.sqlite'
    });
  }

  // Import models
  var Event = sequelize.import(__dirname + '/event.js');
  var Tag = sequelize.import(__dirname + '/tag.js');
  var Attendee = sequelize.import(__dirname + '/attendee.js');

  // Many-to-many
  Event.hasMany(Tag);
  Tag.hasMany(Event);

  // One-to-Many
  Event.hasMany(Attendee, {as: 'Attendees', foreignKey: 'eventID'});
  Attendee.belongsTo(Event, {as: 'Event', foreignKey: 'eventID'});

  // Sync
  sequelize.sync().complete(function (err) {
    if (err) {
      console.log(err);
    } else {
      console.log('Successfully synced.');
    }
  });

  // Export models
  return {
    event: Event,
    tag: Tag,
    attendee: Attendee
  };

};
