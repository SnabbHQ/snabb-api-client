'use strict';

const assert = require('assert');
const rush = require('../../index');
const config = require('../dummy/config');

describe('testing snabb-rush main sdk methods', function() {
  it('Snabb should exist', function() {
    assert(!!rush);
  });
  it('Snabb.createClient should exist', function() {
    assert(typeof rush.createClient == 'function');
  });
  it('Snabb .createClient should require client_secret and client_id', function() {
    assert.throws(() => {
      rush.createClient()
    });
    assert.throws(() => {
      rush.createClient({client_secret:'test'})
    });
    assert.throws(() => {
      rush.createClient({client_id:'test'})
    });
    assert.doesNotThrow(() => {
      rush.createClient(config);
    });
  });
  it('An API instance should offer createDelivery', function() {
    const client = rush.createClient(config);

    assert(typeof client.createDelivery == 'function');
  });
})
