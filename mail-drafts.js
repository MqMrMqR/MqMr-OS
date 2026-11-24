const stores = ['drafts', 'files'];

export function openDrafts(factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    const request = factory.open('mqr-inbox-drafts', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const drafts = db.createObjectStore('drafts', { keyPath: ['account', 'id'] });
      drafts.createIndex('account', 'account');
      db.createObjectStore('files', { keyPath: ['account', 'id'] });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(draftStore(request.result));
  });
}

function draftStore(db) {
  function read(store, lookup) {
    return new Promise((resolve, reject) => {
      const request = lookup(db.transaction(store).objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function change(draft, remove, files) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite');
      const drafts = tx.objectStore('drafts');
      const key = [draft.account, draft.id];
      const request = drafts.get(key);
      let result;
      tx.onabort = () => reject(tx.error || Error('Draft storage is unavailable.'));
      tx.oncomplete = () => resolve(result);
      request.onsuccess = () => {
        const existing = request.result;
        if (remove && !existing) { result = true; return; }
        if ((existing?.revision || 0) !== draft.revision) return;
        const attachments = tx.objectStore('files');
        if (remove) {
          drafts.delete(key);
          attachments.delete(key);
          result = true;
        } else {
          result = { ...draft, revision: draft.revision + 1 };
          drafts.put(result);
          if (files) attachments.put({ account: draft.account, id: draft.id, files });
        }
      };
    });
  }

  return {
    list: account => read('drafts', store => store.index('account').getAll(account)),
    files: async ({ account, id }) => (await read('files', store => store.get([account, id])))?.files || [],
    save: (draft, files) => change(draft, false, files),
    remove: draft => change(draft, true)
  };
}
