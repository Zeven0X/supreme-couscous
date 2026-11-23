'use strict';
// Reads an artist and a title out of a song's original file name, e.g.
// "Nova Lane - Midnight Drive (Official Audio)" -> { artist: 'Nova Lane', title: 'Midnight Drive' }.
// Works in the app (window.TFSaveName) and in Node tests.
(function (root) {
  // Extras that are not part of the song name: "(Official Video)", "[Lyrics]", "【MV】", "(HD)" ...
  const JUNK = /\b(official|video|audio|lyrics?|lyric video|visuali[sz]er|music video|mv|hd|hq|4k|1080p|720p|full song|remaster(ed)?( \d{4})?|explicit|clean|out now|free download|topic)\b/i;
  const BRACKETS = /\s*(\([^()]*\)|\[[^\]]*\]|【[^】]*】|\{[^}]*\})/g;

  function clean(s) {
    return String(s || '')
      .replace(/_/g, ' ')
      .replace(BRACKETS, (m) => (JUNK.test(m) ? '' : m)) // keep "(feat. Someone)" or "(Remix)", drop "(Official Video)"
      .replace(/\s+[|•]\s+.*$/, '') // "Song | Some Channel" -> "Song"
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[-–—.\s]+|[-–—.\s]+$/g, '');
  }

  function parseName(name) {
    let s = clean(name).replace(/^\d{1,3}\s*[.\-–—)]\s+/, ''); // "01 - " / "01. " track numbers
    const m = s.match(/^(.+?)\s+[-–—~]\s+(.+)$/) || s.match(/^([^-]+?)-([^-]+)$/); // "Artist - Title" (or "Artist-Title")
    if (!m) return { artist: '', title: s };
    return { artist: m[1].trim(), title: clean(m[2]) };
  }

  const api = { parseName, clean };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TFSaveName = api;
})(typeof window !== 'undefined' ? window : globalThis);
