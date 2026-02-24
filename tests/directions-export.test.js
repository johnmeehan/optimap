var fs = require('fs');
var path = require('path');

// Load directions-export.js and extract pure functions.
// String.prototype modifications (trim/ltrim/rtrim) affect the global prototype
// as a side-effect of executing the source — that is the intended behaviour.
var exportFns = (function() {
  var src = fs.readFileSync(path.resolve(__dirname, '../js/directions-export.js'), 'utf8');
  eval(src);
  return {
    zeroPadded: zeroPadded,
    getWGS84Degrees: getWGS84Degrees,
    createTomTomItineraryItn: createTomTomItineraryItn,
    createGarminGpx: createGarminGpx,
    createGarminGpxWaypoints: createGarminGpxWaypoints,
  };
})();

// ---------------------------------------------------------------------------
// Helpers shared across export-function tests
// ---------------------------------------------------------------------------
function makePt(lat, lng) {
  return {
    lat: function() { return lat; },
    lng: function() { return lng; },
  };
}

// Two-leg gdir: A→B→C
var gdir2 = {
  legs: [
    { start_location: makePt(1.0, 2.0), end_location: makePt(3.0, 4.0) },
    { start_location: makePt(3.0, 4.0), end_location: makePt(5.0, 6.0) },
  ],
};

var addr2 = ['Start', 'Middle', 'End'];
var labelsNull = [null, null, null];
var labelsNamed = ['LabelA', 'LabelB', 'LabelC'];

// ---------------------------------------------------------------------------
// String.prototype helpers (defined by directions-export.js at load time)
// ---------------------------------------------------------------------------
describe('String prototype helpers', function() {
  test('trim removes leading and trailing whitespace', function() {
    expect('  hello  '.trim()).toBe('hello');
  });

  test('trim on a string with no whitespace is a no-op', function() {
    expect('hello'.trim()).toBe('hello');
  });

  test('trim on empty string returns empty string', function() {
    expect(''.trim()).toBe('');
  });

  test('ltrim removes only leading whitespace', function() {
    expect('  hello  '.ltrim()).toBe('hello  ');
  });

  test('ltrim leaves a string with no leading whitespace unchanged', function() {
    expect('hello  '.ltrim()).toBe('hello  ');
  });

  test('rtrim removes only trailing whitespace', function() {
    expect('  hello  '.rtrim()).toBe('  hello');
  });

  test('rtrim leaves a string with no trailing whitespace unchanged', function() {
    expect('  hello'.rtrim()).toBe('  hello');
  });
});

// ---------------------------------------------------------------------------
// zeroPadded
// ---------------------------------------------------------------------------
describe('zeroPadded', function() {
  test('pads single digit to 3 places', function() {
    expect(exportFns.zeroPadded(5, 3)).toBe('005');
  });

  test('pads two-digit number to 4 places', function() {
    expect(exportFns.zeroPadded(42, 4)).toBe('0042');
  });

  test('no padding when number exactly fills requested digits', function() {
    expect(exportFns.zeroPadded(100, 3)).toBe('100');
  });

  test('pads zero to 2 places', function() {
    expect(exportFns.zeroPadded(0, 2)).toBe('00');
  });

  test('no padding when number exceeds requested digits', function() {
    expect(exportFns.zeroPadded(9999, 3)).toBe('9999');
  });

  test('pads 1 to 3 places', function() {
    expect(exportFns.zeroPadded(1, 3)).toBe('001');
  });
});

// ---------------------------------------------------------------------------
// getWGS84Degrees
// ---------------------------------------------------------------------------
describe('getWGS84Degrees', function() {
  test('converts 1.0 to 100000', function() {
    expect(exportFns.getWGS84Degrees(1.0)).toBe(100000);
  });

  test('converts -0.5 to -50000', function() {
    expect(exportFns.getWGS84Degrees(-0.5)).toBe(-50000);
  });

  test('converts 0 to 0', function() {
    expect(exportFns.getWGS84Degrees(0)).toBe(0);
  });

  test('rounds fractional values correctly', function() {
    // 0.123456789 * 100000 = 12345.6789 → rounds to 12346
    expect(exportFns.getWGS84Degrees(0.123456789)).toBe(12346);
  });

  test('handles negative fractional values', function() {
    // -1.23456 * 100000 = -123456.0 exactly
    expect(exportFns.getWGS84Degrees(-1.23456)).toBe(-123456);
  });

  test('whole-number lat/lng values round-trip cleanly', function() {
    expect(exportFns.getWGS84Degrees(2.0)).toBe(200000);
  });
});

