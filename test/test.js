var Habitat = require('habitat');
var should = require('should');
var supertest = require('supertest');

var Faker = require('../util/faker');
var faker = new Faker();

describe('faker', function() {

  it('should have event, invalidEvent and events methods', function(done) {
    should.exist(faker.event);
    should.exist(faker.invalidEvent);
    should.exist(faker.events);
    done();
  });

  it('should generate a valid event', function(done) {
    var e = faker.event();
    (e).should.be.an.Object;
    done();
  });

  it('should generate an invalid event', function(done) {
    var e = faker.invalidEvent();
    (e).should.be.an.Object;
    done();
  });

  it('should generate a list of events of length 7', function(done) {
    var length = 7;
    var eArray = faker.events(length);
    (eArray).should.be.an.Array.and.have.property('length', 7);
    done();
  });

});

describe('app', function() {

  // TODO: Re-run the server every time with a fresh db so no state problems occur
  // Server and db config
  Habitat.load('.env-test');
  var env = new Habitat();
  var db = require('../models')({
    db: env.get('DB_NAME'),
    user: env.get('DB_USER'),
    password: env.get('DB_PASSWORD'),
    storage: env.get('STORAGE')
  });
  var app = require('../config')(env, db);
  var server;
  require('../routes')(env, app, db);

  before(function(done) {
    // Run server
    server = app.listen(env.get('port'), function(err) {
      if (err) {
        done(err);
      } else {
        done();
      }
    });
  });

  after(function(done) {
    if (server.close) {
      server.close(function() {
        done();
      });
    }
  });

  it('should exist', function(done) {
    should.exist(app);
    done();
  });

  it('should create some fake events', function() {
    supertest(app)
      .get('/dev/fake?amount=10')
      .expect(200)
      .end(function(err) {
        if (err) {
          throw err;
        }
      });
  });

  it('should return events from GET /events', function() {
    supertest(app)
      .get('/events')
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err) {
        if (err) {
          throw err;
        }
      });
  });

  it('should return the first event from /events/1', function() {
    supertest(app)
      .get('/events/1')
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err) {
        if (err) {
          throw err;
        }
      });
  });

  it('should create a valid event', function() {
    var newEvent = faker.event();
    supertest(app)
      .post('/events')
      .send(newEvent)
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err) {
        if (err) {
          throw err;
        }
      });
  });

  it('should get an error when creating an invalid event', function() {
    var badEvent = faker.invalidEvent();
    supertest(app)
      .post('/events')
      .send(badEvent)
      .set('Accept', 'application/json')
      .expect(500)
      .end(function(err, res) {
        if (err) {
          throw err;
        }
        var validationErrors = res.body;
        (validationErrors).should.have.property('latitude');
      });
  });

  it('should update an event', function() {
    var newEvent = faker.event();
    supertest(app)
      .put('/events/1')
      .send(newEvent)
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res) {
        console.log(err, res.body);
        if (err) {
          throw err;
        }
      });
  });

  it('should delete an event', function() {
    supertest(app)
      .del('/events/7')
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res) {
        if (err) {
          throw err;
        }
      });
  });

  it('should return a 404 when an event is not found', function() {
    supertest(app)
      .del('/events/10000')
      .set('Accept', 'application/json')
      .expect(404)
      .end(function(err, res) {
        if (err) {
          throw err;
        }
      });
  });


});
