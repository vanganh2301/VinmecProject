/* Backup: IndexedDB snapshots, JSON export/import with checksum, auto-save to a chosen folder */
'use strict';
(function (VM) {
  const DB = 'vmhub-backup', KEEP = 30, APP_ID = 'vinmec-pharmacy-hub';
  const LS_DL = 'vmhub.lastDownload';
  let db = null, lastSnapRev = null, lastSnapAt = null, folder = { handle: null, state: 'none', name: '', lastWrite: null };
  const listeners = [];
  const emit = () => listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });

  function open() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('IndexedDB không khả dụng'));
      const rq = indexedDB.open(DB, 2);
      rq.onupgradeneeded = () => {
        const d = rq.result;
        const sn = d.objectStoreNames.contains('snapshots') ? rq.transaction.objectStore('snapshots') : d.createObjectStore('snapshots', { keyPath: 'id' });
        // v2: chỉ mục theo thời gian để dọn bản cũ mà không phải đọc cả dữ liệu snapshot
        if (!sn.indexNames.contains('at')) sn.createIndex('at', 'at');
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      };
      // Tab khác còn mở bản cũ (IndexedDB v1) thì việc nâng cấp phải chờ tab đó đóng
      rq.onblocked = () => { if (VM.ui && VM.ui.toast) VM.ui.toast('Đóng các tab Pharmacy Hub khác để hoàn tất nâng cấp kho sao lưu', 'warn', 8000); };
      rq.onsuccess = () => { const d = rq.result; d.onversionchange = () => { d.close(); db = null; }; res(d); };
      rq.onerror = () => rej(rq.error);
    });
  }
  const tx = (store, mode, fn) => new Promise((res, rej) => {
    if (!db) return rej(new Error('Chưa mở được kho sao lưu'));
    const t = db.transaction(store, mode), s = t.objectStore(store);
    let out; const r = fn(s);
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
  });

  // FNV-1a 32-bit checksum – detects truncated / edited files
  function checksum(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); }
  const counts = s => ({ products: s.products.length, sales: s.sales.length, loans: s.loans.length, invoices: s.invoices.length, audit: s.audit.length });

  async function snapshot(reason = 'Tự động') {
    const s = VM.store.state;
    const data = JSON.stringify(s);
    const snap = { id: VM.uid('snap_'), at: VM.iso(), reason, rev: s.meta.rev, by: (VM.store.currentUser() || {}).name || '', counts: counts(s), size: data.length, data };
    try {
      await tx('snapshots', 'readwrite', st => st.put(snap));
      await prune();
    } catch (e) { console.warn('Snapshot failed', e); return null; }
    lastSnapRev = s.meta.rev; lastSnapAt = snap.at;
    writeFolder().catch(() => { });
    emit();
    return snap;
  }
  async function list() {
    const all = (await tx('snapshots', 'readonly', st => st.getAll())) || [];
    return all.sort((a, b) => b.at.localeCompare(a.at));
  }
  // Giữ KEEP bản mới nhất: đếm rồi xóa bản cũ nhất qua key cursor của chỉ mục `at` (không nạp dữ liệu snapshot)
  const prune = () => new Promise((res, rej) => {
    if (!db) return rej(new Error('Chưa mở được kho sao lưu'));
    const t = db.transaction('snapshots', 'readwrite'), st = t.objectStore('snapshots');
    const c = st.count();
    c.onsuccess = () => {
      let extra = c.result - KEEP;
      if (extra <= 0) return;
      const cur = st.index('at').openKeyCursor();
      cur.onsuccess = () => { const k = cur.result; if (!k || extra <= 0) return; st.delete(k.primaryKey); extra--; k.continue(); };
    };
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
  const getSnap = id => tx('snapshots', 'readonly', st => st.get(id));
  const removeSnap = async id => { await tx('snapshots', 'readwrite', st => st.delete(id)); emit(); };

  function payload() {
    const s = VM.store.state, data = JSON.stringify(s);
    return JSON.stringify({ app: APP_ID, schema: VM.store.SCHEMA, exportedAt: VM.iso(), exportedBy: (VM.store.currentUser() || {}).name || '', counts: counts(s), checksum: checksum(data), data: s }, null, 1);
  }
  function downloadFile() {
    VM.download(new Blob([payload()], { type: 'application/json' }), `vinmec-pharmacy-backup_${VM.fileStamp()}.json`);
    localStorage.setItem(LS_DL, VM.iso());
    VM.store.log('Tải bản sao lưu', 'Sao lưu', 'Tải file .json');
    VM.store.save('backup-download');
    emit();
  }
  async function parseFile(file) {
    let obj;
    try { obj = JSON.parse(await file.text()); } catch { throw new Error('File không phải định dạng sao lưu (.json) hợp lệ.'); }
    const data = obj && obj.app === APP_ID ? obj.data : (obj && obj.products && obj.sales ? obj : null);
    if (!data || !Array.isArray(data.products)) throw new Error('File không phải bản sao lưu của Vinmec Pharmacy Hub.');
    const okSum = obj.checksum ? checksum(JSON.stringify(data)) === obj.checksum : null;
    return { data, info: { exportedAt: obj.exportedAt || '', exportedBy: obj.exportedBy || '', counts: counts(migrateLike(data)), checksumOk: okSum } };
  }
  const migrateLike = d => ({ products: d.products || [], sales: d.sales || [], loans: d.loans || [], invoices: d.invoices || [], audit: d.audit || [] });

  async function restore(data, label) {
    await snapshot('Trước khi khôi phục');
    VM.store.replace(JSON.parse(JSON.stringify(data)), 'restore');
    VM.store.log('Khôi phục dữ liệu', 'Sao lưu', label || '');
    VM.store.save('restore');
    lastSnapRev = VM.store.state.meta.rev;
    emit();
  }

  // ---------- Folder auto-backup (Chrome / Edge) ----------
  const folderSupported = () => typeof window.showDirectoryPicker === 'function' && window.isSecureContext !== false;
  async function chooseFolder() {
    const handle = await window.showDirectoryPicker({ id: 'vmhub-backup', mode: 'readwrite' });
    await tx('kv', 'readwrite', st => st.put(handle, 'folder'));
    folder = { handle, state: 'granted', name: handle.name, lastWrite: null };
    await writeFolder(true);
    VM.store.log('Chọn thư mục sao lưu tự động', 'Sao lưu', handle.name);
    VM.store.save('folder');
    emit();
  }
  async function forgetFolder() { await tx('kv', 'readwrite', st => st.delete('folder')); folder = { handle: null, state: 'none', name: '', lastWrite: null }; emit(); }
  async function grantFolder() {
    if (!folder.handle) return;
    const p = await folder.handle.requestPermission({ mode: 'readwrite' });
    folder.state = p === 'granted' ? 'granted' : 'denied';
    if (folder.state === 'granted') await writeFolder(true);
    emit();
  }
  async function writeFolder(force) {
    if (!folder.handle) return;
    const p = await folder.handle.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted') { folder.state = 'prompt'; emit(); return; }
    folder.state = 'granted';
    const name = `vinmec-pharmacy-backup_${VM.ymd()}.json`;
    const fh = await folder.handle.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(payload()); await w.close();
    folder.lastWrite = VM.iso();
    localStorage.setItem('vmhub.folderWrite', folder.lastWrite);
    if (force) emit();
  }

  function status() {
    const lastDl = localStorage.getItem(LS_DL);
    const lastAny = [lastSnapAt, lastDl, folder.lastWrite].filter(Boolean).sort().pop() || null;
    const dlHours = lastDl ? VM.hoursSince(lastDl) : Infinity;
    const offsite = folder.state === 'granted' ? VM.hoursSince(folder.lastWrite || 0) : dlHours; // copy outside the browser
    const level = !lastSnapAt && !lastDl ? 'bad' : offsite > 24 ? 'warn' : 'ok';
    return { lastSnapAt, lastDownloadAt: lastDl, folder: { ...folder, handle: undefined, supported: folderSupported() }, level, lastAny, available: !!db };
  }

  async function init() {
    try {
      db = await open();
      const last = await new Promise((res, rej) => { // chỉ đọc bản mới nhất
        const t = db.transaction('snapshots', 'readonly'), c = t.objectStore('snapshots').index('at').openCursor(null, 'prev');
        let v = null; c.onsuccess = () => { v = c.result ? c.result.value : null; };
        t.oncomplete = () => res(v); t.onerror = () => rej(t.error);
      });
      if (last) { lastSnapAt = last.at; lastSnapRev = last.rev; }
      try {
        const h = await tx('kv', 'readonly', st => st.get('folder'));
        if (h) { folder.handle = h; folder.name = h.name; folder.lastWrite = localStorage.getItem('vmhub.folderWrite'); folder.state = (await h.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'granted' : 'prompt'; }
      } catch (_) { }
      if (!lastSnapAt || VM.hoursSince(lastSnapAt) > 1) await snapshot('Mở ứng dụng');
    } catch (e) { console.warn('Backup store unavailable', e); }
    setInterval(() => {
      const s = VM.store.state, mins = s.settings.snapshotMinutes || 15;
      if (db && s.meta.rev !== lastSnapRev && (!lastSnapAt || (Date.now() - new Date(lastSnapAt)) / 6e4 >= mins)) snapshot('Tự động');
      emit();
    }, 60e3);
    window.addEventListener('beforeunload', () => { if (db && VM.store.state.meta.rev !== lastSnapRev) snapshot('Đóng ứng dụng'); });
    emit();
  }

  VM.backup = { init, snapshot, list, getSnap, removeSnap, downloadFile, parseFile, restore, chooseFolder, forgetFolder, grantFolder, status, folderSupported, onChange: f => listeners.push(f), counts };
})(window.VM);
