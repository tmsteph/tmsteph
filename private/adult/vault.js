(() => {
  'use strict';

  const STORAGE_KEY = 'tmstephAdultVault.v1';
  const PBKDF2_ITERATIONS = 250000;

  const gate = document.querySelector('#gate');
  const setupPanel = document.querySelector('#setup-panel');
  const unlockPanel = document.querySelector('#unlock-panel');
  const gateStatus = document.querySelector('#gate-status');
  const vault = document.querySelector('#vault');
  const vaultStatus = document.querySelector('#vault-status');
  const lockButton = document.querySelector('#lock-button');
  const setupForm = document.querySelector('#setup-form');
  const unlockForm = document.querySelector('#unlock-form');
  const setupPassphrase = document.querySelector('#setup-passphrase');
  const setupConfirm = document.querySelector('#setup-confirm');
  const unlockPassphrase = document.querySelector('#unlock-passphrase');
  const newEntryButton = document.querySelector('#new-entry-button');
  const exportButton = document.querySelector('#export-button');
  const importInput = document.querySelector('#import-input');
  const searchInput = document.querySelector('#search-input');
  const favoritesOnly = document.querySelector('#favorites-only');
  const entryGrid = document.querySelector('#entry-grid');
  const emptyState = document.querySelector('#empty-state');

  const dialog = document.querySelector('#entry-dialog');
  const entryForm = document.querySelector('#entry-form');
  const dialogTitle = document.querySelector('#dialog-title');
  const dialogClose = document.querySelector('#dialog-close');
  const cancelEntryButton = document.querySelector('#cancel-entry-button');
  const deleteEntryButton = document.querySelector('#delete-entry-button');

  const fields = {
    id: document.querySelector('#entry-id'),
    performer: document.querySelector('#performer'),
    aliases: document.querySelector('#aliases'),
    sourceUrl: document.querySelector('#source-url'),
    title: document.querySelector('#entry-title'),
    tags: document.querySelector('#tags'),
    provenance: document.querySelector('#provenance'),
    notes: document.querySelector('#notes'),
    adultConfirmed: document.querySelector('#adult-confirmed'),
    favorite: document.querySelector('#favorite')
  };

  let vaultKey = null;
  let vaultData = null;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }

  function getStoredEnvelope() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || !parsed.salt || !parsed.iv || !parsed.ciphertext) {
        throw new Error('Invalid vault format');
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async function deriveKey(passphrase, salt) {
    const material = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations: PBKDF2_ITERATIONS
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptData(key, salt, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = encoder.encode(JSON.stringify(data));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

    return {
      version: 1,
      kdf: 'PBKDF2-SHA-256',
      iterations: PBKDF2_ITERATIONS,
      cipher: 'AES-256-GCM',
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(encrypted)),
      updatedAt: new Date().toISOString()
    };
  }

  async function decryptEnvelope(passphrase, envelope) {
    const salt = base64ToBytes(envelope.salt);
    const key = await deriveKey(passphrase, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
      key,
      base64ToBytes(envelope.ciphertext)
    );
    const data = JSON.parse(decoder.decode(plaintext));

    if (!data || !Array.isArray(data.records)) {
      throw new Error('Invalid vault data');
    }

    return { key, data, salt };
  }

  async function persist() {
    if (!vaultKey || !vaultData) return;
    const existing = getStoredEnvelope();
    if (!existing) throw new Error('Vault envelope missing');
    const salt = base64ToBytes(existing.salt);
    const envelope = await encryptData(vaultKey, salt, vaultData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  }

  function showGateMode() {
    const stored = getStoredEnvelope();
    setupPanel.classList.toggle('hidden', Boolean(stored));
    unlockPanel.classList.toggle('hidden', !stored);
    gateStatus.textContent = stored
      ? 'Enter your passphrase. Your encrypted catalog stays on this device.'
      : 'First use: create a passphrase to initialize this browser’s vault.';
  }

  function setUnlocked(unlocked) {
    gate.classList.toggle('hidden', unlocked);
    vault.classList.toggle('hidden', !unlocked);
    lockButton.classList.toggle('hidden', !unlocked);
    if (unlocked) renderEntries();
  }

  function lockVault() {
    vaultKey = null;
    vaultData = null;
    unlockForm.reset();
    entryForm.reset();
    setUnlocked(false);
    showGateMode();
  }

  function parseList(value) {
    return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
  }

  function normalizeUrl(value) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Only http/https source links are allowed.');
    }
    return url.toString();
  }

  function safeText(value) {
    return String(value ?? '');
  }

  function visibleRecords() {
    const query = searchInput.value.trim().toLowerCase();
    return vaultData.records
      .filter(record => !favoritesOnly.checked || record.favorite)
      .filter(record => {
        if (!query) return true;
        const haystack = [
          record.performer,
          record.title,
          ...(record.aliases || []),
          ...(record.tags || []),
          record.notes,
          record.provenance
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });
  }

  function makeEntryCard(record) {
    const article = document.createElement('article');
    article.className = 'entry-card' + (record.favorite ? ' favorite' : '');

    const top = document.createElement('div');
    top.className = 'entry-top';

    const headingWrap = document.createElement('div');
    const heading = document.createElement('h2');
    heading.textContent = record.performer;
    headingWrap.appendChild(heading);

    if (record.aliases?.length) {
      const aliases = document.createElement('p');
      aliases.className = 'entry-aliases';
      aliases.textContent = record.aliases.join(' · ');
      headingWrap.appendChild(aliases);
    }

    top.appendChild(headingWrap);

    if (record.favorite) {
      const star = document.createElement('span');
      star.className = 'favorite-mark';
      star.textContent = '★';
      star.setAttribute('aria-label', 'Favorite');
      top.appendChild(star);
    }

    article.appendChild(top);

    if (record.title) {
      const title = document.createElement('p');
      title.textContent = record.title;
      article.appendChild(title);
    }

    if (record.notes) {
      const notes = document.createElement('p');
      notes.className = 'entry-notes';
      notes.textContent = record.notes;
      article.appendChild(notes);
    }

    if (record.tags?.length) {
      const tags = document.createElement('div');
      tags.className = 'tags';
      record.tags.forEach(tagValue => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = tagValue;
        tags.appendChild(tag);
      });
      article.appendChild(tags);
    }

    const meta = document.createElement('p');
    meta.className = 'entry-meta';
    const provenance = record.provenance ? ` · ${record.provenance}` : '';
    meta.textContent = `18+ confirmed${provenance}`;
    article.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'entry-actions';

    const open = document.createElement('a');
    open.href = record.sourceUrl;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.referrerPolicy = 'no-referrer';
    open.textContent = 'Open source ↗';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => openEntryDialog(record));

    actions.append(open, edit);
    article.appendChild(actions);

    return article;
  }

  function renderEntries() {
    if (!vaultData) return;
    entryGrid.replaceChildren();
    const records = visibleRecords();
    emptyState.classList.toggle('hidden', records.length !== 0);

    if (!records.length && (searchInput.value || favoritesOnly.checked)) {
      emptyState.querySelector('h2').textContent = 'Nothing matches';
      emptyState.querySelector('p:last-child').textContent = 'Try another search or clear the favorites filter.';
    } else {
      emptyState.querySelector('h2').textContent = 'No entries yet';
      emptyState.querySelector('p:last-child').textContent = 'Add the first source you want to remember.';
    }

    records.forEach(record => entryGrid.appendChild(makeEntryCard(record)));
  }

  function openEntryDialog(record = null) {
    entryForm.reset();
    vaultStatus.textContent = '';

    if (record) {
      dialogTitle.textContent = 'Edit entry';
      fields.id.value = record.id;
      fields.performer.value = safeText(record.performer);
      fields.aliases.value = (record.aliases || []).join(', ');
      fields.sourceUrl.value = safeText(record.sourceUrl);
      fields.title.value = safeText(record.title);
      fields.tags.value = (record.tags || []).join(', ');
      fields.provenance.value = safeText(record.provenance);
      fields.notes.value = safeText(record.notes);
      fields.adultConfirmed.checked = Boolean(record.adultConfirmed);
      fields.favorite.checked = Boolean(record.favorite);
      deleteEntryButton.classList.remove('hidden');
    } else {
      dialogTitle.textContent = 'Add entry';
      fields.id.value = '';
      deleteEntryButton.classList.add('hidden');
    }

    dialog.showModal();
    requestAnimationFrame(() => fields.performer.focus());
  }

  function closeEntryDialog() {
    if (dialog.open) dialog.close();
    entryForm.reset();
  }

  setupForm.addEventListener('submit', async event => {
    event.preventDefault();
    gateStatus.textContent = 'Creating encrypted vault…';

    try {
      if (!window.crypto?.subtle) throw new Error('Web Crypto is unavailable in this browser.');
      if (setupPassphrase.value.length < 8) throw new Error('Use at least 8 characters.');
      if (setupPassphrase.value !== setupConfirm.value) throw new Error('Passphrases do not match.');

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(setupPassphrase.value, salt);
      const data = { version: 1, createdAt: new Date().toISOString(), records: [] };
      const envelope = await encryptData(key, salt, data);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      vaultKey = key;
      vaultData = data;
      setupForm.reset();
      setUnlocked(true);
      vaultStatus.textContent = 'Vault created. Consider exporting an encrypted backup after you add entries.';
    } catch (error) {
      gateStatus.textContent = error.message || 'Could not create vault.';
    }
  });

  unlockForm.addEventListener('submit', async event => {
    event.preventDefault();
    gateStatus.textContent = 'Unlocking…';

    try {
      const envelope = getStoredEnvelope();
      if (!envelope) throw new Error('No readable vault was found in this browser.');
      const unlocked = await decryptEnvelope(unlockPassphrase.value, envelope);
      vaultKey = unlocked.key;
      vaultData = unlocked.data;
      unlockForm.reset();
      setUnlocked(true);
      vaultStatus.textContent = 'Unlocked.';
    } catch {
      gateStatus.textContent = 'Could not unlock. Check the passphrase or restore a valid encrypted backup.';
    }
  });

  entryForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!vaultData) return;

    try {
      if (!fields.adultConfirmed.checked) {
        throw new Error('You must confirm the adult/consent requirement before saving.');
      }

      const now = new Date().toISOString();
      const existing = vaultData.records.find(record => record.id === fields.id.value);
      const record = {
        id: existing?.id || crypto.randomUUID(),
        performer: fields.performer.value.trim(),
        aliases: parseList(fields.aliases.value),
        sourceUrl: normalizeUrl(fields.sourceUrl.value.trim()),
        title: fields.title.value.trim(),
        tags: parseList(fields.tags.value),
        provenance: fields.provenance.value.trim(),
        notes: fields.notes.value.trim(),
        adultConfirmed: true,
        favorite: fields.favorite.checked,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };

      if (!record.performer) throw new Error('Add a performer or creator name.');

      if (existing) {
        Object.assign(existing, record);
      } else {
        vaultData.records.push(record);
      }

      await persist();
      closeEntryDialog();
      renderEntries();
      vaultStatus.textContent = existing ? 'Entry updated.' : 'Entry saved.';
    } catch (error) {
      vaultStatus.textContent = error.message || 'Could not save entry.';
    }
  });

  deleteEntryButton.addEventListener('click', async () => {
    if (!vaultData || !fields.id.value) return;
    const record = vaultData.records.find(item => item.id === fields.id.value);
    if (!record) return;
    if (!confirm(`Delete ${record.performer} from this vault?`)) return;

    vaultData.records = vaultData.records.filter(item => item.id !== fields.id.value);
    await persist();
    closeEntryDialog();
    renderEntries();
    vaultStatus.textContent = 'Entry deleted.';
  });

  exportButton.addEventListener('click', () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tmsteph-adult-vault-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    vaultStatus.textContent = 'Encrypted backup exported.';
  });

  importInput.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || parsed.version !== 1 || !parsed.salt || !parsed.iv || !parsed.ciphertext) {
        throw new Error('That file is not a valid vault backup.');
      }

      if (!confirm('Replace the encrypted vault currently stored in this browser with this backup?')) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      lockVault();
      gateStatus.textContent = 'Backup imported. Unlock it with the passphrase used when it was created.';
    } catch (error) {
      vaultStatus.textContent = error.message || 'Could not import backup.';
    }
  });

  newEntryButton.addEventListener('click', () => openEntryDialog());
  lockButton.addEventListener('click', lockVault);
  dialogClose.addEventListener('click', closeEntryDialog);
  cancelEntryButton.addEventListener('click', closeEntryDialog);
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) closeEntryDialog();
  });
  searchInput.addEventListener('input', renderEntries);
  favoritesOnly.addEventListener('change', renderEntries);

  window.addEventListener('pagehide', () => {
    vaultKey = null;
    vaultData = null;
  });

  showGateMode();
})();
