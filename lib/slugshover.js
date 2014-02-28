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

var curl = require('curling');

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
  var deferred = Q.defer();
  var awsUrl = slugInfo.blob.url;
  console.log("Performing PUT to " + url.format(awsUrl));
  curl.run('-X PUT -H "Content-Type:" --data-binary @' + artifactName + ' "' + awsUrl + '"', function (err, result) {
    if (err) {
      deferred.reject(err);
      throw new Error(err);
    }

    console.log("Result payload: " + util.inspect(result));

    deferred.resolve(result);
  });
  return deferred.promise;
};

var releaseInfo = {};

var releaseSlug = function () {
  return app.releases().create({"slug": slugInfo.id}, function (err, data) {
    if (err) {
      throw new Error(err.body.message);
    }
    console.log("ReleaseInfo " + util.inspect(data));

    releaseInfo = data;
    return data;
  });
};

getSlugInfo()
  .then(pushSlugToAWS)
  .then(releaseSlug);