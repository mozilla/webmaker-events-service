module.exports = (grunt) ->
  require('jit-grunt')(grunt)

  jsFiles = [
    "**/*.js"
    "!node_modules/**/*.js"
  ]

  grunt.initConfig
    jshint:
      all: jsFiles
      options:
        jshintrc: ".jshintrc"
    jsbeautifier:
      modify:
        src: jsFiles
        options:
          config: ".jsbeautifyrc"

      validate:
        src: jsFiles
        options:
          mode: "VERIFY_ONLY"
          config: ".jsbeautifyrc"

  grunt.registerTask "default", [
    "jshint"
    "jsbeautifier:validate"
  ]

  grunt.registerTask "clean", [
    "jshint"
    "jsbeautifier:modify"
  ]

  return