// ---------------------------------------------------------------------------
// createTomTomItineraryItn
// ---------------------------------------------------------------------------
// Format per line: <lng_wgs84>|<lat_wgs84>|<label>|<flag>|
// Start flag = 4, destination flag = 2
// ---------------------------------------------------------------------------
describe('createTomTomItineraryItn', function() {
  test('returns a string (not null) for valid input', function() {
    var result = exportFns.createTomTomItineraryItn(gdir2, addr2, labelsNull);
    expect(typeof result).toBe('string');
  });

  test('produces one line per stop (start + each leg end)', function() {
    var result = exportFns.createTomTomItineraryItn(gdir2, addr2, labelsNull);
    var lines = result.trim().split('\n');
    expect(lines).toHaveLength(3);
  });

  test('each line uses pipe-delimited format', function() {
    var result = exportFns.createTomTomItineraryItn(gdir2, addr2, labelsNull);
    result.trim().split('\n').forEach(function(line) {
      expect(line).toMatch(/^\-?\d+\|\-?\d+\|.+\|\d+\|$/);
    });
  });

  test('start line uses flag value 4', function() {
    var result = exportFns.createTomTomItineraryItn(gdir2, addr2, labelsNull);
    var firstLine = result.split('\n')[0];
    expect(firstLine).toContain('|4|');
  });

  test('destination lines use flag value 2', function() {
    var result = exportFns.createTomTomItineraryItn(gdir2, addr2, labelsNull);
    var lines = result.trim().split('\n');
    expect(lines[1]).toContain('|2|');
    expect(lines[2]).toContain('|2|');
  });

  test('start point encodes correct WGS84 lng then lat', function() {
    // start_location = makePt(lat=1.0, lng=2.0)
    // getWGS84Degrees(2.0) = 200000, getWGS84Degrees(1.0) = 100000
    var result = exportFns.createTomTomItineraryItn(gdir2, addr2, labelsNull);
    var firstLine = result.split('\n')[0];
    expect(firstLine.startsWith('200000|100000|')).toBe(true);
  });

  test('uses addr labels when labels array is all-null', function() {
    var result = exportFns.createTomTomItineraryItn(gdir2, addr2, labelsNull);
    expect(result).toContain('|Start|');
    expect(result).toContain('|Middle|');
    expect(result).toContain('|End|');
  });

  test('prefers named labels over addr when labels are provided', function() {
    var result = exportFns.createTomTomItineraryItn(gdir2, addr2, labelsNamed);
    expect(result).toContain('|LabelA|');
    expect(result).toContain('|LabelB|');
    expect(result).toContain('|LabelC|');
    expect(result).not.toContain('|Start|');
  });

  test('returns null and does not throw for empty legs', function() {
    var result = exportFns.createTomTomItineraryItn({ legs: [] }, [], []);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createGarminGpx
// ---------------------------------------------------------------------------
describe('createGarminGpx', function() {
  test('returns a string for valid input', function() {
    var result = exportFns.createGarminGpx(gdir2, addr2, labelsNull);
    expect(typeof result).toBe('string');
  });

  test('starts with XML declaration', function() {
    var result = exportFns.createGarminGpx(gdir2, addr2, labelsNull);
    expect(result.startsWith('<?xml version="1.0"?>')).toBe(true);
  });

  test('contains gpx root element', function() {
    var result = exportFns.createGarminGpx(gdir2, addr2, labelsNull);
    expect(result).toContain('<gpx');
    expect(result).toContain('</gpx>');
  });

  test('contains rte element', function() {
    var result = exportFns.createGarminGpx(gdir2, addr2, labelsNull);
    expect(result).toContain('<rte>');
    expect(result).toContain('</rte>');
  });

  test('contains one rtept per stop (start + each leg end)', function() {
    var result = exportFns.createGarminGpx(gdir2, addr2, labelsNull);
    var count = (result.match(/<rtept/g) || []).length;
    expect(count).toBe(3);
  });

  test('start rtept has correct lat and lon attributes', function() {
    // start_location = makePt(lat=1.0, lng=2.0)
    // JS converts 1.0 → "1" and 2.0 → "2" in string context
    var result = exportFns.createGarminGpx(gdir2, addr2, labelsNull);
    expect(result).toContain('lat="1" lon="2"');
  });

  test('leg endpoints have correct coordinates', function() {
    var result = exportFns.createGarminGpx(gdir2, addr2, labelsNull);
    expect(result).toContain('lat="3" lon="4"');
    expect(result).toContain('lat="5" lon="6"');
  });

  test('includes addr labels in route point names', function() {
    var result = exportFns.createGarminGpx(gdir2, addr2, labelsNull);
    expect(result).toContain('>Start<');
    expect(result).toContain('>Middle<');
    expect(result).toContain('>End<');
  });

  test('prefers named labels over addr in name elements', function() {
    // GPX always emits <sym>Start</sym> as a format keyword for the first point,
    // so we check <name> elements specifically rather than the whole output string.
    var result = exportFns.createGarminGpx(gdir2, addr2, labelsNamed);
    expect(result).toContain('<name>LabelA</name>');
    expect(result).not.toContain('<name>Start</name>');
  });

  test('returns null and does not throw for empty legs', function() {
    var result = exportFns.createGarminGpx({ legs: [] }, [], []);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createGarminGpxWaypoints
// ---------------------------------------------------------------------------
describe('createGarminGpxWaypoints', function() {
  test('returns a string for valid input', function() {
    var result = exportFns.createGarminGpxWaypoints(gdir2, addr2, labelsNull);
    expect(typeof result).toBe('string');
  });

  test('starts with XML declaration', function() {
    var result = exportFns.createGarminGpxWaypoints(gdir2, addr2, labelsNull);
    expect(result.startsWith('<?xml version="1.0"?>')).toBe(true);
  });

  test('uses wpt elements (not rtept)', function() {
    var result = exportFns.createGarminGpxWaypoints(gdir2, addr2, labelsNull);
    expect(result).toContain('<wpt');
    expect(result).not.toContain('<rtept');
  });

  test('contains one wpt per stop (start + each leg end)', function() {
    var result = exportFns.createGarminGpxWaypoints(gdir2, addr2, labelsNull);
    var count = (result.match(/<wpt/g) || []).length;
    expect(count).toBe(3);
  });

  test('start wpt has correct coordinates', function() {
    var result = exportFns.createGarminGpxWaypoints(gdir2, addr2, labelsNull);
    expect(result).toContain('lat="1" lon="2"');
  });

  test('leg endpoint wpts have correct coordinates', function() {
    var result = exportFns.createGarminGpxWaypoints(gdir2, addr2, labelsNull);
    expect(result).toContain('lat="3" lon="4"');
    expect(result).toContain('lat="5" lon="6"');
  });

  test('waypoint names are zero-padded with three digits', function() {
    var result = exportFns.createGarminGpxWaypoints(gdir2, addr2, labelsNull);
    expect(result).toContain('OptiMap 001');
    expect(result).toContain('OptiMap 002');
  });

  test('start wpt name includes addr in parentheses', function() {
    // Source: label = "OptiMap Start" then label += "(" + addr[0] + ")"
    var result = exportFns.createGarminGpxWaypoints(gdir2, addr2, labelsNull);
    expect(result).toContain('OptiMap Start(Start)');
  });

  test('waypoint names include addr in parentheses', function() {
    // Source: label = "OptiMap 001 " then label += "(" + addr[offset] + ")"
    var result = exportFns.createGarminGpxWaypoints(gdir2, addr2, labelsNull);
    expect(result).toContain('OptiMap 001 (Middle)');
    expect(result).toContain('OptiMap 002 (End)');
  });

  test('uses named labels when provided', function() {
    var result = exportFns.createGarminGpxWaypoints(gdir2, addr2, labelsNamed);
    expect(result).toContain('(LabelA)');
    expect(result).toContain('(LabelB)');
    expect(result).toContain('(LabelC)');
    expect(result).not.toContain('(Start)');
  });

  test('closes gpx without rte element', function() {
    var result = exportFns.createGarminGpxWaypoints(gdir2, addr2, labelsNull);
    expect(result).toContain('</gpx>');
    expect(result).not.toContain('<rte>');
  });

  test('returns null and does not throw for empty legs', function() {
    var result = exportFns.createGarminGpxWaypoints({ legs: [] }, [], []);
    expect(result).toBeNull();
  });
});
