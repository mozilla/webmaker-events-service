var hatchet = require('hatchet');
var json2csv = require('json2csv');
var _ = require('lodash');
var bPromise = require('bluebird');
var Sequelize = require('sequelize');

module.exports = function (db, userClient) {

  var COUNT_SQL_QUERY = 'SELECT COUNT(DISTINCT(`Event`.`id`)) AS `COUNT` FROM `Events` AS `Event` ' +
    'LEFT OUTER JOIN `Coorganizers` AS `Coorganizers` ON `Event`.`id` = `Coorganizers`.`EventId` ' +
    'LEFT OUTER JOIN `Mentors` AS `Mentors` ON `Event`.`id` = `Mentors`.`EventId` ' +
    'LEFT OUTER JOIN `EventsTags` AS `Tags.EventsTag` ON `Event`.`id` = `Tags.EventsTag`.`EventId` ' +
    'LEFT OUTER JOIN `Tags` AS `Tags` ON `Tags`.`id` = `Tags.EventsTag`.`TagId` WHERE ';

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

  var controller = {

    get: {
      csv: function (req, res) {
        req.query.csv = true;
        controller.get.all(req, res);
      },
      all: function (req, res) {
        var order = [
          ['beginDate', 'ASC']
        ];

        var username = req.query.username;
        var after = req.query.after;
        var before = req.query.before;
        var dedupe = req.query.dedupe || false;
        var tagFilter = req.query.tag || null;
        var searchTerm = req.query.search || false;
        var lat = req.query.lat;
        var lng = req.query.lng;
        var radius = req.query.radius;

        var query = {};
        var eventCount;
        var limit;
        var boundingCoordinates;
        var rangeStart;
        var rangeEnd;
        var beforeDate;
        var afterDate;

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
          query.beginDate = {
            lte: beforeDate,
            gte: afterDate
          };
        } else if (beforeDate) {
          query.beginDate = {
            lte: beforeDate
          };
        } else if (afterDate) {
          query.beginDate = {
            gte: afterDate
          };
        }

        if (lat && lng && radius) {
          if (radius <= 0) {
            radius = 100;
            // Arbitrary number, can be removed/changed
          } else if (radius >= 2000) {
            radius = 2000;
          }

          boundingCoordinates = getBoundingCoordinates(+lat, +lng, +radius);

          query.latitude = {
            between: [boundingCoordinates.minLat, boundingCoordinates.maxLat]
          };

          query.longitude = {
            between: [boundingCoordinates.minLng, boundingCoordinates.maxLng]
          };
        }

        if (searchTerm) {
          query = Sequelize.and(
            query,
            Sequelize.or({
              title: {
                like: '%' + searchTerm + '%'
              }
            }, {
              description: {
                like: '%' + searchTerm + '%'
              }
            }, {
              address: {
                like: '%' + searchTerm + '%'
              }
            })
          );
        }

        if (tagFilter) {
          query['Tags.name'] = tagFilter;
        }

        // Parse out numerical ranges from "range" header
        if (req.headers.range) {
          rangeStart = parseInt(req.headers.range.split('-')[0], 10);
          rangeEnd = parseInt(req.headers.range.split('-')[1], 10);

          limit = rangeEnd - rangeStart + 1;
        }

        (username ? userClient.get.byUsernameAsync(username) : bPromise.resolve())
          .then(function (userData) {
            if (userData) {
              var userID = userData.user.id;

              query = Sequelize.and(
                query,
                Sequelize.or({
                  organizerId: username
                }, {
                  'Mentors.userId': userID
                }, {
                  'Coorganizers.userId': userID
                })
              );
            }

            // We cannot use count() or findAndCountAll() because they aren't able to apply the distinct function to the column being counted.
            // This is fixed on their master branch, and should ship with Sequelize v2.0.0
            // Sequelize Issue: https://github.com/sequelize/sequelize/issues/1773
            return db.sequelize.query(COUNT_SQL_QUERY + db.sequelize.queryInterface.QueryGenerator.getWhereConditions(query));
          })
          .then(function (data) {
            eventCount = data[0].COUNT;
            return db.event.findAll({
              offset: rangeStart || null,
              limit: limit || null,
              // need to wrap order in an array because of a sequelize v1.7.x bug
              // https://github.com/sequelize/sequelize/issues/1596#issuecomment-39698213
              order: order,
              where: query,
              include: [
                db.coorg,
                db.mentor, {
                  model: db.tag,
                  attributes: ['name']
                }
              ]
            });
          })
          .then(function (events) {

            // Don't return multiple events with the same title when dedupe is enabled
            if (dedupe) {
              events = _.uniq(events, 'title');
            }

            var publicData = _.invoke(events, 'toFilteredJSON', true);

            if (!req.query.csv) {

              // Headers for pagination
              if (req.headers.range) {
                res.header('Accept-Ranges', 'items');
                res.header('Range-Unit', 'items');
                res.header('Content-Range', req.headers.range + '/' + eventCount);
              }

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

            userIds.push(event.organizerId);

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

              event.organizerUsername = usersById[event.organizerId];

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

      var event_data = req.body;

      userClient.get.byUsername(event_data.organizerUsername, function (err, data) {
        if (err) {
          return res.send(500, err.toString());
        }
        if (!data || !data.user) {
          return res.send(500, 'Couldn\'t find organizer with that name');
        }

        event_data.organizerId = data.user.id;
        delete event_data.organizerUsername;

        db.event.create(event_data)
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
