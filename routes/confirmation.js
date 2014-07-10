module.exports = function (db, userClient) {
  return {
    update: function (req, res, next) {
      var confirmed = req.body.confirmation === 'yes';
      var token = req.params.token;

      // Error handling
      function onError(err) {
        return next(err);
      }

      // Look up user, then add new mentor, then delete mentor request
      function convertRequestToMentor(mentorRequest) {
        userClient.get.byEmail(mentorRequest.email, function (err, user) {
          if (err) {
            return next(err);
          }

          db.mentor
            .create({
              // Use the session, in case the email is different
              userId: req.session.user.id,
              EventId: mentorRequest.EventId
            })
            .success(function (mentor) {
              mentorRequest.destroy()
                .success(function () {
                  return res.send(mentor);
                })
                .error(onError);
            })
            .error(onError);
        });
      }

      db.mentorRequest
        .find({ where: { token: token } })
        .success( function (mentorRequest) {
          if (confirmed) {
            convertRequestToMentor(mentorRequest);
          } else {
            db.mentorRequest
              .update({ denied: true })
              .success(function () {
                return res.send('Mentor denied request');
              })
              .error(onError);
          }
        })
        .error(onError);

    },
    verify: function(req, res, next) {
      var token = req.params.token;
      var eventId = req.query.eventId;

      if ( !eventId ) {
        return res.json(400, {"error": "eventId param is required"});
      }

      db.mentorRequest
        .find({
          where: {
            token: token,
            eventId: eventId
          }
        })
        .success( function(mentorRequest) {
          return res.json({ valid: !!mentorRequest });
        })
        .error( function(err) {
          next(err);
        });
    }
  };
};
