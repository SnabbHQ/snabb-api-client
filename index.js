'use strict';
const nconf = require('nconf');
const _ = require('lodash');
const API = require('./lib/ApiRequest');

const Delivery = require('./lib/Delivery');
const Location = require('./lib/Location');
const Quote = require('./lib/Quote');
const Item = require('./lib/Item');
const Contact = require('./lib/Contact');

class SnabbClient {
  constructor(options) {
    if (!options.client_secret) throw new Error("client_secret must be provided");
    if (!options.client_id) throw new Error("client_id must be provided");
    Object.assign(this, options);

    const sandbox = options.sandbox || !options.production;
    const scope = (sandbox ? 'delivery_sandbox' : 'delivery');

    nconf.use('memory');

    nconf.set('snabb_api_client_secret', options.client_secret);
    nconf.set('snabb_api_client_id', options.client_id);
    nconf.set('snabb_api_server_token', options.server_token);
    nconf.set('snabb_api_sandbox', sandbox);
    nconf.set('snabb_api_simulate', options.simulate);
    nconf.set('snabb_api_debug', options.debug);
    nconf.set('snabb_api_scope', scope);
    nconf.set('snabb_api_polling_interval_secs', options.polling_interval_secs || 30);

    if (options.debug) {
      console.log(
        'Initializing snabb in', (sandbox ? 'sandbox' : 'production'),
        'mode with scope:', scope
      );
    }

    if (!options.no_preload)
      this._authenticationPromise = API.getToken();
  }

  createDelivery(options) {
    options.debug = options.debug || this.debug;
    return new Delivery(options);
  }

  setPollingInterval(interval) {
    nconf.set('snabb_api_polling_interval_secs', interval);
  }
}

SnabbClient.Delivery = Delivery;
SnabbClient.Item = Item;
SnabbClient.Quote = Quote;
SnabbClient.Contact = Contact;
SnabbClient.createClient = function(options) {
  return new SnabbClient(options);
};

module.exports = SnabbClient;
