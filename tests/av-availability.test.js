const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const read = (file) => readFileSync(resolve(__dirname, '..', file), 'utf8');
const portfolio = read('av/index.html');
const availability = read('av/availability/index.html');
const calendar = read('av/availability/calendar.js');
const { pacificDate, buildMonth, upcomingOpenings, upcomingBooked, initialMonth, holdHref, bookedDays } = require('../av/availability/calendar.js');

test('portfolio has a prominent availability link and retains the hold section', () => {
  assert.match(portfolio, /class="btn" href="\/av\/availability\/">See available dates<\/a>/);
  assert.match(portfolio, /id="booking"/);
  assert.match(portfolio, /class="booking-actions"><a href="\/av\/availability\/">See available dates<\/a>/);
});

test('noindex availability lists only approved dates and has no calendar connection', () => {
  assert.match(availability, /name="robots" content="noindex"/);
  assert.match(availability, /No dates are listed yet/);
  assert.match(availability, /San Diego · Pacific time/);
  assert.match(availability, /<table aria-labelledby="month-label">/);
  assert.match(availability, /aria-label="Previous month"/);
  assert.match(availability, /aria-label="Next month"/);
  assert.match(availability, /<script src="\.\/calendar\.js" defer><\/script>/);
  assert.doesNotMatch(availability, /<time\b|\b20\d{2}-\d{2}-\d{2}\b|<(?:iframe|form)\b|https?:\/\//);
  assert.match(calendar, /const offeredDays = new Set\(\['2026-11-24', '2026-11-28', '2026-12-05', '2026-12-10', '2026-12-13', '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27'\]\);/);
  assert.match(calendar, /\['2026-11-27', 'Supervisor · Manchester Grand Hyatt'\]/);
  assert.match(calendar, /\['2026-12-06', 'A1 Audio Engineer · Manchester Grand Hyatt'\]/);
  assert.match(availability, /class="swatch offered"/);
  assert.match(availability, /class="swatch booked"/);
  assert.match(availability, /id="booked-list"/);
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

test('booked days carry their approved role and venue labels', () => {
  assert.equal(bookedDays.size, 14);
  assert.equal(bookedDays.get('2026-11-30'), 'Floor · Manchester Grand Hyatt');
  assert.equal(bookedDays.get('2026-12-14'), 'Lighting Tech · Manchester Grand Hyatt');
  const view = buildMonth(2026, 10, '2026-11-01');
  assert.equal(view.cells.find((cell) => cell?.day === 27).booked, 'Supervisor · Manchester Grand Hyatt');
  assert.equal(view.cells.find((cell) => cell?.day === 24).offered, true);
  assert.equal(view.cells.find((cell) => cell?.day === 24).booked, undefined);
  assert.deepEqual(upcomingBooked('2026-12-13').map(([day]) => day), ['2026-12-14', '2026-12-15']);
});

test('tapping a date drafts a hold email for that day', () => {
  const mail = new URL(holdHref('2026-11-24'));
  assert.equal(mail.protocol, 'mailto:');
  assert.equal(mail.pathname, 'tmsteph1290@gmail.com');
  assert.equal(mail.searchParams.get('subject'), 'AV hold request');
  assert.match(mail.searchParams.get('body'), /Dates and call times \(with time zone\): Tue, November 24, 2026\nVenue and city:\nRole:\nOffered rate:/);
});

test('only expressly offered days not already past can be marked', () => {
  const view = buildMonth(2028, 1, '2028-02-20', new Set(['2028-02-10', '2028-02-29']));
  assert.equal(view.cells.filter(Boolean).length, 29);
  assert.deepEqual(view.cells.filter((cell) => cell?.offered), [{ day: 29, offered: true }]);
  assert.equal(buildMonth(2028, 1, '2028-02-20').cells.filter((cell) => cell?.offered).length, 0);
});

test('calendar initializes, navigates, and leaves every day unmarked once offerings have passed', () => {
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
  const ids = Object.fromEntries(['calendar', 'days', 'month-label', 'dates-status', 'previous', 'next', 'openings', 'openings-list', 'booked', 'booked-list'].map((id) => [id, element()]));
  const document = { getElementById: (id) => ids[id], createElement: element, createDocumentFragment: element };
  class LaterDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2027-02-15T12:00:00Z'])); }
  }

  runInNewContext(calendar, { document, Date: LaterDate });
  assert.equal(ids.calendar.hidden, false);
  assert.equal(ids.openings.hidden, true);
  assert.equal(ids['openings-list'].children.length, 0);
  assert.equal(ids['month-label'].textContent, 'February 2027');
  assert.match(ids['dates-status'].textContent, /No available dates are listed for this month/);
  assert.equal(ids.booked.hidden, true);
  assert.equal(ids['booked-list'].children.length, 0);
  assert.ok(ids.days.children.every((row) => row.children.length === 7 && row.children.every((day) => day.classes.length === 0)));

  ids.next.listeners.click();
  assert.equal(ids['month-label'].textContent, 'March 2027');
  assert.match(ids['dates-status'].textContent, /No available dates are listed for this month/);
  ids.previous.listeners.click();
  assert.equal(ids['month-label'].textContent, 'February 2027');

  class FrozenDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-12-01T07:59:59Z'])); }
  }
  const sample = calendar.replace(/const offeredDays = new Set\(\[.*\]\);/, "const offeredDays = new Set(['2027-01-02', '2026-11-29', '2026-12-01']);");
  runInNewContext(sample, { document, Date: FrozenDate });
  assert.equal(ids['month-label'].textContent, 'December 2026');
  assert.equal(ids.openings.hidden, false);
  const posted = ids['openings-list'].children.map((item) => item.children[0].children[0].dateTime);
  assert.deepEqual(posted, ['2026-12-01', '2027-01-02']);
  assert.equal(ids.booked.hidden, false);
  assert.equal(ids['booked-list'].children.length, 12);
  assert.match(ids['booked-list'].children[0].children[1].textContent, /Floor · Manchester Grand Hyatt/);
  assert.match(ids['dates-status'].textContent, /Tap a green date/);
});

test('earliest current or future offering chooses the opening month across year rollover', () => {
  const today = { year: 2026, month: 11, key: '2026-12-30' };
  const openings = upcomingOpenings(today.key, new Set(['2027-01-06', '2026-12-29', '2027-01-02']));
  assert.deepEqual(openings, ['2027-01-02', '2027-01-06']);
  assert.equal(buildMonth(today.year, initialMonth(today, openings), today.key).label, 'January 2027');
  assert.equal(initialMonth(today, []), 11);
  assert.deepEqual(upcomingOpenings(today.key, new Set(['2026-12-30'])), ['2026-12-30']);
});
