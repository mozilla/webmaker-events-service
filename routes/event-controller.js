var hatchet = require('hatchet');
var jsonToCSV = require('../util/json-to-csv');
var _ = require('lodash');
var Promise = require('bluebird');

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
   * Turn full tag records into a simple array of strings
   * @param  {Array} tags Array of tag record objects
   * @return {Array}      Array of tags as Strings
   */

  function massageTags(tags) {
    tags.forEach(function (tag, index) {
      tags[index] = tag.name;
    });

    return tags;
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
      var emailsUsernames = [];

      instances.forEach(function (instance) {
        instance.EventId = event.id
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
      return typeof a.id === "undefined";
    }).map(function(a) {
      a.EventId = eventId;
      return a;
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
        var limit = req.query.limit || null;
        var order = req.query.order || 'beginDate';
        var organizerId = req.query.organizerId;
        var after = req.query.after;
        var dedupe = req.query.dedupe || false;

        var query = {};

        if (after) {
          if ((new Date(after)).toString() !== 'Invalid Date') {
            query.beginDate = {
              gte: new Date(after)
            };
          } else {
            res.statusCode = 500;
            res.json({
              error: 'Malformed after date'
            });
          }
        }

        if (organizerId) {
          query.organizerId = organizerId;
        }

        db.event
          .findAll({
            limit: limit,
            order: order,
            where: query,
            include: [{
              model: db.tag,
              attributes: ['name']
            }]
          })
          .success(function (data) {
            var dataCopy = JSON.parse(JSON.stringify(data));

            dataCopy.forEach(function (item, index) {
              // Only show emails for logged in admins to protect user privacy
              if (!req.session.user || !req.session.user.isAdmin) {
                delete dataCopy[index].organizer;
              }

              // Don't return deprecated values to client
              delete dataCopy[index].beginTime;
              delete dataCopy[index].endTime;

              dataCopy[index].tags = massageTags(dataCopy[index].tags);
            });

            // Don't return multiple events with the same title when dedupe is enabled
            if (dedupe) {
              dataCopy = _.uniq(dataCopy, 'title');
            }

            if (!req.query.csv) {
              res.json(dataCopy);
            } else {
              res.setHeader('Content-Type', 'text/csv');
              res.send(jsonToCSV(dataCopy));
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
              db.coorgRequest,
              db.mentor,
              db.mentorRequest,
              {
                model: db.tag,
                attributes: ['name']
              }
            ]
          })
          .then(function success(event) {
            if (!event) {
              return res.send(404);
            }

            event = _.merge(event, {
              tags: massageTags(event.tags)
            })

            if (!event.coorganizers.length &&
                !event.mentors.length) {
              return res.json(event);
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
                return res.send(500, "Couldn't find any user ids in login database");
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

              return res.json(event);
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
            db.coorgRequest,
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
              res.json = (500, err);
            });
        })
        .error(function (err) {
          res.json(500, err);
        });
    }
  };

};
