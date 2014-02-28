/*
 * slugshover
 * http://github.com/Damiya/slugshover/
 *
 * Copyright (c) 2014 Kate von Roeder
 * Licensed under the MIT license.
 */

'use strict';

var Heroku = require('heroku-client'),
  heroku = new Heroku({ token: process.env.HEROKU_API_TOKEN });
var fs = require('fs');
var Q = require('q');
var util = require('util');
var url = require('url');
var argv = require('minimist')(process.argv.slice(2));

var httpSync = require('http-sync');

var projectName = argv.project;
var artifactName = argv.artifact;

var app = heroku.apps(projectName);

var slugInfo = {};

var getSlugInfo = function () {
  return app.slugs().create({"process_types": {"web": "target/universal/stage/bin/" + projectName + " -Dhttp.port=${PORT} ${PLAY_OPTS}"}},
    function (err, data) {
      console.log("Created a new slug " + data.id);
      slugInfo = data;
      return data;
    });
};

var pushSlugToAWS = function (slugInfo) {
  var awsUrl = url.parse(slugInfo.blob.url);
  console.log("Reading " + artifactName + " into memory.");
  var buffer = fs.readFileSync(artifactName);
  var request = httpSync.request({
    method: 'PUT',
    protocol: 'https',
    port: 443,
    host: awsUrl.hostname,
    path: awsUrl.pathname,
    body: buffer,
    headers: {
      'Content-Type': ''
    }
  });
  console.log("Performing PUT to " + url.format(awsUrl));

  var response = request.end();

  return new Q(response);
};

var releaseInfo = {};

var releaseSlug = function () {
  return app.releases().create({"slug": slugInfo.id}, function (err, data) {
    if (err) {
      throw new Error(err.body.message);
    }
    console.log("ReleaseInfo " + data);
    releaseInfo = data;
    return data;
  });
};

getSlugInfo()
  .then(pushSlugToAWS)
  .then(releaseSlug);