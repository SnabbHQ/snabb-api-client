'use strict';

var _ = require('lodash');
var util = require('util');
var async = require('async');
var events = require('events');
var rest = require('restling');
var nconf = require('nconf');
var Q = require('q');

var API_SANDBOX_URI = 'https://sandbox-api.snabb.com/v1/';
var API_PRODUCTION_URI = 'https://api.snabb.com/v1/';
var OAUTH_URI = 'https://login.snabb.com/oauth/v2/token';

var REFRESH_SECONDS_BEFORE_EXPIRY = 10;

var access_token = undefined;
var expires_at = undefined;

var log = function log() {};

function setTimeout_(fn, delay) {
  var maxDelay = Math.pow(2, 31) - 1;

  if (delay > maxDelay) {
    var args = arguments;
    args[1] -= maxDelay;

    return setTimeout(function () {
      setTimeout_.apply(undefined, args);
    }, maxDelay);
  }

  return setTimeout.apply(undefined, arguments);
}

function refresh(expiresIn) {
  var refreshTimeMs = (expiresIn - REFRESH_SECONDS_BEFORE_EXPIRY) * 1000;

  setTimeout_(function () {
    log('Snabb API token expires in ' + REFRESH_SECONDS_BEFORE_EXPIRY + ' seconds. Refreshing.');
    getToken();
  }, refreshTimeMs);
}

function getToken(options) {
  options = options || {};

  // Setup logging based on the config
  log = nconf.get('snabb_api_debug') ? log.bind(console) : function () {};

  if (options.accessToken) {
    access_token = options.accessToken;
  }
  if (access_token) {
    if (expires_at > Date.now() + 20000) {
      return Q(access_token);
    }
  }

  log('Getting Snabb API token.');
  var scope = nconf.get('snabb_api_scope');

  return rest.post(OAUTH_URI, {
    multipart: true,
    data: {
      client_secret: nconf.get('snabb_api_client_secret'),
      client_id: nconf.get('snabb_api_client_id'),
      server_token: nconf.get('snabb_api_server_token'),
      grant_type: 'client_credentials',
      scope: scope ? scope : 'delivery_sandbox'
    }
  }).then(function (result) {
    log('getToken result', result && result.data ? result.data : null);
    if (result.response.statusCode == 200) {
      log('Authenticated and received Snabb API access token.');
      access_token = result.data.access_token;
      var expiresInSeconds = parseInt(result.data.expires_in, 10);

      expires_at = Date.now() + expiresInSeconds * 1000;

      // kick off token refresh process
      refresh(expiresInSeconds);

      return access_token;
    } else {
      console.error('Snabb API authentication failed', result.response.raw);
      throw new Error(result.response);
    }
  }, function (error) {
    console.error('Snabb API authentication error', error.response.raw);
    throw new Error(error.response.raw);
  });
}

function getUrl(path) {
  var sandbox = nconf.get('snabb_api_sandbox');
  return (sandbox ? API_SANDBOX_URI : API_PRODUCTION_URI) + (path || '');
}

function call(path, options) {
  return getToken(options).then(function (accessToken) {
    if (!options.accessToken) options.accessToken = accessToken;
    log('API ' + options.method + ' ' + getUrl(path), options.data || '');
    return rest.request(getUrl(path), options);
  }).then(function (result) {
    try {
      if (typeof result.data == 'string') result.data = JSON.parse(result.data);
    } catch (e) {}

    if (options.method == 'GET') {
      if (result.response.statusCode == 200) {
        return result.data;
      }
    }
    if (options.method == 'POST') {
      if (result.response.statusCode == 204) {
        return true;
      }
    }
    return result;
  }, function (error) {
    console.error('RESULT', error.data);
    return error;
  });
}

module.exports = {
  'getToken': getToken,
  'post': function post(path, data) {
    var options = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify(data)
    };

    return call(path, options);
  },
  'put': function put(path, data) {
    var options = {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify(data)
    };

    return call(path, options);
  },
  'get': function get(path) {
    var options = {
      method: 'GET'
    };
    return call(path, options);
  }
};

//# sourceMappingURL=ApiRequest-compiled.js.map