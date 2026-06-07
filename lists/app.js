const STORAGE_KEY = 'tmsteph.lists.v1';
const SYNC_KEY_STORAGE_KEY = 'tmsteph.lists.syncKey.v1';
const CLIENT_ID_STORAGE_KEY = 'tmsteph.lists.clientId.v1';
const GUN_PEERS = window.__GUN_PEERS__ || [
  'wss://relay.3dvr.tech/gun',
  'wss://gun-relay-3dvr.fly.dev/gun',
];

let storageAvailable = true;
let syncAvailable = false;
let syncNode = null;
let activeSyncKey = '';
let applyingRemoteState = false;
let lastSyncedAt = 0;

const starterState = {
  activeListId: 'rosarito',
  lists: [
    {
      id: 'rosarito',
      name: 'Rosarito list',
      kind: 'House',
      notes: 'House list for errands, repairs, and anything to remember before or during a Rosarito trip.',
      items: [
        {
          id: 'dish-soap',
          text: 'Buy dish soap',
          type: 'todo',
          done: false,
          notes: 'Kitchen sink. Add brand or store once known.',
        },
        {
          id: 'toilet-fix',
          text: 'Fix the toilet',
          type: 'step',
          done: false,
          notes:
            '1. Shut off the water valve.\n2. Flush and hold the handle to drain the tank.\n3. Check flapper, chain, fill valve, and water level.\n4. Replace the worn part.\n5. Turn water back on and test for leaks.',
        },
      ],
    },
  ],
};

const storage = {
  load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      storageAvailable = false;
      return null;
    }
  },
  save(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageAvailable = true;
    } catch (_error) {
      storageAvailable = false;
    }
  },
};

const storedState = storage.load();
let hasStoredState = Boolean(storedState);
let state = normalizeState(storedState || starterState);
let filter = 'all';
let syncKey = loadSyncKey();
let clientId = loadClientId();

const elements = {
  storageStatus: document.getElementById('storageStatus'),
  syncDetail: document.getElementById('syncDetail'),
  syncForm: document.getElementById('syncForm'),
  syncKey: document.getElementById('syncKey'),
  quickCreateForm: document.getElementById('quickCreateForm'),
  newListName: document.getElementById('newListName'),
  listTabs: document.getElementById('listTabs'),
  activeListKind: document.getElementById('activeListKind'),
  activeListTitle: document.getElementById('activeListTitle'),
  activeListMeta: document.getElementById('activeListMeta'),
  renameListButton: document.getElementById('renameListButton'),
  deleteListButton: document.getElementById('deleteListButton'),
  addItemForm: document.getElementById('addItemForm'),
  itemText: document.getElementById('itemText'),
  itemType: document.getElementById('itemType'),
  items: document.getElementById('items'),
  listNotes: document.getElementById('listNotes'),
  seedButton: document.getElementById('seedButton'),
  exportButton: document.getElementById('exportButton'),
  importFile: document.getElementById('importFile'),
  listTabTemplate: document.getElementById('listTabTemplate'),
  itemTemplate: document.getElementById('itemTemplate'),
  filters: Array.from(document.querySelectorAll('[data-filter]')),
};

function createId(prefix = 'id') {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeReadableKey() {
  return `tmsteph-${Math.random().toString(36).slice(2, 6)}-${Date.now().toString(36).slice(-4)}`;
}

function cleanSyncKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function safeLocalGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_error) {
    storageAvailable = false;
    return '';
  }
}

function safeLocalSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    storageAvailable = true;
  } catch (_error) {
    storageAvailable = false;
  }
}

function loadClientId() {
  const existing = safeLocalGet(CLIENT_ID_STORAGE_KEY);
  if (existing) return existing;
  const nextClientId = createId('client');
  safeLocalSet(CLIENT_ID_STORAGE_KEY, nextClientId);
  return nextClientId;
}

