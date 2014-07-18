module.exports = function () {
  var self = this;

  // Export Faker
  var faker = self.faker = require('faker');

  // Generate a single event
  self.event = function () {
    return {
      title: faker.Company.bs(),
      description: faker.Lorem.paragraph(),
      address: faker.Address.streetAddress(),
      latitude: faker.Helpers.randomNumber(-90.0, 90.0),
      longitude: faker.Helpers.randomNumber(-180.0, 180.0),
      city: faker.Address.city(),
      beginDate: new Date(2015, Math.random() * 12, Math.random() * 28),
      country: faker.Name.firstName() + 'land',
      attendees: faker.Helpers.randomNumber(500),
      registerLink: 'https://' + faker.Internet.domainName() + '/eventpage',
      organizer: faker.Internet.email(),
      organizerId: faker.Name.firstName() + faker.Helpers.randomNumber(100),
      featured: false,
      ageGroup: (['', 'kids', 'youth', 'adults'])[Math.floor(Math.random() * 4)],
      skillLevel: (['', 'beginner', 'intermediate', 'advanced'])[Math.floor(Math.random() * 4)],
      areAttendeesPublic: Math.random() > 0.5 ? true : false,
      isEmailPublic: Math.random() > 0.5 ? true : false
    };
  };

  // Generate a single invalid event
  self.invalidEvent = function () {
    return {
      title: 'Invalid Event',
      beginDate: 'This is not a valid date',
      latitude: 'This is not a valid latitude'
    };
  };

  // Generate an array of valid fake events of length n
  self.events = function (n) {
    var events = [];
    for (var i = 0; i < n; i++) {
      events.push(self.event());
    }
    return events;
  };

};
