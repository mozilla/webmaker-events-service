// This process will remind attendees of events happening in 24 hours

var async = require('async');
var Habitat = require('habitat');
var hatchet = require('hatchet');
var moment = require('moment-timezone');
var tzwhere = require('tzwhere');
var WebmakerUserClient = require('webmaker-user-client');

Habitat.load();
tzwhere.init();

var env = new Habitat();
var tomorrow = new Date();
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
var userClient = new WebmakerUserClient({
  endpoint: env.get('LOGIN_URL_WITH_AUTH')
});
var db = require('../models')(env.get('db'), env.get('EVENTS_FRONTEND_URL'), userClient);
var q = async.queue(function (attendee, callback) {
  userClient.get.byId(attendee.userID, function (login_error, user) {
    if (login_error) {
      login_error.from = 'Error from user client';
      return callback(login_error);
    }

    // User deleted their account, so mark the reminder as sent
    if (!user || user.error) {
      attendee.updateAttributes({
        sentEventReminder: true
      }).complete(callback);
      return;
    }

    var eventTimezone = tzwhere.tzNameAt(
      attendee.event.latitude,
      attendee.event.longitude
    );

    var eventDate = moment(attendee.event.beginDate)
      .tz(eventTimezone)
      .lang(user.user.prefLocale)
      .format('lll zz');

    hatchet.send('remind_user_about_event', {
      email: user.user.email,
      locale: user.user.prefLocale,
      userId: user.user.id,
      username: user.user.username,
      eventAddress: attendee.event.address,
      eventDate: eventDate,
      eventDescription: attendee.event.description,
      eventTitle: attendee.event.title,
      eventURL: attendee.event.url,
      organizerEmail: attendee.event.isEmailPublic ? attendee.event.organizer : null,
      organizerUsername: attendee.event.organizerUsername
    }, function (hatchet_error) {
      if (hatchet_error) {
        hatchet_error.from = 'Error from hatchet';
        return callback(hatchet_error);
      }

      attendee.updateAttributes({
        sentEventReminder: true
      }).complete(callback);
    });
  });
}, 1);

db.attendee.findAll({
  include: {
    model: db.event,
    where: {
      beginDate: {
        lte: tomorrow
      }
    }
  },
  where: {
    didRSVP: true,
    sentEventReminder: false,
    userId: {
      ne: null
    }
  }
}).then(function (attendees) {
  q.push(attendees, function (error) {
    if (error) {
      console.error(error.from);
      console.error(error.stack);
      process.exit(1);
    }

    console.log('done');
  });
});
