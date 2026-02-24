var fs = require('fs');
var path = require('path');

// Load tsp.js and extract the pure utility functions.
// The IIFE creates an isolated scope; eval in non-strict mode hoists
// function declarations into that scope so we can return them by name.
var tspFns = (function() {
  var tspSource = fs.readFileSync(path.resolve(__dirname, '../js/tsp.js'), 'utf8');
  eval(tspSource);
  return {
    formatTime: formatTime,
    formatLength: formatLength,
    formatLengthMiles: formatLengthMiles,
    getTotalDuration: getTotalDuration,
    getTotalDistance: getTotalDistance,
  };
})();

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------
// Behaviour (from source):
//   - always appends "N sec" when days == 0 && hours == 0 (even if sec == 0)
//   - appends trailing space after "min " and "hrs "
//   - does NOT append seconds when hours > 0 (regardless of minutes)
// ---------------------------------------------------------------------------
describe('formatTime', function() {
  test('0 seconds', function() {
    expect(tspFns.formatTime(0)).toBe('0 sec');
  });

  test('1 second', function() {
    expect(tspFns.formatTime(1)).toBe('1 sec');
  });

  test('59 seconds', function() {
    expect(tspFns.formatTime(59)).toBe('59 sec');
  });

  test('60 seconds — shows minutes then appends 0 sec', function() {
    // The "0 sec" is always appended when days==0 && hours==0
    expect(tspFns.formatTime(60)).toBe('1 min 0 sec');
  });

  test('61 seconds', function() {
    expect(tspFns.formatTime(61)).toBe('1 min 1 sec');
  });

  test('90 seconds', function() {
    expect(tspFns.formatTime(90)).toBe('1 min 30 sec');
  });

  test('1 hour exactly — no seconds printed when hours > 0', function() {
    expect(tspFns.formatTime(3600)).toBe('1 hrs 0 min ');
  });

  test('1 hour 1 min 1 sec — seconds omitted because hours > 0', function() {
    expect(tspFns.formatTime(3661)).toBe('1 hrs 1 min ');
  });

  test('2 hours 30 minutes', function() {
    expect(tspFns.formatTime(9000)).toBe('2 hrs 30 min ');
  });

  test('1 day exactly', function() {
    expect(tspFns.formatTime(86400)).toBe('1 days 0 hrs 0 min ');
  });
});

// ---------------------------------------------------------------------------
// formatLength
// ---------------------------------------------------------------------------
// Behaviour:
//   - always appends "N m" when km < 10 (even if meters == 0)
//   - appends trailing space after "N km "
//   - does NOT append meters when km >= 10
// ---------------------------------------------------------------------------
describe('formatLength', function() {
  test('0 meters', function() {
    expect(tspFns.formatLength(0)).toBe('0 m');
  });

  test('500 meters', function() {
    expect(tspFns.formatLength(500)).toBe('500 m');
  });

  test('999 meters', function() {
    expect(tspFns.formatLength(999)).toBe('999 m');
  });

  test('1000 meters — shows km then appends 0 m', function() {
    // "0 m" is always appended when km < 10
    expect(tspFns.formatLength(1000)).toBe('1 km 0 m');
  });

  test('1500 meters', function() {
    expect(tspFns.formatLength(1500)).toBe('1 km 500 m');
  });

  test('9999 meters', function() {
    expect(tspFns.formatLength(9999)).toBe('9 km 999 m');
  });

  test('10000 meters — no meters portion when km >= 10', function() {
    expect(tspFns.formatLength(10000)).toBe('10 km ');
  });

  test('15500 meters', function() {
    expect(tspFns.formatLength(15500)).toBe('15 km ');
  });
});

// ---------------------------------------------------------------------------
// formatLengthMiles
// ---------------------------------------------------------------------------
// Uses: sMeters = meters * 0.621371192
//       miles = parseInt(sMeters / 1000)
//       commaMiles = parseInt((sMeters - miles*1000 + 50) / 100)
// ---------------------------------------------------------------------------
describe('formatLengthMiles', function() {
  test('0 meters', function() {
    expect(tspFns.formatLengthMiles(0)).toBe('0.0 miles');
  });

  test('1609.344 meters — floating point puts sMeters just under 1000', function() {
    // 1609.344 * 0.621371192 ≈ 999.999... (just under 1000 due to float arithmetic)
    // miles = parseInt(999.999/1000) = 0
    // commaMiles = parseInt((999.999+50)/100) = parseInt(10.499) = 10
    expect(tspFns.formatLengthMiles(1609.344)).toBe('0.10 miles');
  });

  test('1000 meters (~0.6 miles)', function() {
    // sMeters = 621.371..., miles=0, commaMiles = parseInt((621.371+50)/100) = 6
    expect(tspFns.formatLengthMiles(1000)).toBe('0.6 miles');
  });

  test('5000 meters (~3.1 miles)', function() {
    // sMeters = 3106.855..., miles=3, commaMiles = parseInt((106.855+50)/100) = 1
    expect(tspFns.formatLengthMiles(5000)).toBe('3.1 miles');
  });
});

// ---------------------------------------------------------------------------
// getTotalDuration
// ---------------------------------------------------------------------------
describe('getTotalDuration', function() {
  test('returns 0 for empty legs array', function() {
    expect(tspFns.getTotalDuration({ legs: [] })).toBe(0);
  });

  test('returns duration value of a single leg', function() {
    expect(tspFns.getTotalDuration({
      legs: [{ duration: { value: 120 }, distance: { value: 0 } }],
    })).toBe(120);
  });

  test('sums durations across multiple legs', function() {
    expect(tspFns.getTotalDuration({
      legs: [
        { duration: { value: 300 }, distance: { value: 0 } },
        { duration: { value: 600 }, distance: { value: 0 } },
      ],
    })).toBe(900);
  });

  test('sums three legs', function() {
    expect(tspFns.getTotalDuration({
      legs: [
        { duration: { value: 100 }, distance: { value: 0 } },
        { duration: { value: 200 }, distance: { value: 0 } },
        { duration: { value: 300 }, distance: { value: 0 } },
      ],
    })).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// getTotalDistance
// ---------------------------------------------------------------------------
describe('getTotalDistance', function() {
  test('returns 0 for empty legs array', function() {
    expect(tspFns.getTotalDistance({ legs: [] })).toBe(0);
  });

  test('returns distance value of a single leg', function() {
    expect(tspFns.getTotalDistance({
      legs: [{ duration: { value: 0 }, distance: { value: 750 } }],
    })).toBe(750);
  });

  test('sums distances across multiple legs', function() {
    expect(tspFns.getTotalDistance({
      legs: [
        { duration: { value: 0 }, distance: { value: 500 } },
        { duration: { value: 0 }, distance: { value: 1000 } },
      ],
    })).toBe(1500);
  });

  test('sums three legs', function() {
    expect(tspFns.getTotalDistance({
      legs: [
        { duration: { value: 0 }, distance: { value: 1000 } },
        { duration: { value: 0 }, distance: { value: 2000 } },
        { duration: { value: 0 }, distance: { value: 3000 } },
      ],
    })).toBe(6000);
  });
});
