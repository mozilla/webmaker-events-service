module.exports = function (sequelize, t) {
  var defaultGravatar = encodeURIComponent('https://stuff.webmaker.org/avatars/webmaker-avatar-200x200.png');
  var _ = require('lodash');
  var md5 = require('MD5');
  var langmap = require('langmap');
  var publicFields = [
    'organizerAvatar',
    'id',
    'title',
    'description',
    'address',
    'latitude',
    'longitude',
    'city',
    'country',
    'estimatedAttendees',
    'ageGroup',
    'skillLevel',
    'beginDate',
    'endDate',
    'registerLink',
    'picture',
    'organizerId',
    'featured',
    'areAttendeesPublic',
    'createdAt',
    'updatedAt',
    'coorganizers',
    'mentors',
    'tags',
    'flickrTag',
    'makeApiTag',
    'isEventPublic',
    'locale'
  ];

  return sequelize.define('Event', {
    title: t.STRING,
    description: {
      type: t.TEXT,
      allowNull: false,
      defaultValue: ''
    },
    address: t.STRING,
    latitude: {
      type: t.FLOAT,
      validate: {
        isFloat: true,
        min: -90.0,
        max: 90.0
      },
      allowNull: true,
      defaultValue: null
    },
    longitude: {
      type: t.FLOAT,
      validate: {
        isFloat: true,
        min: -180.0,
        max: 180.0
      },
      allowNull: true,
      defaultValue: null
    },
    city: t.STRING,
    country: t.STRING,
    estimatedAttendees: t.INTEGER,
    ageGroup: {
      type: t.STRING,
      validate: {
        isIn: [
          ['', 'kids', 'youth', 'adults']
        ]
      }
    },
    skillLevel: {
      type: t.STRING,
      validate: {
        isIn: [
          ['', 'beginner', 'intermediate', 'advanced']
        ]
      }
    },
    beginDate: {
      type: t.DATE,
      allowNull: true,
      defaultValue: null
    },
    endDate: {
      type: t.DATE,
      allowNull: true,
      defaultValue: null
    },
    beginTime: {
      type: t.DATE,
      allowNull: true,
      defaultValue: null
    },
    endTime: {
      type: t.DATE,
      allowNull: true,
      defaultValue: null
    },
    registerLink: {
      type: t.STRING,
      validate: {
        isUrl: true
      },
      allowNull: true,
      defaultValue: null
    },
    picture: {
      type: t.STRING,
      validate: {
        isUrl: true
      },
      allowNull: true,
      defaultValue: null
    },
    organizer: {
      type: t.STRING,
      validate: {
        isEmail: true
      }
    },
    organizerId: t.STRING,
    featured: {
      type: t.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    areAttendeesPublic: {
      type: t.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    isEmailPublic: {
      type: t.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    isEventPublic: {
      type: t.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    externalSource: {
      type: t.STRING,
      defaultValue: null
    },
    url: {
      type: t.STRING,
      defaultValue: null,
      get: function () {
        return this.getDataValue('url') || '/events/' + this.getDataValue('id');
      }
    },
    flickrTag: {
      type: t.STRING,
      defaultValue: null
    },
    makeApiTag: {
      type: t.STRING,
      defaultValue: null
    },
    locale: {
      type: t.STRING,
      defaultValue: null,
      allowNull: true,
      validate: {
        isIn: [
          Object.keys(langmap)
        ]
      }
    },
    sentPostEventEmailToHost: {
      type: t.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    getterMethods: {
      organizerAvatar: function () {
        return 'https://secure.gravatar.com/avatar/' +
          md5(this.getDataValue('organizer')) +
          '?d=' + defaultGravatar;
      }
    },
    instanceMethods: {
      isCoorganizer: function (userId) {
        return this.coorganizers.some(function (c) {
          return c.userId === userId;
        });
      },
      toFilteredJSON: function (showPrivate) {
        // This is gross but necessary:
        // http://stackoverflow.com/questions/24431213/#comment37831440_24431213
        var event = JSON.parse(JSON.stringify(this));

        // return tags as ["a"] instead of [{"name": "a"}]
        event.tags = _.pluck(event.tags, 'name');

        // Filter out any duplicate tags leftover from when mixed case tags were allowed
        // eg: don't allow both `css` and `CSS` to co-exist

        var lowercasedTags = event.tags.map(function (tag) {
          return tag.toLowerCase();
        });

        event.tags = _.uniq(lowercasedTags);

        if (!showPrivate) {
          return _.pick(event, publicFields);
        }

        return event;
      }
    }
  });
};
