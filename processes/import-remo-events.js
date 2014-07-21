// This process imports all remo events into the event db
var request = require('request');
var moment = require('moment');
var Habitat = require('habitat');

Habitat.load();
var env = new Habitat();
var userClient = new(require('webmaker-user-client'))({
  endpoint: env.get('LOGIN_URL_WITH_AUTH')
});
var db = require('./models')(env.get('db'), env.get('EVENTS_FRONTEND_URL'), userClient);
var remoUrl = 'https://reps.mozilla.org/api/v1/event/?offset=0&limit=0&categories__name__iexact=webmaker&start__gte=' + moment().format('YYYY-MM-DD');
var source = 'mozreps';

request(remoUrl, function (err, response, body) {
  var events;

  if (err) {
    return console.error(err.stack);
  }
  try {
    events = JSON.parse(body).objects;
  } catch (e) {
    return console.error('Error: could not parse remo events api response', body);
  }

  events = events.map(function (event) {
    var newEvent = {};
    newEvent.title = event.name;
    newEvent.description = event.description;
    newEvent.address = event.city + ', ' + event.country;
    newEvent.latitude = event.lat;
    newEvent.longitude = event.lon;
    newEvent.city = event.city;
    newEvent.country = event.country;
    newEvent.beginDate = event.start;
    newEvent.endDate = event.end;
    newEvent.registerLink = event.exernal_link;
    newEvent.organizer = 'info@webmaker.org';
    newEvent.organizerId = 'mozreps';
    newEvent.externalSource = source;
    newEvent.url = event.event_url;
    return newEvent;
  });
  db.sequelize.transaction(function (t) {
    db.event
      .destroy({
        externalSource: source
      }, {
        transaction: t
      })
      .success(function () {
        db.event
          .bulkCreate(events, {
            transaction: t
          })
          .success(function () {
            t.commit().success(function () {
              console.log('Events created successfully');
              process.exit(0);
            });
          });
      });
  });
});
