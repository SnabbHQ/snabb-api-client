'use strict';

var geodesy = require('geodesy');

module.exports = function () {
  geodesy.LatLonSpherical.prototype.toSnabb = function () {
    return {
      latitude: this.lat,
      longitude: this.lon
    };
  };
  return geodesy;
}();

//# sourceMappingURL=GeodesyWrapper-compiled.js.map