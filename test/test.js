/*global it: false, describe: false, before: false, after: false */

var Habitat = require('habitat');
var should = require('should');
var supertest = require('supertest');

var Faker = require('../util/faker');
var faker = new Faker();

describe('faker', function () {
  it('should have event, invalidEvent and events methods', function (done) {
    should.exist(faker.event);
    should.exist(faker.invalidEvent);
    should.exist(faker.events);
    done();
  });

  it('should generate a valid event', function (done) {
    var e = faker.event();
    (e).should.be.type('object');
    done();
  });

  it('should generate an invalid event', function (done) {
    var e = faker.invalidEvent();
    (e).should.be.type('object');
    done();
  });

  it('should generate a list of events of length 7', function (done) {
    var length = 7;
    var eArray = faker.events(length);
    (eArray).should.be.an.Array.and.have.property('length', 7);
    done();
  });
});

// TODO: Test mysql, connection string options for models

describe('app', function () {
  // TODO: Re-run the server every time with a fresh db so no state problems occur
  // Server and db config
  Habitat.load('.env-test');
  var env = new Habitat();
  var app;
  var server;

  var dbConfig = {
    db: env.get('DB_NAME'),
    user: env.get('DB_USER'),
    password: env.get('DB_PASSWORD'),
    storage: env.get('STORAGE')
  };

  var userClient = new(require('webmaker-user-client'))({
    endpoint: env.get('LOGIN_URL_WITH_AUTH')
  });

  before(function (done) {
    var self = this;
    var db = require('../models')(dbConfig, env.get('EVENTS_FRONTEND_URL'), userClient, function (err) {
      if (err) {
        return done(err);
      }
      app = require('../config')(env, db);
      var Session = require('supertest-session')({
        app: app
      });
      require('../routes')(env, app, db);
      // Run server
      self.session = new Session();
      server = app.listen(env.get('port'), function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
    });
  });

  after(function (done) {
    this.session.destroy();
    if (server.close) {
      server.close(function () {
        done();
      });
    }
  });

  it('should exist', function (done) {
    should.exist(app);
    done();
  });

  it('should create some fake events', function (done) {
    supertest(app)
      .get('/dev/fake?amount=10')
      .expect(200)
      .end(function (err) {
        if (err) {
          return done(err);
        }
        done();
      });
  });

  it('should return events from GET /events', function (done) {
    supertest(app)
      .get('/events')
      .set('Accept', 'application/json')
      .expect(200)
      .end(function (err, res) {
        if (err) {
          return done(err);
        }
        done();
      });
  });

  it('should return the first event from /events/1', function (done) {
    supertest(app)
      .get('/events/1')
      .set('Accept', 'application/json')
      .expect(200)
      .end(function (err) {
        if (err) {
          return done(err);
        }
        done();
      });
  });

  it('should login', function (done) {
    this.session
      .get('/dev/session')
      .set('Accept', 'application/json')
      .expect(200)
      .end(function (err) {
        // session should be set
        if (err) {
          return done(err);
        }
        done();
      });
  });

  it('should create a valid event', function (done) {
    var newEvent = faker.event();
    this.session
      .post('/events')
      .send(newEvent)
      .set('Accept', 'application/json')
      .expect(200)
      .end(function (err) {
        if (err) {
          return done(err);
        }
        done();
      });
  });

  it('should get an error when creating an invalid event', function (done) {
    var badEvent = faker.invalidEvent();
    this.session
      .post('/events')
      .send(badEvent)
      .set('Accept', 'application/json')
      .expect(500)
      .end(function (err, res) {
        if (err) {
          return done(err);
        }
        var validationErrors = res.body.error;
        (validationErrors).should.have.property('latitude');
        done();
      });
  });

  it('should login as admin', function (done) {
    this.session
      .get('/dev/session?isAdmin=true')
      .set('Accept', 'application/json')
      .expect(200)
      .end(function (err) {
        // session should be set
        if (err) {
          return done(err);
        }
        done();
      });
  });

  it('should update an event', function (done) {
    var newEvent = faker.event();
    this.session
      .put('/events/1')
      .send(newEvent)
      .set('Accept', 'application/json')
      .expect(200)
      .end(function (err) {
        if (err) {
          return done(err);
        }
        done();
      });
  });

  it('should delete an event', function (done) {
    this.session
      .del('/events/7')
      .set('Accept', 'application/json')
      .expect(200)
      .end(function (err, res) {
        if (err) {
          return done(err);
        }
        done();
      });
  });

  it('should return a 404 when an event is not found', function (done) {
    this.session
      .del('/events/10000')
      .set('Accept', 'application/json')
      .expect(404)
      .end(function (err, res) {
        if (err) {
          return done(err);
        }
        done();
      });
  });

  it('should return the related event (username)', function (done) {
    var eventSettings = {
      organizerId: 'username'
    };

    var event1 = faker.event(eventSettings),
      event2 = faker.event(eventSettings),
      self = this;

    function errFn(err) {
      if (err) {
        return done(err);
      }
    }

    this.session
      .post('/events')
      .send(event1)
      .set('Accept', 'application/json')
      .expect(200)
      .expect(function (event1resp) {
        self.session
          .post('/events')
          .send(event2)
          .set('Accept', 'application/json')
          .expect(200)
          .expect(function (event2resp) {
            self.session
              .get('/events/' + event1resp.body.id + '/related')
              .set('Accept', 'application/json')
              .expect(200)
              .expect(function (related) {
                if (!related.body || related.body[0].id !== event2resp.body.id) {
                  return new Error('The related event ID should match the expected value');
                }
                return;
              }).end(function (err) {
                if (err) {
                  return done(err);
                }
                done();
              });
            return;
          })
          .end(errFn);
        return;
      }).end(errFn);
  });

  it('should return the related event (geographically)', function (done) {
    var eventSettings = {
      lat: 56,
      lng: 134
    };

    var event1 = faker.event(eventSettings),
      event2 = faker.event(eventSettings),
      self = this;

    function errFn(err) {
      if (err) {
        return done(err);
      }
    }

    this.session
      .post('/events')
      .send(event1)
      .set('Accept', 'application/json')
      .expect(200)
      .expect(function (event1resp) {
        self.session
          .post('/events')
          .send(event2)
          .set('Accept', 'application/json')
          .expect(200)
          .expect(function (event2resp) {
            self.session
              .get('/events/' + event1resp.body.id + '/related')
              .set('Accept', 'application/json')
              .expect(200)
              .expect(function (related) {
                if (!related.body || related.body[0].id !== event2resp.body.id) {
                  return new Error('The related event ID should match the expected value');
                }
                return;
              }).end(function (err) {
                if (err) {
                  return done(err);
                }
                done();
              });
            return;
          })
          .end(errFn);
        return;
      }).end(errFn);
  });

  it('should return the related event (tags)', function (done) {
    var eventSettings = {
      tags: ['html']
    };

    var event1 = faker.event(eventSettings),
      event2 = faker.event(eventSettings),
      self = this;

    function errFn(err) {
      if (err) {
        return done(err);
      }
    }

    this.session
      .post('/events')
      .send(event1)
      .set('Accept', 'application/json')
      .expect(200)
      .expect(function (event1resp) {
        self.session
          .post('/events')
          .send(event2)
          .set('Accept', 'application/json')
          .expect(200)
          .expect(function (event2resp) {
            self.session
              .get('/events/' + event1resp.body.id + '/related')
              .set('Accept', 'application/json')
              .expect(200)
              .expect(function (related) {
                if (!related.body || related.body[0].id !== event2resp.body.id) {
                  return new Error('The related event ID should match the expected value');
                }
                return;
              }).end(function (err) {
                if (err) {
                  return done(err);
                }
                done();
              });
            return;
          })
          .end(errFn);
        return;
      }).end(errFn);
  });
});
