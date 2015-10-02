var Sequelize = require('sequelize');
var hatchet = require('hatchet');

module.exports = function (options, eventsUrl, userClient, callback) {
  options = options || {};

  var sequelize;

  // MySQL with settings
  if (options.dialect === 'mysql' && options.database) {
    sequelize = new Sequelize(options.database, options.user, options.password, {
      logging: console.log,
      host: options.host || 'localhost',
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
  Event.hasMany(Attendee, {
    foreignKey: 'eventID'
  });
  Attendee.belongsTo(Event, {
    foreignKey: 'eventID'
  });

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
    callback = callback || function (err, ok) {
      console.log(err || ok);
    };
    if (err) {
      callback(err);
    } else {
      callback(null, 'Successfully synced.');
    }
  });

  Coorg.hook('beforeBulkCreate', function (records, fields, callback) {
    var usernames = records.map(function (coorg) {
      return coorg._username;
    });

    var eventIds = records.map(function (coorg) {
      return coorg.EventId;
    });

    Event.findAll({
        where: {
          id: eventIds
        }
      })
      .then(function (events) {
        var eventsById = {};
        events.forEach(function (event) {
          eventsById[event.id] = event;
        });

        userClient.get.byUsernames(usernames, function (err, users) {
          if (err) {
            return callback(err);
          }
          var usersByUsername = {};
          users.users.forEach(function (user) {
            usersByUsername[user.username] = user;
          });
          records = records.filter(function (coorg) {
            return !!usersByUsername[coorg._username];
          }).map(function (coorg) {
            coorg.userId = usersByUsername[coorg._username].id;
            return coorg;
          });

          records.forEach(function (coorg) {
            var user = usersByUsername[coorg._username];
            var data = {
              sendEmail: user ? user.sendCoorganizerNotificationEmails : true,
              username: user.username,
              email: user.email,
              eventName: eventsById[coorg.EventId].title,
              eventUrl: eventsUrl + '/events/' + coorg.EventId,
              eventEditUrl: eventsUrl + '/edit/' + coorg.EventId,
              locale: user.prefLocale
            };
            hatchet.send('event_coorganizer_added', data);
          });
          callback(null, records, fields);
        });
      });
  });

  MentorRequest.hook('afterBulkCreate', function (records, fields, callback) {
    var emails = records.map(function (request) {
      return request.email;
    });

    var eventIds = records.map(function (request) {
      return request.EventId;
    });

    Event.findAll({
        where: {
          id: eventIds
        }
      })
      .then(function (events) {
        var eventsById = {};
        events.forEach(function (event) {
          eventsById[event.id] = event;
        });

        userClient.get.byEmails(emails, function (err, users) {
          if (err) {
            return callback(err);
          }

          var usersByEmail = {};
          users.users.forEach(function (user) {
            usersByEmail[user.email] = user;
          });

          records.forEach(function (request) {
            var user = usersByEmail[request.email];

            var confirm = function (yesno) {
              return [
                eventsUrl,
                '/confirm/mentor/',
                request.token,
                '?confirmation=',
                yesno,
                '&eventId=',
                request.EventId
              ].join('');
            };

            hatchet.send('event_mentor_confirmation_email', {
              sendEmail: user ? user.sendMentorRequestEmails : true,
              username: user && user.username,
              email: request.email,
              eventName: eventsById[request.EventId].title,
              eventUrl: eventsUrl + '/events/' + request.EventId,
              organizerUsername: eventsById[request.EventId].organizerId,
              locale: user && user.prefLocale,
              confirmUrlYes: confirm('yes'),
              confirmUrlNo: confirm('no')
            });
          });

          callback(null, records, fields);
        });
      });
  });

  // Export models
  return {
    sequelize: sequelize,
    attendee: Attendee,
    coorg: Coorg,
    coorgRequest: CoorgRequest,
    event: Event,
    mentor: Mentor,
    mentorRequest: MentorRequest,
    tag: Tag
  };
};
