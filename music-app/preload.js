'use strict';
const { contextBridge, ipcRenderer, webUtils, webFrame } = require('electron');

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
  studioRender: (id, opts) => call('studio-render', id, opts),
  studioCancel: (group) => call('studio-cancel', group),
  studioSize: () => call('studio-size'),
  studioClear: () => call('studio-clear'),
  exportTrack: (id, opts) => call('export-track', id, opts),
  playlistCreate: (name, trackIds) => call('playlist-create', name, trackIds),
  playlistUpdate: (id, patch) => call('playlist-update', id, patch),
  playlistDelete: (id) => call('playlist-delete', id),
  playlistCover: (id, imagePath) => call('playlist-cover', id, imagePath),
  fileExists: (dir, name, ext) => call('file-exists', dir, name, ext),
  exportMany: (ids, opts) => call('export-many', ids, opts),
  convertFiles: (paths, outDir) => call('convert-files', paths, outDir),
  settings: (patch) => call('settings', patch),
  mapsList: () => call('maps-list'),
  mapGet: (id) => call('map-get', id),
  mapCreate: (name) => call('map-create', name),
  mapDelete: (id) => call('map-delete', id),
  mapExport: (id) => call('map-export', id),
  mapTrash: () => call('map-trash'),
  mapRestore: (file) => call('map-restore', file),
  mapPurge: (file) => call('map-purge', file),
  findMissing: () => call('find-missing'),
  about: () => call('about'),
  openOldVersions: () => call('open-old-versions'),
  setZoomFactor: (f) => webFrame.setZoomFactor(f),
  mapImport: (file) => call('map-import', file),
  pickMapFile: () => call('pick-mapfile'),
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
