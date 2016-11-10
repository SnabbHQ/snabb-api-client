'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var nconf = require('nconf');
var _ = require('lodash');
var API = require('./lib/ApiRequest');

var Delivery = require('./lib/Delivery');
var Location = require('./lib/Location');
var Quote = require('./lib/Quote');
var Item = require('./lib/Item');
var Contact = require('./lib/Contact');

var SnabbClient = function () {
  function SnabbClient(options) {
    _classCallCheck(this, SnabbClient);

    if (!options.client_secret) throw new Error("client_secret must be provided");
    if (!options.client_id) throw new Error("client_id must be provided");
    Object.assign(this, options);

    var sandbox = options.sandbox || !options.production;
    var scope = sandbox ? 'delivery_sandbox' : 'delivery';

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
      console.log('Initializing snabb in', sandbox ? 'sandbox' : 'production', 'mode with scope:', scope);
    }

    if (!options.no_preload) this._authenticationPromise = API.getToken();
  }

  _createClass(SnabbClient, [{
    key: 'createDelivery',
    value: function createDelivery(options) {
      options.debug = options.debug || this.debug;
      return new Delivery(options);
    }
  }, {
    key: 'setPollingInterval',
    value: function setPollingInterval(interval) {
      nconf.set('snabb_api_polling_interval_secs', interval);
    }
  }]);

  return SnabbClient;
}();

SnabbClient.Delivery = Delivery;
SnabbClient.Item = Item;
SnabbClient.Quote = Quote;
SnabbClient.Contact = Contact;
SnabbClient.createClient = function (options) {
  return new SnabbClient(options);
};

module.exports = SnabbClient;

//# sourceMappingURL=index-compiled.js.map