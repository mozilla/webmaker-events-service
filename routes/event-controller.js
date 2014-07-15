var hatchet = require('hatchet');
var json2csv = require('json2csv');
var _ = require('lodash');
var Promise = require('bluebird');
var Sequelize = require('sequelize');

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
    return new Promise(function (resolve, reject) {
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
    return new Promise(function (resolve, reject) {
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
    return values.filter(function(a) {
      return typeof a.id === 'undefined';
    }).map(function(a) {
      a.EventId = eventId;
      return a;
    });
  }

  function updateAssociations(oldValues, updatedValues) {
    return oldValues.map(function(old) {
      var update = updatedValues.filter(function(update) {
        return old.id === update.id;
      })[0];

      if (!update) {
        return old;
      }

      Object.keys(old.values).forEach(function(key) {
        old[key] = update[key];
      });

      return old;
    });
  }

  function associationsToDelete(events, newValues) {
    return events.filter(function(event) {
      return !newValues.some(function(nvalue) {
        return event.id === nvalue.id;
      });
    }).map(function(event) {
      return event.id;
    });
  }

  // Check if a user has write access to an event.

  function isEventOrganizer(req, eventInstance) {
    return (req.session.user && req.devAdmin) ||
           (req.session.user && req.session.user.isAdmin) ||
           (req.session.user && eventInstance.organizer === req.session.user.email);
  }

  return {

    get: {
      all: function (req, res) {
        var order = req.query.order || 'beginDate';
        var organizerId = req.query.organizerId;
        var userId = req.query.userId;
        var after = req.query.after;
        var dedupe = req.query.dedupe || false;
        var tagFilter = req.query.tag || null;
        var searchTerm = req.query.search || false;

        var query = {};
        var limit;
        var rangeStart;
        var rangeEnd;

        if (after) {
          if ((new Date(after)).toString() !== 'Invalid Date') {
            query.beginDate = {
              gte: new Date(after)
            };
          } else {
            return res.json( 500, {
              error: 'Malformed after date'
            });
          }
        }

        if (organizerId) {
          query.organizerId = organizerId;
        }

        if (searchTerm) {
          query = Sequelize.and(
            query,
            Sequelize.or({
              title: {like: '%' + searchTerm +'%'}
            }, {
              description: {like: '%' + searchTerm +'%'}
            }, {
              address: {like: '%' + searchTerm + '%'}
            })
          );
        }

        if (organizerId && userId) {
          query = Sequelize.and(
            query,
            Sequelize.or(
              { organizerId: organizerId },
              { 'Mentors.userId': userId },
              { 'Coorganizers.userId': userId }
            )
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

        db.event
          .findAndCountAll({
            offset: rangeStart || null,
            limit: limit || null,
            // need to wrap order in an array because of a sequelize v1.7.x bug
            // https://github.com/sequelize/sequelize/issues/1596#issuecomment-39698213
            order: [order],
            where: query,
            include: [
              db.coorg,
              db.mentor,
              {
                model: db.tag,
                attributes: ['name']
              }
            ]
          })
          .success(function (events) {
            // Don't return multiple events with the same title when dedupe is enabled
            if (dedupe) {
              events.rows = _.uniq(events.rows, 'title');
            }

            var publicData = _.invoke(events.rows, 'toFilteredJSON', true);

            if (!req.query.csv) {
              var contentRange = req.headers.range + '/' + events.count;

              // Headers for pagination
              res.header('Accept-Ranges', 'items');
              res.header('Range-Unit', 'items');
              res.header('Content-Range', contentRange);

              res.json(publicData);
            } else {
              json2csv({data: publicData, fields: ['id', 'title', 'description', 'address', 'latitude', 'longitude', 'city', 'country', 'attendees', 'beginDate', 'endDate', 'registerLink', 'organizer', 'organizerId', 'createdAt', 'updatedAt', 'areAttendeesPublic', 'ageGroup', 'skillLevel', 'isEmailPublic', 'externalSource', 'coorganizers', 'mentors', 'tags']}, function (err, csv) {
                if (err) {
                  res.send(500, err);
                } else {
                  res.type('text/csv');
                  res.send(csv);
                }
              });
            }

          })
          .error(function (err) {
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
              db.mentor,
              {
                model: db.mentorRequest,
                attributes: ['id', 'email', 'denied', 'EventId']
              },
              {
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
                event.isCoorganizer(req.session.user && req.session.user.id))

            if (!event.coorganizers.length &&
                !event.mentors.length) {
              return res.json(event.toFilteredJSON(showPrivateData));
            }

            // Pull out userIds from coorganizers and mentors
            var userIds = event.coorganizers.map(function(c) {
              return c.userId;
            }).concat(event.mentors.map(function(m) {
              return m.userId;
            }));

            // Get user data for each userId
            userClient.get.byIds(userIds, function(err, users) {
              if (err) {
                return res.send(500, err.toString());
              }
              if (!users || !Array.isArray(users.users)) {
                return res.send(500, 'Couldn\'t find any user ids in login database');
              }

              var usersById = {};
              users.users.forEach(function(u) {
                usersById[u.id] = u;
              });

              event.coorganizers.forEach(function(c) {
                var user = usersById[c.userId];
                if (!user) {
                  return;
                }
                c._username = user.username;
                c._avatar = user.avatar;
              });
              event.mentors.forEach(function(m) {
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
        .catch(function(err) {
          console.log(err.stack);
          res.json(500, {
            error: err.toString()
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
            .then(function() {
              if (coorganizersToCreate.length) {
                return db.coorg.bulkCreate(coorganizersToCreate);
              }
            })
            .then(function() {
              if (coorganizersToDelete.length) {
                return db.coorg.destroy({ id: { in: coorganizersToDelete } });
              }
            })
            .then(function() {
              if (eventInstance.mentors.length) {
                return Promise.all(
                  eventInstance.mentors.map(function(mentor) {
                    return mentor.save(['bio']);
                  })
                );
              }
            })
            .then(function() {
              if (mentorsToDelete.length) {
                return db.mentor.destroy({ id: { in: mentorsToDelete } });
              }
            })
            .then(function() {
              if (mentorRequestsToCreate.length) {
                return db.mentorRequest.bulkCreate(mentorRequestsToCreate);
              }
            })
            .then(function() {
              if (mentorRequestsToDelete.length) {
                return db.mentorRequest.destroy({ id: { in: mentorRequestsToDelete } });
              }
            })
            .then(function () {
              return storeTags(updatedAttributes.tags);
            })
            .then(function (tagDAOs) {
              eventInstance.setTags(tagDAOs);
              res.send('Event record updated');
            }, function fail(error) {
              console.log(error.stack);
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
              res.json(500, err);
            });
        })
        .error(function (err) {
          res.json(500, err);
        });
    }
  };

};
