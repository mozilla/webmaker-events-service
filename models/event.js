module.exports = function(sequelize, t) {

  var defaultGravatar = encodeURIComponent('https://stuff.webmaker.org/avatars/webmaker-avatar-44x44.png');
  var md5 = require('MD5');

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
        max: 90.0,
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
      defaultValue: null,
    },
    city: t.STRING,
    country: t.STRING,
    attendees: t.INTEGER,
    ageGroup: {
      type: t.STRING,
      validate: {
        isIn: [['', 'kids', 'youth', 'adults']]
      }
    },
    skillLevel: {
      type: t.STRING,
      validate: {
        isIn: [['', 'beginner', 'intermediate', 'advanced']]
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
    organizerAvatar: {
      type: t.STRING,
      get: function() {
        return 'https://secure.gravatar.com/avatar/' +
                md5(this.getDataValue('organizer')) +
                '?s=100&d=' + defaultGravatar;
      }
    },
    featured: {
      type: t.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    areAttendeesPublic: {
      type: t.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    instanceMethods: {
      isCoorganizer: function(userId) {
        return this.coorganizers.some(function(c) {
          return c.userId === userId;
        });
      }
    }
  });
};
