// Full days explicitly approved for public sharing, YYYY-MM-DD in Pacific time.
// Rule (Thomas, 2026-11-23): any day with no personal or professional
// appointment is available; Encore show days are listed as booked.
const offeredDays = new Set(['2026-11-24', '2026-11-28', '2026-12-05', '2026-12-10', '2026-12-13', '2026-12-16', '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27']);
// Booked days Thomas approved for public sharing on 2026-11-23: role and venue only.
const bookedDays = new Map([
  ['2026-11-27', 'Supervisor · Manchester Grand Hyatt'],
  ['2026-11-29', 'Supervisor · Manchester Grand Hyatt'],
  ['2026-11-30', 'Floor · Manchester Grand Hyatt'],
  ['2026-12-02', 'Breakout Op · Manchester Grand Hyatt'],
  ['2026-12-03', 'Breakout Op · Manchester Grand Hyatt'],
  ['2026-12-04', 'Breakout Op · Manchester Grand Hyatt'],
  ['2026-12-06', 'A1 Audio Engineer · Manchester Grand Hyatt'],
  ['2026-12-07', 'A1 Audio Engineer · Manchester Grand Hyatt'],
  ['2026-12-08', 'A1 Audio Engineer · Manchester Grand Hyatt'],
  ['2026-12-09', 'A1 Audio Engineer · Manchester Grand Hyatt'],
  ['2026-12-11', 'Audio Tech · Manchester Grand Hyatt'],
  ['2026-12-12', 'Audio Tech · Manchester Grand Hyatt'],
  ['2026-12-14', 'Lighting Tech · Manchester Grand Hyatt'],
  ['2026-12-15', 'Breakout Op · Manchester Grand Hyatt'],
]);
const pacificDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
});
const monthFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', year: 'numeric', month: 'long',
});

const offeredDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
});

function upcomingOpenings(today, offerings = offeredDays) {
  return [...offerings].filter((day) => day >= today).sort();
}

function upcomingBooked(today, bookings = bookedDays) {
  return [...bookings].filter(([day]) => day >= today).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function holdHref(day) {
  const formatted = offeredDateFormat.format(new Date(`${day}T00:00:00Z`));
  const body = `Hi Thomas,\n\nAre you available for this show?\n\nDates and call times (with time zone): ${formatted}\nVenue and city:\nRole:\nOffered rate:\n\nThanks!`;
  return `mailto:tmsteph1290@gmail.com?subject=${encodeURIComponent('AV hold request')}&body=${encodeURIComponent(body)}`;
}

function initialMonth(today, openings) {
  if (!openings.length) return today.month;
  const [year, month] = openings[0].split('-').map(Number);
  return (year - today.year) * 12 + month - 1;
}

function pacificDate(now) {
  const parts = Object.fromEntries(pacificDateFormat.formatToParts(now).map(({ type, value }) => [type, value]));
  return { year: Number(parts.year), month: Number(parts.month) - 1, key: `${parts.year}-${parts.month}-${parts.day}` };
}

function buildMonth(year, month, today, offerings = offeredDays, bookings = bookedDays) {
  const first = new Date(Date.UTC(year, month, 1));
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leading = first.getUTCDay();
  const cellCount = Math.ceil((leading + length) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - leading + 1;
    if (day < 1 || day > length) return null;
    const key = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    const cell = { day, offered: key >= today && offerings.has(key) };
    const booked = bookings.get(key);
    if (booked) cell.booked = booked;
    return cell;
  });
  return { label: monthFormat.format(first), cells, year: first.getUTCFullYear(), month: first.getUTCMonth() };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { pacificDate, buildMonth, upcomingOpenings, upcomingBooked, initialMonth, holdHref, offeredDays, bookedDays };

if (typeof document !== 'undefined') {
  const today = pacificDate(new Date());
  const openings = upcomingOpenings(today.key);
  let month = initialMonth(today, openings);
  const openingsList = document.getElementById('openings-list');
  for (const day of openings) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = holdHref(day);
    const time = document.createElement('time');
    time.dateTime = day;
    time.textContent = offeredDateFormat.format(new Date(`${day}T00:00:00Z`));
    link.append(time);
    item.append(link);
    openingsList.append(item);
  }
  document.getElementById('openings').hidden = openings.length === 0;
  const booked = upcomingBooked(today.key);
  const bookedList = document.getElementById('booked-list');
  for (const [day, label] of booked) {
    const item = document.createElement('li');
    const time = document.createElement('time');
    time.dateTime = day;
    time.textContent = offeredDateFormat.format(new Date(`${day}T00:00:00Z`));
    const detail = document.createElement('span');
    detail.textContent = ` · ${label}`;
    item.append(time);
    item.append(detail);
    bookedList.append(item);
  }
  document.getElementById('booked').hidden = booked.length === 0;
  const tableBody = document.getElementById('days');
  const label = document.getElementById('month-label');
  const status = document.getElementById('dates-status');
  function render() {
    const view = buildMonth(today.year, month, today.key);
    label.textContent = view.label;
    const rows = document.createDocumentFragment();
    for (let index = 0; index < view.cells.length; index += 7) {
      const row = document.createElement('tr');
      for (const cell of view.cells.slice(index, index + 7)) {
        const td = document.createElement('td');
        if (cell) {
          const key = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
          if (cell.offered) {
            td.classList.add('offered');
            const link = document.createElement('a');
            link.href = holdHref(key);
            link.textContent = String(cell.day);
            const badge = document.createElement('span');
            badge.className = 'sr-only';
            badge.textContent = ' (available, email a hold request)';
            link.append(badge);
            td.append(link);
          } else {
            td.textContent = String(cell.day);
            if (cell.booked) {
              td.classList.add('booked');
              td.title = cell.booked;
              const badge = document.createElement('span');
              badge.className = 'sr-only';
              badge.textContent = ` (booked: ${cell.booked})`;
              td.append(badge);
            }
          }
        }
        row.append(td);
      }
      rows.append(row);
    }
    tableBody.replaceChildren(rows);
    status.textContent = view.cells.some((cell) => cell?.offered)
      ? 'Tap a green date to email a hold request for that day.'
      : 'No available dates are listed for this month.';
  }
  document.getElementById('previous').addEventListener('click', () => { month -= 1; render(); });
  document.getElementById('next').addEventListener('click', () => { month += 1; render(); });
  render();
  document.getElementById('calendar').hidden = false;
}
