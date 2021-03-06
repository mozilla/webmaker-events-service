// This process will send a follow-up email to hosts the day after their event

var async = require('async');
var Habitat = require('habitat');
var hatchet = require('hatchet');
var WebmakerUserClient = require('webmaker-user-client');

Habitat.load();

var env = new Habitat();
var yesterday = new Date();
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
var userClient = new WebmakerUserClient({
  endpoint: env.get('LOGIN_URL_WITH_AUTH')
});
var db = require('../models')(env.get('db'), env.get('EVENTS_FRONTEND_URL'), userClient);
var q = async.queue(function (event, q_callback) {
  userClient.get.byEmail(event.organizer, function (login_error, user) {
    if (login_error) {
      login_error.from = 'Error from user client';
      return q_callback(login_error);
    }

    // User deleted their account, so mark the reminder as sent
    if (!user || user.error) {
      event.updateAttributes({
        sentPostEventEmailToHost: true
      }, ['sentPostEventEmailToHost']).complete(q_callback);
      return;
    }

    hatchet.send('send_post_event_email_to_host', {
      email: user.user.email,
      locale: user.user.preflocale,
      userId: user.user.id,
      username: user.user.username,
      eventURL: event.url
    }, function (hatchet_error) {
      if (hatchet_error) {
        hatchet_error.from = 'Error from hatchet';
        return q_callback(hatchet_error);
      }

      event.updateAttributes({
        sentPostEventEmailToHost: true
      }, ['sentPostEventEmailToHost']).complete(q_callback);
    });
  });
}, 1);

db.event.findAll({
  where: {
    beginDate: {
      lte: yesterday
    },
    sentPostEventEmailToHost: false
  }
}).then(function (events) {
  if (!events) {
    return console.log('done');
  }

  q.push(events, function (error) {
    if (error) {
      console.error(error);
      console.error(error.from);
      console.error(error.stack);
      process.exit(1);
    }

    console.log('done');
  });
});
