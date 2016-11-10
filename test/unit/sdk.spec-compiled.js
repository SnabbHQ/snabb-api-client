'use strict';

var assert = require('assert');
var rush = require('../../index');
var config = require('../dummy/config');

describe('testing snabb-rush main sdk methods', function () {
  it('Snabb should exist', function () {
    assert(!!rush);
  });
  it('Snabb.createClient should exist', function () {
    assert(typeof rush.createClient == 'function');
  });
  it('Snabb .createClient should require client_secret and client_id', function () {
    assert.throws(function () {
      rush.createClient();
    });
    assert.throws(function () {
      rush.createClient({ client_secret: 'test' });
    });
    assert.throws(function () {
      rush.createClient({ client_id: 'test' });
    });
    assert.doesNotThrow(function () {
      rush.createClient(config);
    });
  });
  it('An API instance should offer createDelivery', function () {
    var client = rush.createClient(config);

    assert(typeof client.createDelivery == 'function');
  });
});

//# sourceMappingURL=sdk.spec-compiled.js.map