var hatchet = require('hatchet');
var json2csv = require('json2csv');
var _ = require('lodash');
var bPromise = require('bluebird');
var Sequelize = require('sequelize');
var newrelic = require('newrelic');

module.exports = function (db, userClient) {

  /**
   * De-dupe and lowercase groups of tags
   * @param  {Array} tags An array of tags as Strings
   * @return {Array}      A clean tag array
   */

  function sanitizeTags(tags) {
    var clean = [];
    tags = _.unique(tags);

    tags.forEach(function (tag, index) {
      clean.push(tag.toLowerCase());
    });

    return clean;
  }

  /**
   * Store unrecorded tags in DB and return a promise
   *   with tag DAOs if storage succeeded.
   * @param  {Array} tagsToStore Array of tags as Strings
   * @return {Promise}
   */

  function storeTags(tagsToStore) {
    return new bPromise(function (resolve, reject) {
      if (!tagsToStore || !tagsToStore.length) {
        resolve.call(null, []);
      }

      db.tag
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
          return db.tag.bulkCreate(tagBlob);
        })
        .then(function () { // Fetch all tag DAOs
          return db.tag.findAll({
            where: {
              name: { in : tagsToStore
              }
            }
          });
        })
        .then(function success(tagDAOs) {
          resolve.call(null, tagDAOs);
        }, function fail(err) {
          reject.call(null, err);
        });
    });
  }

  function createAssociations(event, type, instances) {
    return new bPromise(function (resolve, reject) {

      if (!instances) {
        return resolve.call(null, event);
      }

      var model = db[type];

      instances.forEach(function (instance) {
        instance.EventId = event.id;
      });

      model
        .bulkCreate(instances)
        .then(function success(data) {
          resolve.call(null, event);
        }, function failure(err) {
          reject.call(null, err);
        });
    });
  }

  function associationsToCreate(eventId, values) {
    if (!values) {
      return [];
    }
    return values.filter(function (a) {
      return typeof a.id === 'undefined';
    }).map(function (a) {
      a.EventId = eventId;
      return a;
    });
  }

  function updateAssociations(oldValues, updatedValues) {
    return oldValues.map(function (old) {
      var update = updatedValues.filter(function (update) {
        return old.id === update.id;
      })[0];

      if (!update) {
        return old;
      }

      Object.keys(old.values).forEach(function (key) {
        old[key] = update[key];
      });

      return old;
    });
  }

  function associationsToDelete(events, newValues) {
    return events.filter(function (event) {
      return !newValues.some(function (nvalue) {
        return event.id === nvalue.id;
      });
    }).map(function (event) {
      return event.id;
    });
  }

  // Check if a user has write access to an event.

  function isEventOrganizer(req, eventInstance) {
    return (req.session.user && req.devAdmin) ||
      (req.session.user && req.session.user.isAdmin) ||
      (req.session.user && eventInstance.organizer === req.session.user.email);
  }

  /**
   * Create a CSV string from a specific object key's value
   * @param  {Array} record Array of Objects
   * @param  {String} key Property to serialize
   * @return {String} CSV string
   */
  function simplifyRecord(record, key) {
    var csvString = '';

    record.forEach(function (item, index) {
      if (index < record.length - 1) {
        csvString += item[key] + ',';
      } else {
        csvString += item[key];
      }
    });

    return csvString;
  }

  /**
   * Turn an array into a CSV string
   * @param  {Array} target
   * @return {String}
   */
  function arrayToCSV(target) {
    var csvString = '';

    if (Array.isArray(target)) {
      target.forEach(function (element, index) {
        if (index < target.length - 1) {
          csvString += element + ',';
        } else {
          csvString += element;
        }
      });
    }

    return csvString;
  }

  // convert radians to degrees
  function radToDeg(rad) {
    return rad * 180 / Math.PI;
  }

  // convert degrees t radians
  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  /**
   * Calculate the maximum and minimum latitudes and logitudes that a
   * point must fall within from a given coordinate and radius
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   * @param {Number} radius - radius (Kilometres)
   */
  function getBoundingCoordinates(lat, lng, radius) {

    // The radius of the Earth in Kilometres
    var earthsRadius = 6371;

    var latValue = radToDeg(radius / earthsRadius),
      lngValue = radToDeg(radius / earthsRadius / Math.cos(degToRad(lat)));

    return {
      maxLat: lat + latValue,
      maxLng: lng + lngValue,
      minLat: lat - latValue,
      minLng: lng - lngValue,
    };
  }

  var MAX_EVENTS_RETURNED = 100;
  var COUNT_SQL_QUERY = 'SELECT DISTINCT(COUNT(*)) AS `count` FROM `Events`';
  var DATA_SQL_QUERY = 'SELECT DISTINCT(`Events`.`id`) FROM `Events`';
  var JOIN_COORGANIZERS_AND_MENTORS = ' LEFT JOIN `Coorganizers` ON `Events`.`id` = `Coorganizers`.`EventId` AND `Coorganizers`.`userId` = :userId LEFT JOIN `Mentors` ON `Events`.`id` = `Mentors`.`EventId` AND `Mentors`.`userId` = :userId';
  var JOIN_TAGS = ' JOIN `EventsTags` ON `Events`.`id` = `EventsTags`.`EventId` JOIN `Tags` ON `EventsTags`.`TagId` = `Tags`.`id` AND `Tags`.`name` = :tag';

  var controller = {

    get: {
      csv: function (req, res) {
        req.query.csv = true;
        controller.get.all(req, res);
      },
      all: function (req, res) {
        var order = '`Events`.`beginDate` ASC';

        var username = req.query.username;
        var after = req.query.after;
        var before = req.query.before;
        var dedupe = req.query.dedupe || false;
        var tagFilter = req.query.tag || null;
        var searchTerm = req.query.search || false;
        var lat = req.query.lat;
        var lng = req.query.lng;
        var radius = req.query.radius;

        // Constrain to publicly listed events as a baseline for filtration
        var whereEvents = [{
          'Events.isEventPublic': true
        }];

        var replacements = {};
        var eventCount;
        var limit;
        var boundingCoordinates;
        // default to MAX_EVENTS_RETURNED events returned
        var rangeStart = 0;
        var rangeEnd = MAX_EVENTS_RETURNED - 1;
        var beforeDate;
        var afterDate;
        var timing_segment;

        // Attempt to parse date strings into objects:

        if (after) {
          afterDate = new Date(after);

          if (afterDate.toString() === 'Invalid Date') {
            return res.json(500, {
              error: 'Malformed after date'
            });
          }
        }

        if (before) {
          beforeDate = new Date(before);

          if (beforeDate.toString() === 'Invalid Date') {
            return res.json(500, {
              error: 'Malformed before date'
            });
          }
        }

        // Add date based query options where applicable:

        if (afterDate && beforeDate) {
          whereEvents.push({
            'Events.beginDate': {
              between: [afterDate, beforeDate]
            }
          });
        } else if (beforeDate) {
          whereEvents.push({
            'Events.beginDate': {
              lte: beforeDate
            }
          });
        } else if (afterDate) {
          whereEvents.push({
            'Events.beginDate': {
              gte: afterDate
            }
          });
        }

        if (lat && lng && radius) {
          if (radius <= 0) {
            radius = 100;
            // Arbitrary number, can be removed/changed
          } else if (radius >= 2000) {
            radius = 2000;
          }

          boundingCoordinates = getBoundingCoordinates(+lat, +lng, +radius);

          whereEvents.push({
            'Events.latitude': {
              between: [boundingCoordinates.minLat, boundingCoordinates.maxLat]
            }
          });

          whereEvents.push({
            'Events.longitude': {
              between: [boundingCoordinates.minLng, boundingCoordinates.maxLng]
            }
          });
        }

        if (searchTerm) {
          whereEvents.push(
            Sequelize.or({
              'Events.title': {
                like: '%' + searchTerm + '%'
              }
            }, {
              'Events.description': {
                like: '%' + searchTerm + '%'
              }
            }, {
              'Events.address': {
                like: '%' + searchTerm + '%'
              }
            })
          );
        }

        if (tagFilter) {
          whereEvents.push({
            'Tags.name': tagFilter
          });
        }

        // Parse out numerical ranges from "range" header
        if (req.headers.range) {
          rangeStart = parseInt(req.headers.range.split('-')[0], 10);
          rangeEnd = parseInt(req.headers.range.split('-')[1], 10);
        }
        if (isNaN(rangeStart) || isNaN(rangeEnd)) {
          rangeStart = 0;
          rangeEnd = MAX_EVENTS_RETURNED - 1;
        }
        if (rangeEnd - rangeStart + 1 > MAX_EVENTS_RETURNED) {
          rangeEnd = rangeStart + MAX_EVENTS_RETURNED - 1;
        }

        limit = rangeEnd - rangeStart + 1;

        newrelic.addCustomParameter('record_start', rangeStart);
        newrelic.addCustomParameter('record_end', rangeEnd);
        newrelic.addCustomParameter('limit', limit);

        timing_segment = Date.now();

        (username ? userClient.get.byUsernameAsync(username) : bPromise.resolve())
          .then(function (userData) {
            var count_query = COUNT_SQL_QUERY;
            var data_query = DATA_SQL_QUERY;

            if (userData && userData.error) {
              var user_not_found_error = new Error(userData.error);
              user_not_found_error.statusCode = 404;
              return bPromise.reject(user_not_found_error);
            }

            if (userData) {
              var userID = userData.user.id;

              whereEvents.push(
                Sequelize.or({
                  'Events.organizerId': username
                }, {
                  'Mentors.userId': userID
                }, {
                  'Coorganizers.userId': userID
                })
              );
              replacements.userId = userID;

              count_query += JOIN_COORGANIZERS_AND_MENTORS;
              data_query += JOIN_COORGANIZERS_AND_MENTORS;

              newrelic.addCustomParameter('username_search', Date.now() - timing_segment);
            }

            if (tagFilter) {
              replacements.tag = tagFilter;

              count_query += JOIN_TAGS;
              data_query += JOIN_TAGS;

            }

            if (whereEvents.length > 0) {
              var where_conditions = ' WHERE ' + db.sequelize.queryInterface.QueryGenerator.getWhereConditions(whereEvents);
              count_query += where_conditions;
              data_query += where_conditions;
            }

            data_query += ' ORDER BY ' + order;
            if (limit) {
              data_query += db.sequelize.queryInterface.QueryGenerator.addLimitAndOffset({
                limit: limit,
                offset: rangeStart
              });
            }

            timing_segment = Date.now();

            return bPromise.join(
              db.sequelize.query(count_query, null, {
                raw: true
              }, replacements),
              db.sequelize.query(data_query, null, {
                raw: true
              }, replacements)
            );
          })
          .spread(function (count_results, data_results) {
            newrelic.addCustomParameter('db:metadata', Date.now() - timing_segment);

            eventCount = count_results[0].count;
            timing_segment = Date.now();

            return db.event.findAll({
              order: order,
              where: {
                id: _.pluck(data_results, 'id')
              },
              include: [{
                model: db.coorg,
                attributes: ['EventId', 'userId']
              }, {
                model: db.mentor,
                attributes: ['EventId', 'userId']
              }, {
                model: db.tag,
                attributes: ['name']
              }]
            });
          })
          .then(function (events) {
            newrelic.addCustomParameter('db:results', Date.now() - timing_segment);

            // Don't return multiple events with the same title when dedupe is enabled
            if (dedupe) {
              events = _.uniq(events, 'title');
            }

            var publicData = _.invoke(events, 'toFilteredJSON', true);

            if (!req.query.csv) {
              res.header('Accept-Ranges', 'items');
              res.header('Range-Unit', 'items');
              res.header('Content-Range', rangeStart + '-' + rangeEnd + '/' + eventCount);

              res.json(publicData);
            } else {
              var flattenedData = [];
              var userIds = [];

              publicData.forEach(function (event, index) {
                userIds = userIds.concat(event.coorganizers.map(function (c) {
                  return c.userId;
                })).concat(event.mentors.map(function (m) {
                  return m.userId;
                }));
              });

              userClient.get.byIds(userIds, function (err, users) {
                if (err) {
                  return res.send(500, err.toString());
                }

                if (!users || !Array.isArray(users.users)) {
                  return res.send(500, 'Couldn\'t find any user ids in login database');
                }

                var usersById = {};

                users.users.forEach(function (u) {
                  usersById[u.id] = u;
                });

                publicData.forEach(function (event, index) {
                  // Get user data for each userId

                  event.mentors.forEach(function (m) {
                    var user = usersById[m.userId];
                    if (!user) {
                      return;
                    }
                    m._email = user.email;
                  });

                  event.coorganizers.forEach(function (c) {
                    var user = usersById[c.userId];
                    if (!user) {
                      return;
                    }
                    c._email = user.email;
                  });

                  event.coorganizers = event.coorganizers.length ? simplifyRecord(event.coorganizers, '_email') : null;
                  event.mentors = event.mentors.length ? simplifyRecord(event.mentors, '_email') : null;
                  event.tags = event.tags.length ? arrayToCSV(event.tags) : null;

                  flattenedData.push(event);
                });

                json2csv({
                  data: flattenedData,
                  fields: ['id', 'title', 'description', 'address', 'latitude', 'longitude', 'city', 'country', 'estimatedAttendees', 'beginDate', 'endDate', 'registerLink', 'organizer', 'organizerId', 'createdAt', 'updatedAt', 'areAttendeesPublic', 'ageGroup', 'skillLevel', 'isEmailPublic', 'externalSource', 'coorganizers', 'mentors', 'tags']
                }, function (err, csv) {
                  if (err) {
                    console.error(err.stack);
                    res.send(500, err);
                  } else {
                    res.type('text/csv');
                    res.send(csv);
                  }
                });
              });
            }
          })
          .caught(function (err) {
            console.error(err.stack);
            res.statusCode = err.statusCode ? err.statusCode : 500;
            res.json({
              error: err.toString()
            });
          })
          .error(function (err) {
            console.error(err.stack);
            res.statusCode = 500;
            res.json(err);
          });
      },
      id: function (req, res) {
        db.event
          .find({
            where: {
              id: req.params.id
            },
            include: [
              db.coorg,
              db.mentor, {
                model: db.mentorRequest,
                attributes: ['id', 'email', 'denied', 'EventId']
              }, {
                model: db.tag,
                attributes: ['name']
              }
            ]
          })
          .then(function success(event) {
            // Don't allow editing/viewing of external events in details view
            if (!event || event.externalSource) {
              return res.send(404);
            }

            // Only organizers and co-organizers should see mentor requests
            var showPrivateData = (isEventOrganizer(req, event) ||
              event.isCoorganizer(req.session.user && req.session.user.id));

            if (!event.coorganizers.length &&
              !event.mentors.length) {
              return res.json(event.toFilteredJSON(showPrivateData));
            }

            // Pull out userIds from coorganizers and mentors
            var userIds = event.coorganizers.map(function (c) {
              return c.userId;
            }).concat(event.mentors.map(function (m) {
              return m.userId;
            }));

            // Get user data for each userId
            userClient.get.byIds(userIds, function (err, users) {
              if (err) {
                return res.send(500, err.toString());
              }
              if (!users || !Array.isArray(users.users)) {
                return res.send(500, 'Couldn\'t find any user ids in login database');
              }

              var usersById = {};
              users.users.forEach(function (u) {
                usersById[u.id] = u;
              });

              event.coorganizers.forEach(function (c) {
                var user = usersById[c.userId];
                if (!user) {
                  return;
                }
                c._username = user.username;
                c._avatar = user.avatar;
              });
              event.mentors.forEach(function (m) {
                var user = usersById[m.userId];
                if (!user) {
                  return;
                }
                m._username = user.username;
                m._avatar = user.avatar;
              });

              res.json(event.toFilteredJSON(showPrivateData));
            });

          }, function error(err) {
            res.json(500, err);
          });
      },
      related: function (req, res) {
        db.event
          .find({
            where: {
              id: req.params.id
            },
            include: [{
              model: db.tag,
              attributes: ['name']
            }]
          }).then(function success(event) {
            var boundingCoordinates,
              query,
              andQuery,
              orQueries = [];

            andQuery = {
              beginDate: {
                gte: new Date()
              },
              id: {
                not: event.id
              }
            };

            orQueries.push({
              organizerId: event.organizerId
            });

            if (event.latitude && event.longitude) {
              // events within 500KM
              boundingCoordinates = getBoundingCoordinates(event.latitude, event.longitude, 500);

              orQueries.push(Sequelize.and({
                latitude: {
                  between: [boundingCoordinates.minLat, boundingCoordinates.maxLat]
                }
              }, {
                longitude: {
                  between: [boundingCoordinates.minLng, boundingCoordinates.maxLng]
                }
              }));
            }

            if (event.tags.length) {
              orQueries.push({
                'Tags.name': event.tags.map(function (tag) {
                  return tag.name;
                }).filter(function (tag, pos, arr) {
                  return arr.indexOf(tag) === pos;
                })
              });
            }

            query = Sequelize.and(andQuery, Sequelize.or.apply(Sequelize, orQueries));

            return db.event.findAll({
              where: query,
              order: 'beginDate',
              include: [{
                model: db.tag,
                attributes: ['name']
              }]
            });
          }).then(function (events) {
            res.json(_.invoke(events, 'toFilteredJSON', true));
          }).error(function error(err) {
            res.json(500, err);
          });
      }
    },

    post: function (req, res) {
      // Verify event body
      if (!req.body) {
        return res.send(401, 'You may not create an empty event');
      }

      // Verify login
      if (!req.session.user || !req.session.user.email) {
        return res.send(403, 'You must sign in with Webmaker to create an event');
      }

      var eventDAO;
      var tagsToStore = sanitizeTags(req.body.tags);

      db.event.create(req.body)
        .then(function (event) { // Event is created

          hatchet.send('create_event', {
            eventId: event.getDataValue('id'),
            userId: req.session.user.id,
            username: req.session.user.username,
            email: req.session.user.email,
            locale: req.session.user.prefLocale,
            sendEventCreationEmails: req.session.user.sendEventCreationEmails
          });

          return event;
        })
        .then(function (event) {
          return createAssociations(event, 'mentorRequest', req.body.mentorRequests);
        })
        .then(function (event) {
          return createAssociations(event, 'coorg', req.body.coorganizers);
        })
        .then(function (event) { // Find all pre-existing tags
          // Store a refrence for use later in the promise chain
          eventDAO = event;

          return storeTags(tagsToStore);
        })
        .then(function (tags) {
          // Associate tags with the event
          return eventDAO.setTags(tags);
        })
        .then(function () {
          res.json({
            message: 'Event created.',
            id: eventDAO.id
          });
        })
        .catch(function (err) {
          console.log(err.stack);
          res.json(500, {
            error: err
          });
        });
    },

    put: function (req, res) {
      var id = req.params.id;
      var updatedAttributes = req.body;

      // First, find the event
      db.event
        .find({
          where: {
            id: req.params.id
          },
          include: [
            db.coorg,
            db.mentor,
            db.mentorRequest
          ]
        })
        .success(function (eventInstance) {

          // No event
          if (!eventInstance) {
            return res.send(404, 'No event found for id ' + id);
          }

          // Authentication
          if (!isEventOrganizer(req, eventInstance) &&
            !eventInstance.isCoorganizer(req.session.user && req.session.user.id)) {
            return res.send(403, 'You are not authorized to edit this event');
          }

          var coorganizersToCreate = associationsToCreate(
            eventInstance.id,
            updatedAttributes.coorganizers
          );

          var coorganizersToDelete = associationsToDelete(
            eventInstance.coorganizers,
            updatedAttributes.coorganizers
          );

          updateAssociations(eventInstance.mentors, updatedAttributes.mentors);

          var mentorsToDelete = associationsToDelete(
            eventInstance.mentors,
            updatedAttributes.mentors
          );

          var mentorRequestsToCreate = associationsToCreate(
            eventInstance.id,
            updatedAttributes.mentorRequests
          );

          var mentorRequestsToDelete = associationsToDelete(
            eventInstance.mentorRequests,
            updatedAttributes.mentorRequests
          );

          eventInstance
            .updateAttributes(updatedAttributes)
            .then(function () {
              if (coorganizersToCreate.length) {
                return db.coorg.bulkCreate(coorganizersToCreate);
              }
            })
            .then(function () {
              if (coorganizersToDelete.length) {
                return db.coorg.destroy({
                  id: { in : coorganizersToDelete
                  }
                });
              }
            })
            .then(function () {
              if (eventInstance.mentors.length) {
                return bPromise.all(
                  eventInstance.mentors.map(function (mentor) {
                    return mentor.save(['bio']);
                  })
                );
              }
            })
            .then(function () {
              if (mentorsToDelete.length) {
                return db.mentor.destroy({
                  id: { in : mentorsToDelete
                  }
                });
              }
            })
            .then(function () {
              if (mentorRequestsToCreate.length) {
                return db.mentorRequest.bulkCreate(mentorRequestsToCreate);
              }
            })
            .then(function () {
              if (mentorRequestsToDelete.length) {
                return db.mentorRequest.destroy({
                  id: { in : mentorRequestsToDelete
                  }
                });
              }
            })
            .then(function () {
              return storeTags(sanitizeTags(updatedAttributes.tags));
            })
            .then(function (tagDAOs) {
              eventInstance.setTags(tagDAOs);
              res.send('Event record updated');
            }, function fail(error) {
              console.error(error.stack);
              res.json(500, error);
            });
        })
        .error(function (err) {
          res.json(500, err);
        });
    },

    delete: function (req, res) {
      var id = req.params.id;

      db.event
        .find(id)
        .success(function (eventInstance) {

          // No event
          if (!eventInstance) {
            return res.send(404, 'No event found for id ' + id);
          }

          // Authentication
          if (!isEventOrganizer(req, eventInstance)) {
            return res.send(403, 'You are not authorized to edit this event');
          }

          // Destroy tag associations
          eventInstance.setTags([]);

          // Destroy event record
          eventInstance
            .destroy()
            .success(function (data) {
              hatchet.send('delete_event', {
                eventId: eventInstance.getDataValue('id'),
                userId: req.session.user.id,
                username: req.session.user.username,
                email: req.session.user.email,
                locale: req.session.user.prefLocale,
                sendEventCreationEmails: req.session.user.sendEventCreationEmails
              });

              res.send('Event deleted');
            })
            .error(function (err) {
              console.error(err.stack);
              res.json(500, err);
            });
        })
        .error(function (err) {
          console.error(err.stack);
          res.json(500, err);
        });
    }
  };

  return controller;

};
