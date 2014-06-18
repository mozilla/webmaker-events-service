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
  var Coorg = sequelize.import(__dirname + '/coorganizer.js');
  var CoorgRequest = sequelize.import(__dirname + '/coorganizerRequest.js');
  var Event = sequelize.import(__dirname + '/event.js');
  var Mentor = sequelize.import(__dirname + '/mentor.js');
  var MentorRequest = sequelize.import(__dirname + '/mentorRequest.js');
  var Tag = sequelize.import(__dirname + '/tag.js');
  var Attendee = sequelize.import(__dirname + '/attendee.js');

  // One-to-Many
  Event.hasMany(Attendee, {as: 'Attendees', foreignKey: 'eventID'});
  Attendee.belongsTo(Event, {as: 'Event', foreignKey: 'eventID'});

  Event.hasMany(Coorg);
  Coorg.belongsTo(Event);

  Event.hasMany(CoorgRequest);
  CoorgRequest.belongsTo(Event);

  Event.hasMany(Mentor);
  Mentor.belongsTo(Event);

  Event.hasMany(MentorRequest);
  MentorRequest.belongsTo(Event);

  // Many-to-many
  Event.hasMany(Tag);
  Tag.hasMany(Event);

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
    attendee: Attendee,
    coorg: Coorg,
    coorgRequest: CoorgRequest,
    event: Event,
    mentor: Mentor,
    mentorRequest: MentorRequest,
    tag: Tag
  };

};
