const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const read = (file) => readFileSync(resolve(__dirname, '..', file), 'utf8');
const portfolio = read('av/index.html');
const availability = read('av/availability/index.html');
const calendar = read('av/availability/calendar.js');
const { pacificDate, buildMonth } = require('../av/availability/calendar.js');

test('portfolio availability call to action leads to the public hold request', () => {
  assert.match(portfolio, /href="#booking">Check availability<\/a>/);
  assert.match(portfolio, /id="booking"/);
  assert.doesNotMatch(portfolio, /href="[^"]*\/availability\/?"/);
});

test('unlisted availability starts without dates or a calendar connection', () => {
  assert.match(availability, /name="robots" content="noindex"/);
  assert.match(availability, /No dates are listed yet/);
  assert.match(availability, /San Diego · Pacific time/);
  assert.match(availability, /<table aria-labelledby="month-label">/);
  assert.match(availability, /aria-label="Previous month"/);
  assert.match(availability, /aria-label="Next month"/);
  assert.match(availability, /<script src="\.\/calendar\.js" defer><\/script>/);
  assert.doesNotMatch(availability, /<time\b|\b20\d{2}-\d{2}-\d{2}\b|<(?:iframe|form)\b|https?:\/\//);
  assert.match(calendar, /const offeredDays = new Set\(\);/);
  assert.doesNotMatch(calendar, /\b(?:fetch|XMLHttpRequest|sendBeacon)\b/);
});

for (const [page, html] of Object.entries({ portfolio, availability })) {
  test(`${page} requests a hold by draft only and asks for key show details`, () => {
    const match = html.match(/href="([^"]+)">Request a hold<\/a>/);
    assert.ok(match);
    const mail = new URL(match[1].replaceAll('&amp;', '&'));
    assert.equal(mail.protocol, 'mailto:');
    assert.equal(mail.pathname, 'tmsteph1290@gmail.com');
    assert.equal(mail.searchParams.get('subject'), 'AV hold request');
    assert.match(mail.searchParams.get('body'), /Dates and call times \(with time zone\):\r\nVenue and city:\r\nRole:\r\nOffered rate:/);
    assert.match(html, /A hold is not confirmed until I reply\./);
  });
}

test('initial date uses Pacific time across the UTC and local month boundaries', () => {
  assert.deepEqual(pacificDate(new Date('2026-12-01T07:59:59Z')), { year: 2026, month: 10, key: '2026-11-30' });
  assert.deepEqual(pacificDate(new Date('2026-12-01T08:00:00Z')), { year: 2026, month: 11, key: '2026-12-01' });
});

test('month rows align Sunday-first and navigation crosses a year without invalid dates', () => {
  const view = buildMonth(2026, 12, '2026-12-01');
  assert.equal(view.label, 'January 2027');
  assert.equal(view.cells.length, 42);
  assert.deepEqual(view.cells.slice(0, 7), [null, null, null, null, null, { day: 1, offered: false }, { day: 2, offered: false }]);
  assert.equal(view.cells.filter(Boolean).length, 31);
});

test('only expressly offered days not already past can be marked', () => {
  const view = buildMonth(2028, 1, '2028-02-20', new Set(['2028-02-10', '2028-02-29']));
  assert.equal(view.cells.filter(Boolean).length, 29);
  assert.deepEqual(view.cells.filter((cell) => cell?.offered), [{ day: 29, offered: true }]);
  assert.equal(buildMonth(2028, 1, '2028-02-20').cells.filter((cell) => cell?.offered).length, 0);
});

test('calendar initializes, navigates, and leaves every day unmarked', () => {
  const { runInNewContext } = require('node:vm');
  function element() {
    return {
      children: [], listeners: {}, classes: [], textContent: '', hidden: true,
      append(child) { this.children.push(child); },
      replaceChildren(fragment) { this.children = fragment.children; },
      addEventListener(type, listener) { this.listeners[type] = listener; },
      get classList() { return { add: (name) => this.classes.push(name) }; },
    };
  }
  const ids = Object.fromEntries(['calendar', 'days', 'month-label', 'dates-status', 'previous', 'next'].map((id) => [id, element()]));
  const document = { getElementById: (id) => ids[id], createElement: element, createDocumentFragment: element };
  class FrozenDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-12-01T07:59:59Z'])); }
  }

  runInNewContext(calendar, { document, Date: FrozenDate });
  assert.equal(ids.calendar.hidden, false);
  assert.equal(ids['month-label'].textContent, 'November 2026');
  assert.match(ids['dates-status'].textContent, /No dates are listed for this month/);
  assert.ok(ids.days.children.every((row) => row.children.length === 7 && row.children.every((day) => day.classes.length === 0)));

  ids.next.listeners.click();
  assert.equal(ids['month-label'].textContent, 'December 2026');
  assert.match(ids['dates-status'].textContent, /No dates are listed for this month/);
  ids.previous.listeners.click();
  assert.equal(ids['month-label'].textContent, 'November 2026');
});
