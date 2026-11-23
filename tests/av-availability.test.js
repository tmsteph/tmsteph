const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const read = (file) => readFileSync(resolve(__dirname, '..', file), 'utf8');
const portfolio = read('av/index.html');
const availability = read('av/availability/index.html');

test('portfolio availability call to action leads to the public hold request', () => {
  assert.match(portfolio, /href="#booking">Check availability<\/a>/);
  assert.match(portfolio, /id="booking"/);
  assert.doesNotMatch(portfolio, /href="[^"]*\/availability\/?"/);
});

test('unlisted availability starts without dates or a calendar connection', () => {
  assert.match(availability, /name="robots" content="noindex"/);
  assert.match(availability, /No dates are listed yet/);
  assert.match(availability, /San Diego · Pacific time/);
  assert.doesNotMatch(availability, /<time\b|\b20\d{2}-\d{2}-\d{2}\b|<(?:script|iframe|form)\b|https?:\/\//);
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
