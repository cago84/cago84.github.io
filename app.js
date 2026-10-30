(() => {
  'use strict';

  // ---------- Constantes ----------
  const STORAGE_KEY = 'todos.v1';
  const THEME_KEY = 'theme';

  const CATEGORIES = {
    personal: { label: 'Personnel', icon: '👤' },
    work:     { label: 'Travail',   icon: '💼' },
    shopping: { label: 'Courses',   icon: '🛒' },
    health:   { label: 'Santé',     icon: '❤️' },
    other:    { label: 'Autre',     icon: '🏷️' }
  };
  const PRIORITY_COLORS = ['#34c759', '#007aff', '#ff3b30'];

  // ---------- État ----------
  let items = load();
  let filter = 'all';
  let search = '';
  let catFilter = 'all';
  let editingId = null;
  let editorPriority = 1;
  let deferredInstall = null;

  // ---------- Raccourcis DOM ----------
  const $ = (id) => document.getElementById(id);
  const listEl = $('list');
  const editor = $('editor');
  const menu = $('menu');

  // ---------- Stockage ----------
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (_) {
      toast("Impossible d'enregistrer (stockage plein ou bloqué).");
    }
  }

  function uid() {
    return (crypto.randomUUID && crypto.randomUUID()) ||
      String(Date.now()) + Math.random().toString(16).slice(2);
  }

  // ---------- Dates ----------
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function localInputValue(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatDue(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ---------- Rendu ----------
  function visibleItems() {
    const q = search.trim().toLowerCase();
    return items.filter((i) =>
      (filter === 'all' || (filter === 'done') === i.isDone) &&
      (catFilter === 'all' || i.category === catFilter) &&
      (!q || i.title.toLowerCase().includes(q))
    );
  }

  function render() {
    const shown = visibleItems();
    listEl.textContent = '';

    for (const item of shown) {
      listEl.appendChild(renderItem(item));
    }

    const done = items.filter((i) => i.isDone).length;
    $('summary').textContent = `${done} sur ${items.length} terminées`;
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    $('progressBar').style.width = pct + '%';
    document.querySelector('.progress').setAttribute('aria-valuenow', pct);

    const empty = $('empty');
    empty.hidden = shown.length > 0;
    if (!empty.hidden) {
      const none = items.length === 0;
      $('emptyTitle').textContent = none ? 'Aucune tâche' : 'Rien à afficher';
      $('emptyText').textContent = none ? 'Touchez + pour ajouter votre première tâche.' : '';
    }

    $('clearDone').hidden = done === 0;
  }

  function renderItem(item) {
    const li = document.createElement('li');
    li.className = 'item' + (item.isDone ? ' done' : '');
    li.style.setProperty('--prio', PRIORITY_COLORS[item.priority] || PRIORITY_COLORS[1]);

    const check = document.createElement('button');
    check.className = 'check';
    check.type = 'button';
    check.textContent = item.isDone ? '✓' : '';
    check.setAttribute('aria-label', item.isDone ? 'Marquer comme à faire' : 'Marquer comme terminée');
    check.addEventListener('click', () => toggle(item.id));

    const body = document.createElement('div');
    body.className = 'body';
    body.addEventListener('click', () => openEditor(item.id));

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = item.title;
    body.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const cat = CATEGORIES[item.category] || CATEGORIES.other;
    meta.appendChild(span(`${cat.icon} ${cat.label}`));
    if (item.dueDate) {
      const overdue = !item.isDone && item.dueDate < todayStr();
      meta.appendChild(span(`📅 ${formatDue(item.dueDate)}`, overdue ? 'overdue' : ''));
    }
    if (item.reminderDate && !item.isDone && !item.notified) {
      meta.appendChild(span('🔔', 'bell'));
    }
    body.appendChild(meta);

    const del = document.createElement('button');
    del.className = 'del';
    del.type = 'button';
    del.textContent = '🗑';
    del.setAttribute('aria-label', 'Supprimer');
    del.addEventListener('click', () => remove(item.id));

    li.append(check, body, del);
    return li;
  }

  function span(text, cls) {
    const s = document.createElement('span');
    s.textContent = text;
    if (cls) s.className = cls;
    return s;
  }

  // ---------- Actions ----------
  function toggle(id) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    item.isDone = !item.isDone;
    if (!item.isDone && item.reminderDate && new Date(item.reminderDate) > new Date()) {
      item.notified = false;
    }
    if (navigator.vibrate) navigator.vibrate(10);
    save();
    render();
  }

  function remove(id) {
    items = items.filter((i) => i.id !== id);
    save();
    render();
  }

  function clearDone() {
    items = items.filter((i) => !i.isDone);
    save();
    render();
    menu.close();
  }

  // ---------- Formulaire ----------
  function setPriority(p) {
    editorPriority = p;
    document.querySelectorAll('#fPriority button').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.p) === p);
    });
  }

  function syncToggles() {
    $('fDue').hidden = !$('fHasDue').checked;
    $('fReminder').hidden = !$('fHasReminder').checked;
    $('fDue').required = $('fHasDue').checked;
    $('fReminder').required = $('fHasReminder').checked;
  }

  function updateNotifHint() {
    const hint = $('notifHint');
    if (!$('fHasReminder').checked) { hint.hidden = true; return; }
    hint.hidden = false;
    if (!('Notification' in window)) {
      hint.textContent = "Les notifications ne sont pas disponibles ici. Le rappel s'affichera dans l'application.";
    } else if (Notification.permission === 'denied') {
      hint.textContent = "Notifications bloquées dans les réglages. Le rappel s'affichera dans l'application.";
    } else {
      hint.textContent = "Le rappel est envoyé quand l'application est ouverte ou récemment en arrière-plan.";
    }
  }

  function openEditor(id) {
    editingId = id || null;
    const item = id ? items.find((i) => i.id === id) : null;

    $('editorTitle').textContent = item ? 'Modifier' : 'Nouvelle tâche';
    $('fTitle').value = item ? item.title : '';
    $('fCategory').value = item ? item.category : 'personal';
    setPriority(item ? item.priority : 1);

    $('fHasDue').checked = !!(item && item.dueDate);
    $('fDue').value = (item && item.dueDate) || todayStr();

    $('fHasReminder').checked = !!(item && item.reminderDate);
    $('fReminder').value = (item && item.reminderDate) ||
      localInputValue(new Date(Date.now() + 3600 * 1000));

    syncToggles();
    updateNotifHint();
    editor.showModal();
    if (!item) $('fTitle').focus();
  }

  async function ensureNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (_) { /* ignoré */ }
    }
    updateNotifHint();
  }

  function submitEditor(e) {
    e.preventDefault();
    const title = $('fTitle').value.trim();
    if (!title) return;

    const data = {
      title,
      category: $('fCategory').value,
      priority: editorPriority,
      dueDate: $('fHasDue').checked ? $('fDue').value : null,
      reminderDate: $('fHasReminder').checked ? $('fReminder').value : null
    };

    if (editingId) {
      const item = items.find((i) => i.id === editingId);
      if (item) {
        const reminderChanged = item.reminderDate !== data.reminderDate;
        Object.assign(item, data);
        if (reminderChanged) item.notified = false;
      }
    } else {
      items.unshift({ id: uid(), isDone: false, createdAt: new Date().toISOString(), notified: false, ...data });
    }

    save();
    render();
    editor.close();
    checkReminders();
  }

  // ---------- Rappels ----------
  async function notify(item) {
    const cat = (CATEGORIES[item.category] || CATEGORIES.other).label;
    const title = `Rappel : ${cat}`;
    let shown = false;

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
        if (reg) {
          await reg.showNotification(title, { body: item.title, icon: 'icons/icon-192.png', tag: item.id });
        } else {
          new Notification(title, { body: item.title, icon: 'icons/icon-192.png', tag: item.id });
        }
        shown = true;
      } catch (_) { /* repli sur le toast */ }
    }
    if (!shown) toast(`🔔 ${item.title}`);
  }

  function checkReminders() {
    const now = Date.now();
    let changed = false;
    for (const item of items) {
      if (item.isDone || item.notified || !item.reminderDate) continue;
      if (new Date(item.reminderDate).getTime() <= now) {
        item.notified = true;
        changed = true;
        notify(item);
      }
    }
    if (changed) { save(); render(); }
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(message) {
    const t = $('toast');
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
  }

  // ---------- Export / Import ----------
  async function exportData() {
    const payload = {
      app: 'mes-taches',
      version: 1,
      exportedAt: new Date().toISOString(),
      items
    };
    const json = JSON.stringify(payload, null, 2);
    const name = `taches-${todayStr()}.json`;
    const file = new File([json], name, { type: 'application/json' });

    // Sur mobile : feuille de partage (Fichiers, AirDrop, Mail...) si disponible.
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Mes tâches' });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // annulé par l'utilisateur
      }
    }

    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Export terminé : ${items.length} tâche(s).`);
  }

  function sanitizeImported(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 200) : '';
    if (!title) return null;

    const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const isDateTime = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) &&
      !Number.isNaN(new Date(s).getTime());
    const priority = [0, 1, 2].includes(raw.priority) ? raw.priority : 1;

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      title,
      isDone: raw.isDone === true,
      priority,
      category: CATEGORIES[raw.category] ? raw.category : 'other',
      dueDate: isDate(raw.dueDate) ? raw.dueDate : null,
      reminderDate: isDateTime(raw.reminderDate) ? raw.reminderDate : null,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      notified: raw.notified === true
    };
  }

  async function importData(file) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('trop volumineux');
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data && data.items;
      if (!Array.isArray(list)) throw new Error('format');

      const known = new Set(items.map((i) => i.id));
      const added = [];
      let ignored = 0;
      for (const raw of list) {
        const item = sanitizeImported(raw);
        if (!item || known.has(item.id)) { ignored++; continue; }
        known.add(item.id);
        added.push(item);
      }

      items = items.concat(added);
      save();
      render();
      menu.close();
      checkReminders();
      toast(`Import terminé : ${added.length} ajoutée(s), ${ignored} ignorée(s).`);
    } catch (_) {
      toast("Import impossible : fichier invalide.");
    }
  }

  // ---------- Thème ----------
  function applyTheme(value) {
    document.documentElement.dataset.theme = value;
    const dark = value === 'dark' ||
      (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#000000' : '#34c759');
  }

  // ---------- Initialisation ----------
  function init() {
    // Catégories
    $('catFilter').add(new Option('Toutes les catégories', 'all'));
    for (const [key, c] of Object.entries(CATEGORIES)) {
      $('fCategory').add(new Option(`${c.icon} ${c.label}`, key));
      $('catFilter').add(new Option(`${c.icon} ${c.label}`, key));
    }

    // Thème
    const theme = localStorage.getItem(THEME_KEY) || 'system';
    $('theme').value = theme;
    applyTheme(theme);
    $('theme').addEventListener('change', (e) => {
      localStorage.setItem(THEME_KEY, e.target.value);
      applyTheme(e.target.value);
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      applyTheme(localStorage.getItem(THEME_KEY) || 'system');
    });

    // Filtres
    $('filters').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      filter = btn.dataset.filter;
      document.querySelectorAll('#filters button').forEach((b) => b.classList.toggle('active', b === btn));
      render();
    });
    $('search').addEventListener('input', (e) => { search = e.target.value; render(); });
    $('catFilter').addEventListener('change', (e) => { catFilter = e.target.value; render(); });

    // Formulaire
    $('addBtn').addEventListener('click', () => openEditor(null));
    $('editorForm').addEventListener('submit', submitEditor);
    $('cancelBtn').addEventListener('click', () => editor.close());
    $('fPriority').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-p]');
      if (btn) setPriority(Number(btn.dataset.p));
    });
    $('fHasDue').addEventListener('change', syncToggles);
    $('fHasReminder').addEventListener('change', () => {
      syncToggles();
      if ($('fHasReminder').checked) ensureNotificationPermission(); else updateNotifHint();
    });

    // Menu
    $('menuBtn').addEventListener('click', () => menu.showModal());
    $('closeMenu').addEventListener('click', () => menu.close());
    $('clearDone').addEventListener('click', clearDone);
    $('exportBtn').addEventListener('click', exportData);
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', (e) => {
      importData(e.target.files[0]);
      e.target.value = ''; // permet de réimporter le même fichier
    });

    // Fermeture des boîtes de dialogue en touchant l'arrière-plan
    for (const dlg of [editor, menu]) {
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    }

    // Installation
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstall = e;
      $('installBtn').hidden = false;
    });
    $('installBtn').addEventListener('click', async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      $('installBtn').hidden = true;
    });
    window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; });

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    $('iosHint').hidden = !(isIOS && !standalone);

    // Rappels
    setInterval(checkReminders, 30 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });

    // Synchronisation entre onglets
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) { items = load(); render(); }
    });

    // Service worker (nécessite HTTPS ou localhost)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* hors-ligne indisponible */ });
    }

    render();
    checkReminders();
  }

  init();
})();
