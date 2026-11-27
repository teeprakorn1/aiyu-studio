/**
 * @file core/registry.js — explicit runtime configuration and renderer registry.
 * Classic-script safe: exports through globalThis without creating lexical globals.
 */
(() => {
  const state = {
    characters: {}, people: {}, scenes: null, sourceChips: [], footnote: '', portrait: null, overlays: [],
  };
  const obj = v => { if (!v || typeof v !== 'object') throw new Error('registry value must be an object'); return v; };

  /**
   * Register mascot/presenter character configurations.
   * @param {Record<string, object>} map character id → colors/features config
   * @returns {void}
   */
  function defineCharacters(map) { Object.assign(state.characters, obj(map)); }

  /**
   * Register realistic `personTH()` character configurations.
   * @param {Record<string, object>} map character id → skin/hair/cloth config
   * @returns {void}
   */
  function definePeople(map) { Object.assign(state.people, obj(map)); }

  /**
   * Register scene boundaries in increasing line order. Each number is the first dialogue
   * line of the next scene; the final row must use `Infinity`.
   * @param {Array<[number, Function]>} rows `[nextSceneFirstLine, sceneFn]` pairs; line numbers are dialogue indexes
   * @returns {void}
   */
  function defineScenes(rows) {
    if (!Array.isArray(rows) || !rows.length || rows.some(r => !Array.isArray(r) || typeof r[1] !== 'function' || typeof r[0] !== 'number')) throw new Error('defineScenes expects [[line, sceneFn], ...]');
    rows.slice(0, -1).forEach(([till]) => { if (!Number.isInteger(till) || till < 1) throw new Error(`defineScenes boundary ${till} must be a whole dialogue line index >= 1 (the first line of the next scene)`); });
    for (let i = 1; i < rows.length; i++) if (!(rows[i][0] > rows[i - 1][0])) throw new Error('defineScenes rows must be sorted by increasing line index');
    if (rows[rows.length - 1][0] !== Infinity) throw new Error('defineScenes must end with Infinity');
    state.scenes = rows.slice();
  }

  /**
   * Register source-chip rows displayed under the footnote.
   * @param {Array<[number, number, string]>} rows `[firstLine, lastLine, label]` inclusive line indexes
   * @returns {void}
   */
  function defineSourceChips(rows) { state.sourceChips = Array.isArray(rows) ? rows.slice() : []; }

  /**
   * Set the persistent footnote/attribution text.
   * @param {string} text footnote text, or empty string to hide it
   * @returns {void}
   */
  function setFootnote(text) { state.footnote = String(text || ''); }

  /**
   * Register the features-layer portrait renderer used by cards.
   * @param {Function} fn renderer `(characterConfig)` drawn in the caller's current transformed coordinate space
   * @returns {void}
   */
  function registerPortraitRenderer(fn) {
    if (typeof fn !== 'function') throw new Error('portrait renderer must be a function');
    state.portrait = fn;
  }

  /**
   * Resolve a registered mascot/presenter character.
   * @param {string} id character id registered with `defineCharacters()`
   * @returns {object} character configuration
   */
  function characterOf(id) {
    const c = state.characters[id];
    if (!c) throw new Error(`unknown character '${id}' — register it with defineCharacters()`);
    return c;
  }

  /**
   * Resolve a registered `personTH()` character.
   * @param {string} id character id registered with `definePeople()`
   * @returns {object} realistic-person configuration
   */
  function personConfigOf(id) {
    const c = state.people[id];
    if (!c) throw new Error(`unknown personTH character '${id}' — register it with definePeople()`);
    return c;
  }

  /**
   * Read the shared runtime configuration state. Intended for core/features integration, not story authoring.
   * @returns {{characters:object, people:object, scenes:Array|null, sourceChips:Array, footnote:string, portrait:Function|null}}
   */
  function runtimeConfig() { return state; }

  /**
   * Register a draw stage that runs after the scene and source chips, before the footnote.
   * @param {number} order - ascending stage order; subtitles register at 20
   * @param {Function} fn - overlay `(shot)` drawing into the current canvas state
   * @returns {void}
   */
  function registerOverlay(order, fn) {
    if (typeof fn !== 'function') throw new Error('overlay must be a function');
    state.overlays.push({ order, fn });
    state.overlays.sort((a, b) => a.order - b.order);
  }

  /**
   * Draw the registered portrait for a character, failing loudly when no renderer is loaded.
   * @param {object} c - character configuration from defineCharacters()
   * @returns {void}
   */
  function renderPortrait(c) {
    if (!state.portrait) throw new Error('no portrait renderer registered — load features/character.js before features/cards.js');
    state.portrait(c);
  }

  Object.assign(globalThis, {
    defineCharacters, definePeople, defineScenes, defineSourceChips, setFootnote,
    registerPortraitRenderer, characterOf, personConfigOf, runtimeConfig, registerOverlay, renderPortrait,
  });
})();
