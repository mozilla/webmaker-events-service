var Sequelize = require('sequelize');
var WebmakerUserClient = require('webmaker-user-client');
var hatchet = require('hatchet');

module.exports = function(options, login_url_with_auth, events_url) {

  options = options || {};

  var sequelize;
  var userClient = new WebmakerUserClient({
    endpoint: login_url_with_auth
  });

  // MySQL with settings
  if (options.dialect === 'mysql' && options.database) {
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
  Event.hasMany(Attendee, {foreignKey: 'eventID'});
  Attendee.belongsTo(Event, {foreignKey: 'id'});

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

  Coorg.hook('beforeBulkCreate', function(records, fields, callback) {

    var usernames = records.map(function (coorg) {
      return coorg._username;
    });

    var event_ids = records.map(function (coorg) {
      return coorg.EventId;
    });

    Event.findAll({ id: event_ids })
    .then(function(events) {
      var eventsById = {};
      events.forEach(function(event) {
        eventsById[event.id] = event;
      });

      userClient.get.byUsernames(usernames, function(err, users) {
        if (err) {
          return callback(err);
        }
        var usersByUsername = {};
        users.users.forEach(function(user) {
          usersByUsername[user.username] = user;
        });
        records = records.filter(function(coorg) {
          return !!usersByUsername[coorg._username];
        }).map(function(coorg) {
          coorg.userId = usersByUsername[coorg._username].id;
          return coorg;
        });

        records.forEach(function (coorg) {
          var user = usersByUsername[coorg._username];
          var data = {
            sendEmail: user ? user.sendMentorRequestEmails : true,
            username: user.username,
            email: user.email,
            eventName: eventsById[coorg.EventId].title,
            eventUrl: events_url + '/#!/events/' + coorg.EventId,
            eventEditUrl: events_url + '/#!/edit/' + coorg.EventId,
            locale: user.prefLocale,
          };
          hatchet.send('event_coorganizer_added', data);
        });
        callback(null, records, fields);
      });
    });
  });

  MentorRequest.hook('afterBulkCreate', function(records, fields, callback) {
    var emails = records.map(function(request) {
      return request.email;
    });

    var event_ids = records.map(function(request) {
      return request.EventId;
    });

    Event.findAll({ id: event_ids })
    .then(function(events) {
      var eventsById = {};
      events.forEach(function(event) {
        eventsById[event.id] = event;
      });

      userClient.get.byEmails(emails, function(err, users) {
        if (err) {
          return callback(err);
        }

        var usersByEmail = {};
        users.users.forEach(function(user) {
          usersByEmail[user.email] = user;
        });

        records.forEach(function(request) {
          var user = usersByEmail[request.email];

          hatchet.send('event_mentor_confirmation_email', {
            sendEmail: user ? user.sendMentorRequestEmails : true,
            username: user && user.username,
            email: request.email,
            eventName: eventsById[request.EventId].title,
            eventUrl: events_url + '/#!/events/' + request.EventId,
            organizerUsername: eventsById[request.EventId].organizerId,
            locale: user && user.prefLocale,
            confirmUrlYes: events_url + '/#!/confirm/mentor/' + request.token + '?confirmation=yes&eventId=' + request.EventId,
            confirmUrlNo: events_url + '/#!/confirm/mentor/' + request.token + '?confirmation=no&eventId=' + request.EventId
          });
        });

        callback(null, records, fields);
      });
    });
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
