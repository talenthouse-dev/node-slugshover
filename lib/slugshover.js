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

var projectName = argv.app || process.env.HEROKU_APP_NAME;
var artifactName = argv.artifact || process.env.HEROKU_ARTIFACT_NAME;
var process_type = argv.process_type || process.env.HEROKU_PROCESS_TYPE;
var process_args = argv.process_args || process.env.HEROKU_PROCESS_ARGS;

var app = heroku.apps(projectName);

var slugInfo = {};

var getSlugInfo = function () {
  return app.slugs().create({"process_types": {"web": process_type + " " + process_args}},
    function (err, data) {
      console.log("Created a new slug " + data.id);
      slugInfo = data;
      return data;
    });
};

var pushSlugToAWS = function (slugInfo) {
  var deferred = Q.defer();
  var awsUrl = slugInfo.blob.url;
  console.log("Uploading " + artifactName + " to " + url.format(awsUrl));
  curl.run('-X PUT -H "Content-Type:" --data-binary @' + artifactName + ' "' + awsUrl + '"', function (err, result) {
    if (err) {
      deferred.reject(err);
      throw new Error(err);
    }

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

    releaseInfo = data;
    return data;
  });
};

getSlugInfo()
  .then(pushSlugToAWS)
  .then(releaseSlug);