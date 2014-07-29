var Habitat = require('habitat');
var bPromise = require('bluebird');
var async = require('async');

Habitat.load();
var env = new Habitat();
var userClient = new(require('webmaker-user-client'))({
  endpoint: env.get('LOGIN_URL_WITH_AUTH')
});
var db = require('../models')(env.get('db'), env.get('EVENTS_FRONTEND_URL'), userClient);

var transaction,
  events,
  emails,
  skipped = 0,
  usersByEmail = {};

db.event.findAll({
  where: {
    organizerId: null
  }
}).then(function (data) {
  events = data;
  if (!events.length) {
    console.log('nothing to update!');
    process.exit(0);
  }
  emails = events.map(function (e) {
    return e.organizer;
  }).filter(function (tag, pos, arr) {
    return arr.indexOf(tag) === pos;
  });
}).then(function () {
  return new bPromise(function (resolve, reject) {
    userClient.get.byEmails(emails, function (err, data) {
      if (err) {
        return reject.call(null, err);
      }
      if (!data || !data.users || !data.users.length) {
        return reject.call(null, new Error('No user data was returned for: [' + emails.join(', ') + '] - They may be deleted accounts.'));
      }
      data.users.forEach(function (u) {
        usersByEmail[u.email] = u;
      });
      resolve.call(null);
    });
  });
}).error(function (err) {
  console.error(err.toString());
  process.exit(1);
}).then(function () {
  return new bPromise(function (resolve, reject) {
    db.sequelize.transaction(function (t) {
      transaction = t;
      async.eachSeries(events, function (event, done) {
        if (!usersByEmail[event.organizer]) {
          console.warn('No Account for email: %s (deleted?) - skipping', event.organizer);
          skipped++;
          return done();
        }
        event.organizerId = usersByEmail[event.organizer].username;
        event.save(['organizerId'], {
          transaction: transaction
        })
          .success(function () {
            done();
          })
          .error(function (err) {
            done(err);
          });
      }, function (err) {
        if (err) {
          return reject.call(null, err);
        }
        resolve.call(null);
      });
    });
  });
}).error(function (err) {
  transaction.rollback().success(function () {
    console.log('Transaction cancelled, rollback successful. cause: %s', err.toString());
    process.exit();
  });
  console.error(err.toString());
  process.exit(1);
}).then(function () {
  transaction.commit().success(function () {
    console.log('Transaction committed successfully. (skipped %d (deleted accounts?))', skipped);
  });
});