function loadSyncKey() {
  const existing = cleanSyncKey(safeLocalGet(SYNC_KEY_STORAGE_KEY));
  if (existing) return existing;
  const nextSyncKey = makeReadableKey();
  safeLocalSet(SYNC_KEY_STORAGE_KEY, nextSyncKey);
  return nextSyncKey;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(nextState) {
  const lists = Array.isArray(nextState?.lists) && nextState.lists.length
    ? nextState.lists
    : clone(starterState.lists);
  return {
    activeListId: nextState?.activeListId || lists[0].id,
    updatedAt: Number(nextState?.updatedAt || 0),
    clientId: String(nextState?.clientId || ''),
    lists: lists.map((list) => ({
      id: list.id || createId('list'),
      name: String(list.name || 'Untitled list').trim() || 'Untitled list',
      kind: String(list.kind || 'List').trim() || 'List',
      notes: String(list.notes || ''),
      items: Array.isArray(list.items) ? list.items.map((item) => ({
        id: item.id || createId('item'),
        text: String(item.text || 'Untitled item').trim() || 'Untitled item',
        type: ['todo', 'note', 'step'].includes(item.type) ? item.type : 'todo',
        done: Boolean(item.done),
        notes: String(item.notes || ''),
      })) : [],
    })),
  };
}

function getActiveList() {
  return state.lists.find((list) => list.id === state.activeListId) || state.lists[0];
}

function saveAndRender() {
  state.activeListId = getActiveList().id;
  persistState();
  render();
}

function persistState({ publish = true } = {}) {
  state.updatedAt = Date.now();
  state.clientId = clientId;
  hasStoredState = true;
  storage.save(state);
  if (publish) publishState();
}

function itemMatchesFilter(item) {
  if (filter === 'open') return !item.done;
  if (filter === 'done') return item.done;
  return true;
}

function renderListTabs() {
  elements.listTabs.textContent = '';
  state.lists.forEach((list) => {
    const tab = elements.listTabTemplate.content.firstElementChild.cloneNode(true);
    const openCount = list.items.filter((item) => !item.done).length;
    tab.classList.toggle('active', list.id === state.activeListId);
    tab.querySelector('.list-tab__name').textContent = list.name;
    tab.querySelector('.list-tab__count').textContent = `${openCount} open`;
    tab.addEventListener('click', () => {
      state.activeListId = list.id;
      saveAndRender();
    });
    elements.listTabs.appendChild(tab);
  });
}

function renderItems(list) {
  elements.items.textContent = '';
  const visibleItems = list.items.filter(itemMatchesFilter);

  if (!visibleItems.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = filter === 'all' ? 'No items yet. Add the first one.' : `No ${filter} items.`;
    elements.items.appendChild(empty);
    return;
  }

  visibleItems.forEach((item) => {
    const card = elements.itemTemplate.content.firstElementChild.cloneNode(true);
    card.classList.toggle('done', item.done);
    card.querySelector('.item-check').checked = item.done;
    card.querySelector('.item-type').textContent = item.type;
    card.querySelector('.item-text').textContent = item.text;
    card.querySelector('.item-notes').value = item.notes;

    card.querySelector('.item-check').addEventListener('change', (event) => {
      item.done = event.target.checked;
      saveAndRender();
    });

    card.querySelector('.item-notes').addEventListener('input', (event) => {
      item.notes = event.target.value;
      persistState();
    });

    card.querySelector('.remove-item').addEventListener('click', () => {
      list.items = list.items.filter((candidate) => candidate.id !== item.id);
      saveAndRender();
    });

    card.querySelector('.move-up').addEventListener('click', () => moveItem(list, item.id, -1));
    card.querySelector('.move-down').addEventListener('click', () => moveItem(list, item.id, 1));

    elements.items.appendChild(card);
  });
}

function render() {
  const activeList = getActiveList();
  elements.storageStatus.textContent = getStatusText();
  elements.syncKey.value = syncKey;
  elements.activeListKind.textContent = activeList.kind;
  elements.activeListTitle.textContent = activeList.name;
  const openCount = activeList.items.filter((item) => !item.done).length;
  elements.activeListMeta.textContent = `${activeList.items.length} items, ${openCount} open`;
  elements.listNotes.value = activeList.notes;
  renderListTabs();
  renderItems(activeList);
}

function getStatusText() {
  if (syncAvailable) return 'Synced with Gun';
  return storageAvailable ? 'Saved locally' : 'Memory mode';
}

function addList(name) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return;
  const list = {
    id: createId('list'),
    name: cleanName,
    kind: 'List',
    notes: '',
    items: [],
  };
  state.lists.push(list);
  state.activeListId = list.id;
  saveAndRender();
}

function addItem(list, text, type) {
  const cleanText = String(text || '').trim();
  if (!cleanText) return;
  list.items.push({
    id: createId('item'),
    text: cleanText,
    type,
    done: false,
    notes: '',
  });
  saveAndRender();
}

function moveItem(list, itemId, direction) {
  const index = list.items.findIndex((item) => item.id === itemId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= list.items.length) return;
  const [item] = list.items.splice(index, 1);
  list.items.splice(nextIndex, 0, item);
  saveAndRender();
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tmsteph-lists-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importState(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      state = normalizeState(JSON.parse(String(reader.result || '{}')));
      saveAndRender();
    } catch (_error) {
      window.alert('That file did not look like a tmsteph lists export.');
    }
  });
  reader.readAsText(file);
}

elements.quickCreateForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addList(elements.newListName.value);
  elements.newListName.value = '';
});

elements.addItemForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addItem(getActiveList(), elements.itemText.value, elements.itemType.value);
  elements.itemText.value = '';
  elements.itemText.focus();
});

elements.renameListButton.addEventListener('click', () => {
  const activeList = getActiveList();
  const nextName = window.prompt('Rename list', activeList.name);
  if (!nextName || !nextName.trim()) return;
  activeList.name = nextName.trim();
  saveAndRender();
});

elements.deleteListButton.addEventListener('click', () => {
  if (state.lists.length === 1) {
    window.alert('Keep at least one list.');
    return;
  }
  const activeList = getActiveList();
  if (!window.confirm(`Delete "${activeList.name}"?`)) return;
  state.lists = state.lists.filter((list) => list.id !== activeList.id);
  state.activeListId = state.lists[0].id;
  saveAndRender();
});

