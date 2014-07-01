module.exports = (grunt) ->
  require('jit-grunt')(grunt)

  grunt.initConfig
    jshint:
      all: [
        "*.js"
        "models/**/*.js"
        "routes/**/*.js"
        "test/**/*.js"
        "util/**/*.js"
      ]
      options:
        jshintrc: ".jshintrc"

  grunt.registerTask "default", [
    "jshint"
  ]

  return
