/*
**
** bulk-import-csv.js
**
** This script will import events from a comma separated value (CSV) text file.
**
** Usage: node scripts/bulkImport ~/path/to/csv/file.csv
**
** the data should have the column names on the first line, and each row of data on subsequent lines. i.e.
**
** title,description,location,attendees,beginDate,beginTime,length,registerLink,organizerUsername,areAttendeesPublic,skillLevel,ageGroup,tags
** Awsm Event,an awsm event for you,Toronto,150,8/25/2014,18:30,unknown,mozilla.org/awsm,cade,TRUE,advanced,adults,"javascript, teaching"
**
** If any row in the provided data is invalid for any reason, NONE of the events will be committed into the Events database.
** You must either remove or fix the broken event.
**
*/

var csv = require('csv');
var fs = require('fs');
var path = require('path');
var async = require('async');
var _ = require('lodash');
var geocoder = require('node-geocoder').getGeocoder('google', 'https');

var Habitat = require('habitat');
Habitat.load();

// Configuration
var env = new Habitat();

// Heroku clearbase support
if (!env.get('DB_CONNECTIONSTRING') && env.get('cleardbDatabaseUrl')) {
  env.set('DB_CONNECTIONSTRING', env.get('cleardbDatabaseUrl').replace('?reconnect=true', ''));
}

var userClient = new (require('webmaker-user-client'))({
  endpoint: env.get('LOGIN_URL_WITH_AUTH')
});

var db = require('../models')(env.get('db'), env.get('LOGIN_URL_WITH_AUTH'), env.get('EVENTS_FRONTEND_URL'));

function readCSV(filePath, callback) {
  fs.readFile(path.resolve( __dirname, filePath ), { encoding: "utf8" }, function( err, data ) {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    callback(null, { csv: data });
  });
}

function parseCSV(data, callback) {
  csv.parse(data.csv, { columns: true }, function(err, parsedData) {
    if ( err ) {
      console.error(err);
      process.exit(1);
    }
    data.parsed = parsedData;
    callback(null, data)
  });
}

function checkValues(data, callback) {
  data.parsed.forEach(function(eventData, idx) {
    if ( !eventData.title || !eventData.description || !eventData.attendees ||
         !eventData.organizerUsername || !eventData.beginDate || !eventData.length ||
         !eventData.location || !eventData.skillLevel || !eventData.ageGroup ) {
      console.error(new Error('Event at row #' + (idx + 1) + ' is invalid, check it\'s values'));
      process.exit(1);
    }
  });
  callback(null, data);
}

function verifyUser(data, callback) {
  var fetchedUsers = {};
  async.mapSeries(data.parsed, function(event, done) {
    var user;
    if ( !fetchedUsers[ event.organizerUsername ] ) {
      userClient.get.byUsername(event.organizerUsername, function(err, resp){
        if ( err || !resp || !resp.user ) {
          console.error(new Error( err ? err : 'Username (' + event.organizerUsername + ') is invalid or could not be found'));
          process.exit(1);
        }
        event.organizer = resp.user.email;
        event.organizerId = event.organizerUsername;
        fetchedUsers[ event.organizerUsername ] = resp.user;

        delete event.organizerUsername;

        done(null, event);
      });
    } else {
      event.organizer = fetchedUsers[ event.organizerUsername ].email;
      event.organizerId = event.organizerUsername;
      delete event.organizerUsername;
      done(null, event);
    }
  }, function(err, mapped) {
    if ( err ) {
      console.error(err);
      process.exit(1);
    }
    data.parsed = mapped;
    callback(null, data);
  });
}

function geocode(data, callback) {
  async.eachSeries(data.parsed, function(event, done) {
    geocoder.geocode(event.location)
    .then(function(resp) {
      if ( !resp.length ) {
        console.error(new Error('geocoder found no data for location: ' + event.location));
        process.exit(1);
      }
      var geoData = resp[0];
      event.latitude = geoData.latitude;
      event.longitude = geoData.longitude;
      event.country = geoData.country;
      event.city = geoData.city;

      event.address = event.location;
      delete event.location;
      done();
    })
    .catch(function(err) {
      console.error(err);
      process.exit(1);
    });
  }, function(err) {
    callback(err, data);
  });
}

function mapFields(data, callback) {
  data.parsed = data.parsed.map(function(eventData) {
    eventData.tags = eventData.tags.split(',').map(function(s) {
      return s.trim();
    });
    eventData.areAttendeesPublic = eventData.areAttendeesPublic === 'TRUE';

    eventData.length = eventData.length === 'unknown' ? 0 : +eventData.length;

    eventData.beginDate = new Date(eventData.beginDate);
    eventData.endDate = new Date((new Date(eventData.beginDate)).setHours(eventData.beginDate.getHours() + eventData.length ));
    eventData.ageGroup = eventData.ageGroup === 'any' ? '' : eventData.ageGroup;
    eventData.skillLevel = eventData.skillLevel === 'any' ? '' : eventData.skillLevel;

    return eventData;
  });
  callback(null, data)
}

function create(data, callback) {
  db.sequelize.transaction(function( transaction ) {
    data.created = [];
    async.eachSeries(data.parsed, function(eventData, done) {
      var eventDAO,
          tagsDAOS;

      db.event.create(eventData, {
        transaction: transaction
      })
      .then(function(event) {
        eventDAO = event;
        var tagsToStore = eventData.tags;
        if (!tagsToStore || !tagsToStore.length) {
          return;
        }

        return db.tag
          .findAll({ // Find pre-existing tags
            where: {
              name: { in : tagsToStore
              }
            }
          })
          .then(function (tags) {
            var recordedTagNames = [];

            tags.forEach(function (tag) {
              recordedTagNames.push(tag.name);
            });

            // Determine set of unrecorded tags
            var newTags = _.xor(tagsToStore, recordedTagNames);
            var tagBlob = [];

            newTags.forEach(function (tag) {
              tagBlob.push({
                name: tag
              });
            });

            // Store new unique tag names
            return db.tag.bulkCreate(tagBlob, {
              transaction: transaction
            });
          })
          .then(function () { // Fetch all tag DAOs
            return db.tag.findAll({
              where: {
                name: { in : tagsToStore
                }
              }
            });
          });
        //return storeTags(eventData.tags, transaction);
      })
      .then(function(tags) {
        tagsDAOS = tags;
        return eventDAO.setTags(tags, {
          transaction: transaction
        });
      })
      .then(function() {
        data.created.push({
          event: eventDAO.values,
          tags: tagsDAOS.map(function(tag) {
            return tag.values;
          })
        });
        done();
      }, function(err) {
        return rollback(function() {
          console.error(err);
          process.exit(1);
        });
      });
    }, function(err) {
      if ( err ) {
        return rollback(function() {
          console.error( err );
          process.exit(1);
        });
      }

      transaction.commit().success(function() {
        callback(null, data);
      });
    });

    function rollback(cb) {
      transaction.rollback().success(cb);
    }
  });
}

async.waterfall([
  function(callback){
    var filePath = process.argv[2];

    if ( !filePath ) {
      console.error(new Error("You must pass in the path to the CSV file to ipmort."));
      process.exit(1);
    }
    callback( null, process.argv[2] )
  },
  readCSV,
  parseCSV,
  checkValues,
  verifyUser,
  geocode,
  mapFields,
  create
], function( err, data ) {
  if ( err ) {
    console.error( err );
    process.exit(1);
  }
  var url = env.get("EVENTS_FRONTEND_URL") + "/!#/events/";
  data.created.forEach(function(created) {
    console.log( url + created.event.id )
  });
  process.exit(0);
});
