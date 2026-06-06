const STORAGE_KEY = 'tmsteph.lists.v1';
let storageAvailable = true;

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

let state = normalizeState(storage.load() || starterState);
let filter = 'all';

const elements = {
  storageStatus: document.getElementById('storageStatus'),
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(nextState) {
  const lists = Array.isArray(nextState?.lists) && nextState.lists.length
    ? nextState.lists
    : clone(starterState.lists);
  return {
    activeListId: nextState?.activeListId || lists[0].id,
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
  storage.save(state);
  render();
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
      storage.save(state);
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
  elements.storageStatus.textContent = storageAvailable ? 'Saved on this device' : 'Memory mode';
  elements.activeListKind.textContent = activeList.kind;
  elements.activeListTitle.textContent = activeList.name;
  const openCount = activeList.items.filter((item) => !item.done).length;
  elements.activeListMeta.textContent = `${activeList.items.length} items, ${openCount} open`;
  elements.listNotes.value = activeList.notes;
  renderListTabs();
  renderItems(activeList);
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
  storage.save(state);
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

render();

export { normalizeState, starterState };
