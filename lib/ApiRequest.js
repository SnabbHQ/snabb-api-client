'use strict';

const _ = require('lodash');
const util = require('util');
const async = require('async');
const events = require('events');
const rest = require('restling');
const nconf = require('nconf');
const Q = require('q');

const API_SANDBOX_URI = 'https://sandbox-api.snabb.com/v1/';
const API_PRODUCTION_URI = 'https://api.snabb.com/v1/';
const OAUTH_URI = 'https://login.snabb.com/oauth/v2/token';

const REFRESH_SECONDS_BEFORE_EXPIRY = 10;

let access_token;
let expires_at;

let log = function () {};

function setTimeout_ (fn, delay) {
  const maxDelay = Math.pow(2,31)-1;

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
  const refreshTimeMs = (expiresIn - REFRESH_SECONDS_BEFORE_EXPIRY)*1000;

  setTimeout_(function() {
    log('Snabb API token expires in '+REFRESH_SECONDS_BEFORE_EXPIRY+' seconds. Refreshing.');
    getToken();
  }, refreshTimeMs);
}

function getToken(options) {
  options = options || {};

  // Setup logging based on the config
  log = (nconf.get('snabb_api_debug') ? log.bind(console) : function () {});

  if (options.accessToken) {
    access_token = options.accessToken;
  }
  if (access_token) {
    if (expires_at > Date.now() + 20000) {
      return Q(access_token);
    }
  }

  log('Getting Snabb API token.');
  let scope = nconf.get('snabb_api_scope');

  return rest.post(OAUTH_URI, {
    multipart: true,
    data: {
      client_secret: nconf.get('snabb_api_client_secret'),
      client_id: nconf.get('snabb_api_client_id'),
      server_token: nconf.get('snabb_api_server_token'),
      grant_type: 'client_credentials',
      scope: scope ? scope : 'delivery_sandbox'
    }
  }).then(function(result) {
    log('getToken result', result && result.data ? result.data : null);
    if (result.response.statusCode == 200) {
      log('Authenticated and received Snabb API access token.');
      access_token = result.data.access_token;
      let expiresInSeconds = parseInt(result.data.expires_in, 10);

      expires_at = Date.now() + expiresInSeconds * 1000;

      // kick off token refresh process
      refresh(expiresInSeconds);

      return access_token;
    } else {
      console.error('Snabb API authentication failed', result.response.raw);
      throw new Error(result.response);
    }
  }, function(error) {
    console.error('Snabb API authentication error', error.response.raw);
    throw new Error(error.response.raw);
  });
}

function getUrl(path) {
  const sandbox = nconf.get('snabb_api_sandbox');
  return (sandbox ? API_SANDBOX_URI : API_PRODUCTION_URI) + (path||'');
}

function call(path, options) {
  return getToken(options)
  .then(function(accessToken) {
    if (!options.accessToken) options.accessToken = accessToken;
    log('API ' + options.method + ' ' +  getUrl(path), (options.data||''));
    return rest.request(getUrl(path), options);
  }).then(function(result) {
    try {
      if (typeof result.data == 'string') result.data = JSON.parse(result.data);
    }
    catch (e) {
    }

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
  }, function(error) {
    console.error('RESULT', error.data);
    return error;
  });
}

module.exports = {
  'getToken': getToken,
  'post': function (path, data) {
    let options = {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      data: JSON.stringify(data)
    };

    return call(path, options);
  },
  'put': function (path, data) {
    let options = {
      method: 'PUT',
      headers: {'content-type': 'application/json'},
      data: JSON.stringify(data)
    };

    return call(path, options);
  },
  'get': function (path) {
    let options = {
      method: 'GET'
    };
    return call(path, options);
  }
};
