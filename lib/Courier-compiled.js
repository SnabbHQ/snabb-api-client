'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _ = require('lodash');
var events = require('events');
var util = require('util');
var geodesy = require('./GeodesyWrapper');
var LatLon = geodesy.LatLonSpherical;

var Vehicle = require('./Vehicle.js');

// meters per second traveled by bike
var mps = 5000 / 60 / 60;
// frames per second -- how frequently to issue updates to courier animation
var fps = 1;

/**
  A courier.

  @param location object {
      "latitude":40.7619629893,
      "longitude":-74.0014480227,
      "bearing":33
  }

  @param name string Name of the courier, e.g. Rob
  @param phone string Phone number of the courier, e.g. +12155551212
  @param picture_url uri URI to a photo of the courier
  @param vehicle Vehicle object
*/

var Courier = function (_events$EventEmitter) {
  _inherits(Courier, _events$EventEmitter);

  function Courier(options) {
    _classCallCheck(this, Courier);

    var _this = _possibleConstructorReturn(this, (Courier.__proto__ || Object.getPrototypeOf(Courier)).call(this));

    events.EventEmitter.call(_this);

    _.each(options, function (value, key) {
      if (key == 'vehicle') {
        _this.setVehicle(value);
      } else if (key == 'location') {
        _this.location = new LatLon(value.latitude, value.longitude);
        _this.location.bearing = value.bearing;
      } else _this[key] = value;
    });

    if (false && options.extrapolate) {
      _this.startPredicting();
    }
    return _this;
  }

  _createClass(Courier, [{
    key: 'setVehicle',
    value: function setVehicle(vehicle) {
      if (!(vehicle instanceof Vehicle)) {
        vehicle = new Vehicle(vehicle);
      }
      this.vehicle = vehicle;

      this.emit('vehicle', vehicle);
    }
  }, {
    key: 'getLocation',
    value: function getLocation() {
      return this.location.toSnabb();
    }
  }, {
    key: 'predictNextLocation',
    value: function predictNextLocation(time, speed, location) {
      if (location) {
        if (!(location instanceof LatLon)) location = new LatLon(location.latitude || location.lat, location.longitude || location.lon);
      } else location = this.location;

      // time must be in seconds
      // speed in meters per second? yes
      //
      var distance = time * speed;
      var point = location.destinationPoint(distance, location.bearing || 0);

      return point;
    }
  }, {
    key: 'setLocation',
    value: function setLocation(location) {
      if (this.extrapolation) clearInterval(this.extrapolation);

      this.location = location instanceof LatLon ? location : new LatLon(location.latitude || location.lat, location.longitude || location.lon);
      this.location.bearing = location.bearing || 0;

      this.emit('moved', this.location);

      if (this.extrapolate) {
        this.startPredicting();
      }
    }
  }, {
    key: 'startPredicting',
    value: function startPredicting() {
      var _this2 = this;

      var nextLocation = undefined;

      this.extrapolation = setInterval(function () {
        nextLocation = _this2.predictNextLocation(1.0 / fps, mps, nextLocation);
        nextLocation.bearing = _this2.location.bearing;
        //console.log('moved', nextLocation.toSnabb());
        _this2.emit('moved', nextLocation.toSnabb());
      }, 1.0 / fps * 1000);
    }

    // couriers might change, so we do need to be able to update all fields while maintaining this object during a delivery for subscribers' sakes

  }, {
    key: 'update',
    value: function update(courierRecord) {
      var _this3 = this;

      _.each(courierRecord, function (value, key) {
        if (key == 'location') _this3.setLocation(value);
        if (key == 'vehicle') _this3.setVehicle(value);else _this3[key] = value;
      });
    }
  }, {
    key: 'done',
    value: function done() {
      if (this.extrapolation) clearInterval(this.extrapolation);
      this.removeAllListeners();
    }
  }]);

  return Courier;
}(events.EventEmitter);

module.exports = Courier;

//# sourceMappingURL=Courier-compiled.js.map