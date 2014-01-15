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
  <td><code>PORT</code></td>
  <td><code>1989</code></td>
  <td>The port the server runs on.</td>
</tr>
<tr>
  <td><code>STORAGE</code></td>
  <td><code>events.sqlite</code></td>
  <td>The name and location of the sqlite file.</td>
</tr>
<tr>
  <td><code>DEV</code></td>
  <td><code>false</code></td>
  <td>If <code>true</code>, fake database generation methods will be exposed as `GET` routes.</td>
</tr>
<tr>
  <td><code>DB_NAME</code></td>
  <td><code>undefined</code></td>
  <td>Database name</td>
</tr>
<tr>
  <td><code>DB_USER</code></td>
  <td><code>undefined</code></td>
  <td>Database user</td>
</tr>
<tr>
  <td><code>DB_PASSWORD</code></td>
  <td><code>undefined</code></td>
  <td>Database password</td>
</tr>
</table>



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
