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
        jshintrc: "node_modules/mofo-style/linters/.jshintrc"
    jsbeautifier:
      modify:
        src: jsFiles
        options:
          config: "node_modules/mofo-style/linters/.jsbeautifyrc"

      validate:
        src: jsFiles
        options:
          mode: "VERIFY_ONLY"
          config: "node_modules/mofo-style/linters/.jsbeautifyrc"

  grunt.registerTask "default", [
    "jshint"
    "jsbeautifier:validate"
  ]

  grunt.registerTask "clean", [
    "jshint"
    "jsbeautifier:modify"
  ]

  return
