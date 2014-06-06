# Webmaker Events Service

https://events-api.webmaker.org

This is a REST api service for Webmaker Events using Persona to authenticate requests.

## Development

```
npm install
cp .env-dist .env
node server
```

## You must also run...
[Webmaker Login Server](https://github.com/mozilla/login.webmaker.org)


## Configuration

Configuration is stored in `.env`.

<table>
<tr>
  <td>Option</td>
  <td>Default</td>
  <td>Description</td>
</tr>
<tr>
  <td><code>DEV</code></td>
  <td><code>false</code></td>
  <td>If <code>true</code>, fake database generation methods will be exposed as GET routes.</td>
</tr>

<tr>
  <td><code>PORT</code></td>
  <td><code>1989</code></td>
  <td>The port the server runs on.</td>
</tr>
<tr>
  <td><code>LOGIN_URL</code></td>
  <td><code>*</code></td>
  <td>URL for Webmaker Login server. You MUST  include this.</td>
</tr>
<tr>
  <td><code>ALLOWED_DOMAINS</code></td>
  <td><code>http://localhost:1981</code></td>
  <td>URL(s) webmaker-events front end. Comma-separated if more than one.</td>
</tr>
<tr>
  <td><code>SECRET</code></td>
  <td><code>secretsauce</code></td>
  <td>The secret key for signing session cookies.</td>
</tr>
<tr>
  <td><code>FORCE_SSL</code></td>
  <td><code>false</code></td>
  <td>Force SSL on cookies?</td>
</tr>
<tr>
  <td><code>COOKIE_DOMAIN</code></td>
  <td><code>undefined</code></td>
  <td>If you want to use supercookies, add the domain here.</td>
</tr>
<tr>
  <td><code>STORAGE</code></td>
  <td><code>events.sqlite</code></td>
  <td>If using sqlite, the name and location of the sqlite file.</td>
</tr>
<tr>
  <td><code>DB_DIALECT</code></td>
  <td><code>sqlite</code></td>
  <td>Can be sqlite or mysql</td>
</tr>
<tr>
  <td><code>DB_CONNECTIONSTRING</code></td>
  <td><code>undefined</code></td>
  <td>If defined, sequelize will use this to configure databse, username, password, etc.</td>
</tr>
<tr>
  <td><code>DB_HOST</code></td>
  <td><code>undefined</code></td>
  <td>If you are using mysql, database host, e.g. localhost</td>
</tr><tr>
  <td><code>DB_PORT</code></td>
  <td><code>3306</code></td>
  <td>If you are using mysql, database port</td>
</tr>
<tr>
  <td><code>DB_DATABASE</code></td>
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
<tr>
  <td><code>DB_CERT</code></td>
  <td><code>undefined</code></td>
  <td>Path to Amazon RDS CA certificate</td>
</tr>
</table>

## Database

The default location is `events.sqlite` in the root folder, but it can be configured by setting `STORAGE` in your `.env`

### Example event object
```
{
  "title": "My event",
  "description": "Blah blah blah...",
  "address": "15 Apple St.",
  "latitude": -4,
  "longitude": 101,
  "city": "Toronto",
  "country": "Canada",
  "attendees": 474,
  "beginDate": "2014-01-15T22:16:43.000Z",
  "endDate": null,
  "beginTime": null,
  "endTime": null,
  "registerLink": "https://something.com/register",
  "picture": null,
  "organizer": "misael@antonetta.tv",
  "organizerId": "Laney8",
  "featured": false,
  "tags": ["security", "pizza", "jeff goldblum"]
}
```
Responses also contain `id`, `createdAt`, and `updatedAt`, which are added/updated automatically.

## Migrations

If you need to migrate your existing database, first create a configuration file:

```
cp config/config.json.dist config/config.json
```

Edit `config/config.json` with your database credentials.

Next, run the sequelize migration tool:

```
node_modules/.bin/sequelize -m
```


### Existing database issues

For old data, that is data created from the previous events system,

* `city` and `country` are null in all cases
* `beginDate` `endDate` `beginTime` `endTime` contain redundancies, where times are just `1899-12-31` + time and dates are date + `00:00:00`

## Authentication

Protected routes require a user session to be set via Webmaker Login.


#### Request
```
POST /auth

{
  audience: {{ audience of persona token }},
  assertion: {{ valid persona token }}
}
```

#### Response
```
200 OK

{
  email: {{ verified persona email }},
  token: {{ token for protected routes }},
  admin: {{ true | false }}
}
```

## Routes

For protected routes, make sure you have a session set.

<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Path</th>
      <th>Query/Body</th>
      <th>Authentication required</th>
      <th>Description</th>
    </tr>
  </thead>
  <tr>
    <td><code>GET</code></td>
    <td>/events</td>
    <td>
      <code>limit</code> (Max array size. e.g. 30. Defaults to no limit.),
      <br>
      <code>order</code> (Sort order of returned array. e.g. 'beginDate DESC'. Defaults to 'beginDate')
      <br>
      <code>organizerId</code> (Constrain to events created by a user. e.g. 'mike_danton')
      <br>
      <code>after</code> (Return only events post-`after` time. Must be a string usable by `Date.parse`.)
      <br>
      <code>dedupe</code> (Only allow 1 event of per event title when set to `true`. Defaults to `false`.)
      <br>
      <code>csv</code> (Return results as CSV when set to `true`. Defaults to JSON.)
    </td>
    <td>No<br><br>Note: Only logged in admins will get user's email.</td>
    <td>Returns an array of events.</td>
  </tr>
  <tr>
    <td><code>GET</code></td>
    <td>/events/:id</td>
    <td></td>
    <td>No</td>
    <td>Returns a single event object where the id matches <code>:id</code></td>
  </tr>
  <tr>
    <td><code>POST</code></td>
    <td>/events</td>
    <td><code>{{event object}}</code></td>
    <td>Persona</td>
    <td>Creates a new event</td>
  </tr>
  <tr>
    <td><code>PUT</code></td>
    <td>/events/:id</td>
    <td><code>{{event object}}</code></td>
    <td>Persona</td>
    <td>Updates an event with id <code>:id</code> with the attributes specified in the body of the request.</td>
  </tr>
  <tr>
    <td><code>DELETE</code></td>
    <td>/events/:id</td>
    <td></td>
    <td>Persona</td>
    <td>Deletes an event with id <code>:id</code>.</td>
  </tr>
  <tr>
    <td><code>GET</code></td>
    <td>/dev/fake</td>
    <td><code>amount</code> (number of events, e.g. 15)</code></td>
    <td>DEV=true on server config</td>
    <td>Adds fake items to the db.</td>
  </tr>
</table>


## Deployment


```
heroku create webmaker-events-service
git push heroku master
```

To add a database:
``
heroku addons:add cleardb
``

### Heroku Configuration

If you don't already have the Heroku config plugin installed, do it now:

```
heroku plugins:install git://github.com/ddollar/heroku-config.git
```

 Now you can push up your .env config file like this:

```
heroku config:push --overwrite

```
