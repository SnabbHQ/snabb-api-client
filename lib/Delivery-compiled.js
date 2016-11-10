'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _ = require('lodash');
var util = require('util');
var async = require('async');
var events = require('events');
var EventEmitter = events.EventEmitter;
var rest = require('restling');
var nconf = require('nconf');
var Q = require('q');

var Quote = require('./Quote');
var Location = require('./Location');
var Dropoff = require('./Dropoff');
var Pickup = require('./Pickup');
var Courier = require('./Courier');
var Item = require('./Item');
var API = require('./ApiRequest');

var DEFAULT_UPDATE_INTERVAL_SECONDS = 30;
var SIMULATION_UPDATE_INTERVAL_SECONDS = 30;

// Maximum number of consecutive polling failures allowed before disabling
var MAX_UPDATE_FAILURES = 10;

/**
 * Create a new delivery.
 *
 * @param options.pickup Location Location object defining where to pick up this delivery.
 * @param options.dropoff Location Location object defining where to drop off this delivery.
 *
 */

var Delivery = function (_EventEmitter) {
  _inherits(Delivery, _EventEmitter);

  function Delivery(options) {
    _classCallCheck(this, Delivery);

    var _this = _possibleConstructorReturn(this, (Delivery.__proto__ || Object.getPrototypeOf(Delivery)).call(this));

    EventEmitter.call(_this);
    if (!options) options = {};

    _this.log = nconf.get('snabb_api_debug') ? console.log.bind(console) : function () {};
    _this.items = [];
    _this.pollingFailures = 0;
    _this.updateInterval = nconf.get('snabb_api_polling_interval_secs') || DEFAULT_UPDATE_INTERVAL_SECONDS;

    if (options.pickup) _this.setPickup(options.pickup);
    if (options.dropoff) _this.setDropoff(options.dropoff);
    if (options.delivery_id) _this.delivery_id = options.delivery_id;
    if (options.order_reference_id) _this.order_reference_id = options.order_reference_id;
    return _this;
  }

  _createClass(Delivery, [{
    key: 'addItem',
    value: function addItem(item) {
      preventDeliveryChanges(this);
      this.items.push(item instanceof Item ? item : new Item(item));
      this.log('Added item', item);
    }
  }, {
    key: 'setPickup',
    value: function setPickup(pickup) {
      preventDeliveryChanges(this);
      if (pickup instanceof Location) this.pickup = new Pickup({ location: pickup });else if (pickup instanceof Pickup) this.pickup = pickup;else this.pickup = new Pickup(pickup);
    }
  }, {
    key: 'setDropoff',
    value: function setDropoff(dropoff) {
      preventDeliveryChanges(this);
      if (dropoff instanceof Location) this.dropoff = new Dropoff({ location: dropoff });else if (dropoff instanceof Dropoff) this.dropoff = dropoff;else this.dropoff = new Dropoff(dropoff);
    }
  }, {
    key: 'addSpecialInstructions',
    value: function addSpecialInstructions(special) {
      preventDeliveryChanges(this);
      this.special_instructions = special;
    }
  }, {
    key: 'requireSignature',
    value: function requireSignature(sig) {
      preventDeliveryChanges(this);
      if (sig === undefined) this.signature_required = true;else this.require_signature = sig;
    }
  }, {
    key: 'quote',
    value: function quote(_quote) {
      preventDeliveryChanges(this);

      if (!_quote) _quote = {};
      if (!_quote.pickup) _quote.pickup = this.pickup;
      if (!_quote.dropoff) _quote.dropoff = this.dropoff;

      if (!(_quote.pickup instanceof Pickup)) {
        throw new Error("Pickup location missing");
      }

      if (!(_quote.dropoff instanceof Dropoff)) {
        throw new Error("Dropoff location missing");
      }

      this.log('Posting', _quote);
      var self = this;

      return API.post('deliveries/quote', _quote).then(function (result) {
        if (result.response.statusCode == 201) {
          var _ret = function () {
            var data = (result.data || {}).quotes;
            var quotes = [];
            self.log('For quote request', data, '....');
            _.each(data, function (val, idx) {
              if (idx === 0) {
                self.quote_id = val.quote_id;
              }
              quotes.push(new Quote(val));
            });
            self.log('Received quotes', quotes);
            return {
              v: quotes
            };
          }();

          if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
        } else {
          throw new Error("Quote failed");
        }
      }, function (error) {
        throw new Error("Quote failed: " + error.response.raw);
      });
    }
  }, {
    key: 'confirm',
    value: function confirm(options) {
      if (!options) options = {};

      var self = this;

      // POST api.snabb.com/v1/deliveries
      this.log('Creating delivery');
      return API.post('deliveries', {
        quote_id: options.quote_id || self.quote_id,
        order_reference_id: options.order_reference_id || self.order_reference_id,
        items: self.items,
        pickup: options.pickup || self.pickup,
        dropoff: options.dropoff || self.dropoff
      }).then(function (result) {
        if (result && result.response && (result.response.statusCode == 200 || result.response.statusCode == 201)) {
          var data = result.data;
          self.log('Delivery confirmed', data);
          _.each(data, function (val, key) {
            (function () {
              switch (key) {
                case 'courier':
                  if (self.extrapolate) val.extrapolate = true;
                  val = new Courier(val);
                  break;

                case 'items':
                  var items = [];
                  _.each(val, function (value) {
                    items.push(new Item(value));
                  });
                  val = items;
                  break;

                case 'dropoff':
                  val = new Dropoff(val);
                  break;

                case 'pickup':
                  val = new Pickup(val);
                  break;
              }
            })();

            self[key] = val;
          });

          // stored on delivery after reception:
          // - fee
          // - items
          // - order_reference_id
          // - delivery_id

          self.emit('dropoff_eta', self.dropoff.eta);
          self.emit('pickup_eta', self.pickup.eta);
          self.emit('status', self.status);

          self.log('Updating status');
          self.updateStatus();
          self.log('Delivery created', self.delivery_id);

          var simulate = nconf.get('snabb_api_simulate') || false;
          self.log('simulation', simulate);

          if (simulate) {
            self.simulate(simulate);
          }

          return self;
        } else {
          self.log('Snabb API unable to create delivery.', result);
          throw new Error(result ? 'Snabb API unable to create delivery. Response: ' + JSON.stringify(result) : 'Snabb API unable to create delivery (null response)');
        }
      });
    }
  }, {
    key: 'getPossibleStatuses',
    value: function getPossibleStatuses() {
      return ['en_route_to_pickup', 'at_pickup', 'en_route_to_dropoff', 'at_dropoff', 'completed'];
    }
  }, {
    key: 'simulate',
    value: function simulate(delay) {
      var statuses = this.getPossibleStatuses();
      //const statuses = ['no_couriers_available'];
      var self = this;

      var i = 0;
      if (typeof delay !== 'number' || delay === 0) delay = SIMULATION_UPDATE_INTERVAL_SECONDS * 1000;

      var update = setInterval(function () {
        if (!self.delivering) {
          clearInterval(update);
        } else if (i >= statuses.length) {
          clearInterval(update);
        } else {
          self.updateStatus(statuses[i++]);
          if (statuses[i - 1] == 'en_route_to_dropoff') {
            // next status is dropoff
            // so we need to animate the delivery

            //self.courier.extrapolate = true;
            //self.courier.setLocation(self.pickup);
          }
        }
      }, delay);

      this.log('simulating delivery with a delay of ' + Math.ceil(delay / 1000.00) + 's between stages');
    }
  }, {
    key: 'updateStatus',
    value: function updateStatus(status) {
      var _this2 = this;

      var self = this;

      // Check if we've reached the maximum number of allowed failures, clear
      // the polling interview
      if (this.pollingFailures > MAX_UPDATE_FAILURES) {
        return stopDelivering(self);
      }

      var blockUpdate = Q(true);

      if (status) {
        // sandbox testing
        this.log('updating status for sandbox testing (delivery_id=' + this.delivery_id + '; status=' + status + ')');
        blockUpdate = API.put('sandbox/deliveries/' + this.delivery_id, {
          status: status
        });
      }

      blockUpdate.then(function () {
        // Exponential decay on time between failed status poll requests
        var interval = self.updateInterval * Math.pow(2, self.pollingFailures) * 1000;

        if (self.delivering) clearInterval(self.delivering);
        self.delivering = setInterval(function () {
          return _this2.updateDeliveryInfo();
        }, interval);
      });
    }

    /**
     * Call the delivery API for the latest information on this order
     */

  }, {
    key: 'updateDeliveryInfo',
    value: function updateDeliveryInfo() {
      var _this3 = this;

      this.log('polling this status');

      return API.get('deliveries/' + this.delivery_id).then(function (data) {
        _this3.log('Receive API this data', data);

        // Reset the number of failures when we successfully poll snabb
        _this3.pollingFailures = 0;

        if (!_this3.courier) {
          _this3.courier = new Courier(data.courier);
          _this3.courier.on('moved', function (data) {
            return _this3.emit('location', data);
          });
        } else {
          _this3.courier.update(data.courier);
        }

        if (!_this3.pickup && data.pickup) {
          _this3.pickup = new Pickup(data.pickup);
          _this3.pickup.eta = data.pickup.eta;
        }

        if (!_this3.dropoff && data.dropoff) {
          _this3.dropoff = new Dropoff(data.dropoff);
          _this3.dropoff.eta = data.dropoff.eta;
        }

        var status = (data || {}).status || 'unknown';
        _this3.status = data.status;

        // Emit the status event before determining if the current status is terminal
        _this3.emit('status', status);

        switch (data.status) {
          case 'completed':
          case 'returned':
          case 'client_canceled':
          case 'no_couriers_available':
          case 'unable_to_deliver':
            // terminal statuses: we stop polling if we receive one of these
            _this3.complete(status);
        }
      }).catch(function (err) {
        // Increment the number of polling failures on failure
        _this3.pollingFailures += 1;
        _this3.log(err.message, err.stack);
        throw err;
      });
    }
  }, {
    key: 'complete',
    value: function complete() {
      stopDelivering(this);
      if (this.courier) this.courier.done();
    }
  }, {
    key: 'cancel',
    value: function cancel() {
      var _this4 = this;

      stopDelivering(this);

      return API.post('deliveries/' + this.delivery_id + '/cancel').then(function () {
        _this4.log('Canceled #' + _this4.delivery_id);
        return _this4;
      });
    }
  }, {
    key: 'getRatings',
    value: function getRatings(options) {
      if (this.status !== 'completed' && !options) {
        throw new Error('Cannot get ratings for an order that was not successfully completed (status=' + this.status + ')');
      }

      return API.get('deliveries/' + this.delivery_id + '/ratings').then(function (result) {
        if (result.statusCode == 200) {
          return result.data;
        } else {
          return result.message;
        }
      });
    }

    /* returns true if successful */

  }, {
    key: 'rate',
    value: function rate(options) {
      if (this.status !== 'completed') throw new Error('Cannot rate an order that was not successfully completed');
      if (!options) throw new Error('Missing rating object');
      if (!options.waypoint || options.waypoint !== 'pickup' && options.waypoint !== 'dropoff') {
        throw new Error('Waypoint required: "pickup" or "dropoff"');
      }

      if (!options.rating_type) options.rating_type = 'binary'; // only supported type as of now (2016-10-12)
      if (!options.tags) options.tags = [];

      return API.post('deliveries/' + this.delivery_id + '/ratings', options);
    }
  }]);

  return Delivery;
}(EventEmitter);

Delivery.list = function () {
  return API.get('deliveries').then(function (result) {
    var rv = [];
    for (var i = 0; i < result.length; i++) {
      rv.push(new Delivery(result[i]));
    }
    return rv;
  }, function () {
    return [];
  });
};

function stopDelivering(delivery) {
  if (delivery.delivering) {
    clearInterval(delivery.delivering);
    delete delivery.delivering;

    delivery.removeAllListeners();
  }
}

function preventDeliveryChanges(delivery) {
  if (delivery.delivery_id) throw new Error("Delivery in progress; no changes possible");
}
module.exports = Delivery;

//# sourceMappingURL=Delivery-compiled.js.map