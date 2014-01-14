Development
============
```
npm install
cp env.dist .env
grunt
node app // or, grunt nodemon
```

Deployment
===========

Use the nodejs-grunt buildpack:
```
heroku create webmaker-events-service --buildpack https://github.com/mbuchetics/heroku-buildpack-nodejs-grunt
git push heroku master
```
You can always set the buildpack config variable separately:
```
heroku config:add BUILDPACK_URL=https://github.com/mbuchetics/heroku-buildpack-nodejs-grunt.git
```

Configuration
=============

If you don't already have the Heroku config plugin installed, do it now:

```
heroku plugins:install git://github.com/ddollar/heroku-config.git
```

 Now you can push up your .env config file like this:

```
heroku config:push --overwrite

```
