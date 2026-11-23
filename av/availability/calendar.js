// Full days explicitly approved for public sharing, YYYY-MM-DD in Pacific time.
const offeredDays = new Set();
const pacificDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
});
const monthFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', year: 'numeric', month: 'long',
});

function pacificDate(now) {
  const parts = Object.fromEntries(pacificDateFormat.formatToParts(now).map(({ type, value }) => [type, value]));
  return { year: Number(parts.year), month: Number(parts.month) - 1, key: `${parts.year}-${parts.month}-${parts.day}` };
}

function buildMonth(year, month, today, offerings = offeredDays) {
  const first = new Date(Date.UTC(year, month, 1));
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leading = first.getUTCDay();
  const cellCount = Math.ceil((leading + length) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - leading + 1;
    if (day < 1 || day > length) return null;
    const key = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    return { day, offered: key >= today && offerings.has(key) };
  });
  return { label: monthFormat.format(first), cells };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { pacificDate, buildMonth };

if (typeof document !== 'undefined') {
  const today = pacificDate(new Date());
  let month = today.month;
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
          td.textContent = String(cell.day);
          if (cell.offered) {
            td.classList.add('offered');
            const badge = document.createElement('span');
            badge.className = 'sr-only';
            badge.textContent = ' (offered)';
            td.append(badge);
          }
        }
        row.append(td);
      }
      rows.append(row);
    }
    tableBody.replaceChildren(rows);
    status.textContent = view.cells.some((cell) => cell?.offered)
      ? 'Highlighted dates are offered. Unmarked days don’t indicate availability.'
      : 'No dates are listed for this month. Unmarked days don’t indicate availability.';
  }
  document.getElementById('previous').addEventListener('click', () => { month -= 1; render(); });
  document.getElementById('next').addEventListener('click', () => { month += 1; render(); });
  render();
  document.getElementById('calendar').hidden = false;
}
