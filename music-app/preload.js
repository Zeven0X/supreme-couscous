'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

async function call(name, ...args) {
  const r = await ipcRenderer.invoke(name, ...args);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}
function on(channel, cb) {
  const fn = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
}

contextBridge.exposeInMainWorld('tf', {
  state: () => call('state'),
  pickFiles: () => call('pick-files'),
  pickFolder: () => call('pick-folder'),
  pickImage: () => call('pick-image'),
  imagePreview: (p) => call('image-preview', p),
  pickDir: (current) => call('pick-dir', current),
  importPaths: (paths) => call('import', paths),
  updateTrack: (id, patch) => call('update-track', id, patch),
  removeTracks: (ids) => call('remove-tracks', ids),
  setCover: (id, imagePath) => call('set-cover', id, imagePath),
  peaks: (id) => call('peaks', id),
  exportTrack: (id, opts) => call('export-track', id, opts),
  exportMany: (ids, opts) => call('export-many', ids, opts),
  convertFiles: (paths, outDir) => call('convert-files', paths, outDir),
  settings: (patch) => call('settings', patch),
  mapsList: () => call('maps-list'),
  mapGet: (id) => call('map-get', id),
  mapCreate: (name) => call('map-create', name),
  mapDelete: (id) => call('map-delete', id),
  mapSave: (m) => call('map-save', m),
  mapBgAdd: (mapId, imagePath) => call('map-bg-add', mapId, imagePath),
  mapAssetUrl: () => call('map-asset-url'),
  showItem: (p) => call('show-item', p),
  openPath: (p) => call('open-path', p),
  ffmpegInfo: () => call('ffmpeg-info'),
  pathForFile: (file) => webUtils.getPathForFile(file),
  onLog: (cb) => on('log', cb),
  onImportProgress: (cb) => on('import-progress', cb),
  onExportProgress: (cb) => on('export-progress', cb),
});
