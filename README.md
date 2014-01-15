Development
============
```
npm install
cp .env-dist .env // For configuration
node server
```

Configuration
============

Configuration is stored in `.env`.

<table>
<tr>
  <td>`PORT`</td>
  <td>`1989`</td>
  <td>The port the server runs on.</td>
</tr>
<tr>
  <td>`STORAGE`</td>
  <td>`events.sqlite`</td>
  <td>The name and location of the sqlite file.</td>
</tr>
<tr>
  <td>`DEV`</td>
  <td>`false`</td>
  <td>If `true`, fake database generation methods will be exposed as `GET` routes.</td>
</tr>
<tr>
  <td>`DB_NAME`</td>
  <td>`undefined`</td>
  <td>Database name</td>
</tr>
<tr>
  <td>`DB_USER`</td>
  <td>`undefined`</td>
  <td>Database user</td>
</tr>
<tr>
  <td>`DB_PASSWORD`</td>
  <td>`undefined`</td>
  <td>Database password</td>
</tr>




Database
============
The database currently uses squlite. The default location is `events.sqlite` in the root folder, but it can be configured by setting `STORAGE` in your `.env`


Routes
============

`GET /dev/fake` -- Adds a fake item to the db

`GET /events`
```
{
  limit: {{a limit}}
}
```

`GET /events/:id`

`POST /events`
`{event object}`

`PUT /events/:id`
`{updated attributes}`

`DELETE /events/:id`



Deployment
===========

```
heroku create webmaker-events-service
git push heroku master
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
