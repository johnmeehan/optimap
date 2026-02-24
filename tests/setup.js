// Minimal browser global mocks so tsp.js and directions-export.js can be loaded
// without errors. These are referenced inside function bodies, not at load time,
// but we set them up defensively.

global.alert = function() {};

global.google = {
  maps: {
    MapTypeId: { ROADMAP: 'roadmap' },
    DirectionsTravelMode: {
      WALKING: 'WALKING',
      BICYCLING: 'BICYCLING',
      DRIVING: 'DRIVING',
    },
    Marker: function() {},
    MarkerImage: function() {},
    InfoWindow: function() {},
    LatLng: function(lat, lng) {
      this.lat = function() { return lat; };
      this.lng = function() { return lng; };
    },
    LatLngBounds: function() { this.extend = function() {}; },
    DirectionsRenderer: function() { this.setMap = function() {}; },
    event: { addListener: function() {} },
    Map: function() {
      this.fitBounds = function() {};
      this.getCenter = function() {};
      this.getZoom = function() {};
      this.getDiv = function() {};
    },
  },
};

global.jQuery = function() {
  var chain = {
    progressbar: function() { return chain; },
    dialog: function() { return chain; },
    button: function() { return chain; },
    sortable: function() { return chain; },
    disableSelection: function() { return chain; },
  };
  return chain;
};
global.jQuery.fn = {};