elements.listNotes.addEventListener('input', (event) => {
  getActiveList().notes = event.target.value;
  persistState();
});

elements.filters.forEach((button) => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter || 'all';
    elements.filters.forEach((candidate) => candidate.classList.toggle('active', candidate === button));
    renderItems(getActiveList());
  });
});

elements.seedButton.addEventListener('click', () => {
  const starter = clone(starterState.lists[0]);
  starter.id = createId('list');
  state.lists.push(starter);
  state.activeListId = starter.id;
  saveAndRender();
});

elements.exportButton.addEventListener('click', exportState);
elements.importFile.addEventListener('change', (event) => {
  importState(event.target.files?.[0]);
  event.target.value = '';
});

elements.syncForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const nextSyncKey = cleanSyncKey(elements.syncKey.value);
  if (!nextSyncKey) return;
  syncKey = nextSyncKey;
  safeLocalSet(SYNC_KEY_STORAGE_KEY, syncKey);
  activeSyncKey = syncKey;
  lastSyncedAt = 0;
  setSyncDetail('Switching sync key...');
  connectGunSync({ publishLocal: false });
  render();
});

function connectGunSync({ publishLocal = hasStoredState, publishStarterIfEmpty = false } = {}) {
  if (typeof window.Gun !== 'function') {
    setSyncDetail('Gun is unavailable. Lists are still saved locally on this device.');
    return;
  }

  try {
    const connectionKey = syncKey;
    let receivedRemote = false;
    activeSyncKey = connectionKey;
    const gun = window.Gun({ peers: GUN_PEERS, axe: true });
    syncNode = gun.get('tmsteph').get('lists').get(connectionKey);
    gun.on('hi', () => {
      if (connectionKey !== activeSyncKey) return;
      syncAvailable = true;
      setSyncDetail(`Connected. Share sync key "${connectionKey}" with your other browsers or devices.`);
      render();
    });
    gun.on('bye', () => {
      if (connectionKey !== activeSyncKey) return;
      syncAvailable = false;
      setSyncDetail('Relay disconnected. Local saves continue and sync will retry.');
      render();
    });
    subscribeToGun(connectionKey, () => {
      receivedRemote = true;
    });
    if (publishLocal) {
      publishState();
    } else {
      setSyncDetail(`Waiting for Gun. Use key "${connectionKey}" on another browser or phone.`);
      if (publishStarterIfEmpty) {
        window.setTimeout(() => {
          if (connectionKey !== activeSyncKey || receivedRemote || hasStoredState) return;
          persistState();
        }, 1800);
      }
    }
  } catch (_error) {
    syncAvailable = false;
    setSyncDetail('Gun sync could not start. Local saves continue.');
  }
}

function subscribeToGun(connectionKey, onRemote = () => {}) {
  if (!syncNode || typeof syncNode.get !== 'function') return;
  syncNode.get('snapshot').on((record) => {
    if (connectionKey !== activeSyncKey) return;
    if (!record || !record.payload) return;
    onRemote();
    const remoteUpdatedAt = Number(record.updatedAt || 0);
    if (!remoteUpdatedAt || remoteUpdatedAt < lastSyncedAt) return;
    if (record.clientId === clientId && remoteUpdatedAt <= state.updatedAt) return;

    try {
      const remoteState = normalizeState(JSON.parse(record.payload));
      remoteState.updatedAt = remoteUpdatedAt;
      remoteState.clientId = record.clientId || '';
      applyingRemoteState = true;
      state = remoteState;
      lastSyncedAt = remoteUpdatedAt;
      hasStoredState = true;
      storage.save(state);
      setSyncDetail(`Synced from Gun at ${new Date(remoteUpdatedAt).toLocaleTimeString()}.`);
      render();
    } catch (_error) {
      setSyncDetail('Received a sync update that could not be read.');
    } finally {
      applyingRemoteState = false;
    }
  });
}

function publishState() {
  if (applyingRemoteState || !syncNode || typeof syncNode.get !== 'function') return;
  const updatedAt = Number(state.updatedAt || Date.now());
  const writeKey = activeSyncKey;
  state.updatedAt = updatedAt;
  state.clientId = clientId;
  lastSyncedAt = Math.max(lastSyncedAt, updatedAt);
  syncNode.get('snapshot').put({
    payload: JSON.stringify(state),
    updatedAt,
    clientId,
  }, (ack) => {
    if (writeKey !== activeSyncKey) return;
    if (ack?.err) {
      syncAvailable = false;
      setSyncDetail('Saved locally. Gun sync will retry when the relay is reachable.');
      return;
    }
    syncAvailable = true;
    setSyncDetail(`Synced. Use key "${writeKey}" on another browser or phone.`);
  });
}

function setSyncDetail(message) {
  elements.syncDetail.textContent = message;
  elements.storageStatus.textContent = getStatusText();
}

render();
connectGunSync({ publishStarterIfEmpty: !hasStoredState });

export { normalizeState, starterState };
