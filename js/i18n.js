// Generic multi-language runtime — shared across Carbon sites (v2).
// Depends on window.__I18N__ (emitted per-site) and reads attributes off its
// own <script> tag:
//   data-locale     current page's baked locale (page mode only)
//   data-prefix     path prefix for locale-specific internal links (page mode)
//   data-i18n-mode  "page" (default) | "overlay"
//
// Two modes, same runtime:
//  - "page": the page itself was generated per-locale at build time (a real
//    URL per language, e.g. /en/, with baked hreflang/canonical). Used for
//    pages fully-translated and short enough to duplicate safely (no
//    embedded per-page business logic worth multiplying by locale count).
//    Switching language navigates to that locale's URL.
//  - "overlay": the page has ONE url/locale baked in (usually the site's
//    default locale) and stays that way for SEO — no thin duplicate pages,
//    no hreflang claimed for content that isn't actually translated.
//    Instead this runtime swaps text in place for any element carrying
//    data-i18n (textContent) or data-i18n-attr (one or more "attr:key"
//    pairs, separated by "|", e.g. data-i18n-attr="placeholder:search_ph").
//    Switching language re-applies the overlay in place, no navigation.
//    Elements with no translation available for the resolved locale simply
//    keep whatever the HTML already has baked in (the site's own default
//    locale) — this is the fallback chain's last resort, so a visitor never
//    sees a blank string, "undefined", or a raw key name.
//
// Fallback chain for both modes, per string key:
//   current locale -> 'en' -> site default locale -> (leave DOM untouched)
(function () {
  'use strict';
  var DATA = window.__I18N__;
  if (!DATA) return; // i18n-data.js not loaded — fail silent, page still works.

  var scriptEl = document.currentScript;
  var MODE = scriptEl.getAttribute('data-i18n-mode') || 'page';
  var PAGE_LOCALE = scriptEl.getAttribute('data-locale') || DATA.defaultLocale;
  var STORE_KEY = (DATA.storageKey || 'i18n_lang');
  var DISMISS_KEY = STORE_KEY + '_suggest_dismissed';
  var COOKIE_DAYS = 365;

  function pathFor(code) {
    return code === DATA.defaultLocale ? '/' : '/' + code + '/';
  }

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, value) {
    var d = new Date();
    d.setTime(d.getTime() + COOKIE_DAYS * 864e5);
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }
  function safeGet(store, key) {
    try { return store.getItem(key); } catch (e) { return null; }
  }
  function safeSet(store, key, val) {
    try { store.setItem(key, val); } catch (e) {}
  }

  function getStoredLocale() {
    return safeGet(window.localStorage, STORE_KEY) || getCookie(STORE_KEY);
  }
  function storeLocale(code) {
    safeSet(window.localStorage, STORE_KEY, code);
    setCookie(STORE_KEY, code);
  }

  // current locale for display purposes: baked page locale in "page" mode,
  // the visitor's stored/preferred locale (else site default) in "overlay" mode.
  function currentLocale() {
    if (MODE === 'page') return PAGE_LOCALE;
    var stored = getStoredLocale();
    if (stored && DATA.registry.some(function (l) { return l.code === stored; })) return stored;
    return DATA.defaultLocale;
  }

  function bestMatchFromBrowser() {
    var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    var codes = DATA.registry.map(function (l) { return l.code; });
    for (var i = 0; i < prefs.length; i++) {
      var p = (prefs[i] || '').toLowerCase();
      for (var j = 0; j < codes.length; j++) {
        if (codes[j].toLowerCase() === p) return codes[j];
      }
      var base = p.split('-')[0];
      if (base !== 'zh') {
        for (var k = 0; k < codes.length; k++) {
          if (codes[k].toLowerCase().split('-')[0] === base) return codes[k];
        }
      }
    }
    return null;
  }

  // Resolve one string key through the fallback chain. Returns null (never
  // '', 'undefined', or the raw key) when nothing is found anywhere, so
  // callers can choose to leave the DOM's existing (default-locale) text.
  function t(key, locale) {
    var loc = locale || currentLocale();
    var chain = [loc, 'en', DATA.defaultLocale];
    for (var i = 0; i < chain.length; i++) {
      var bucket = DATA.pageStrings && DATA.pageStrings[chain[i]];
      if (bucket && Object.prototype.hasOwnProperty.call(bucket, key) && bucket[key] !== '' && bucket[key] != null) {
        return bucket[key];
      }
    }
    return null;
  }

  function applyDomTranslations() {
    if (!DATA.pageStrings) return;
    var nodes = document.querySelectorAll('[data-i18n], [data-i18n-attr]');
    nodes.forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key) {
        var val = t(key);
        if (val != null) el.textContent = val;
      }
      var attrSpec = el.getAttribute('data-i18n-attr');
      if (attrSpec) {
        attrSpec.split('|').forEach(function (pair) {
          var parts = pair.split(':');
          if (parts.length !== 2) return;
          var attr = parts[0].trim();
          var k = parts[1].trim();
          var v = t(k);
          if (v != null) el.setAttribute(attr, v);
        });
      }
    });
    document.documentElement.setAttribute('lang', currentLocale());
    var meta = DATA.registry.find(function (l) { return l.code === currentLocale(); });
    document.documentElement.setAttribute('dir', (meta && meta.dir) || 'ltr');
  }

  function buildSwitcher() {
    var host = document.getElementById('i18nSwitcher');
    if (!host) return;
    var cur = currentLocale();
    var select = document.createElement('select');
    select.className = 'i18n-select';
    select.setAttribute('aria-label', t('lang_label', cur) || 'Language');
    DATA.registry.forEach(function (l) {
      var opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = l.name;
      if (l.code === cur) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', function () {
      var code = select.value;
      storeLocale(code);
      if (MODE === 'page') {
        window.location.href = pathFor(code);
      } else {
        applyDomTranslations();
        buildSwitcherLabelsOnly(); // refresh aria-label / option highlighting language
      }
    });
    host.innerHTML = '';
    host.appendChild(select);
  }
  function buildSwitcherLabelsOnly() {
    // no-op placeholder kept for symmetry / future per-locale option labels
  }

  function showSuggestBanner(suggested) {
    var banner = document.getElementById('i18nSuggestBanner');
    if (!banner) return;
    var localeMeta = DATA.registry.find(function (l) { return l.code === suggested; });
    if (!localeMeta) return;
    var textTpl = t('suggest_text', suggested) || 'This page is also available in {name}.';
    var text = textTpl.replace('{name}', localeMeta.name);
    banner.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = text;
    var accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'i18n-suggest-accept';
    accept.textContent = t('suggest_accept', suggested) || 'Switch';
    accept.addEventListener('click', function () {
      storeLocale(suggested);
      if (MODE === 'page') {
        window.location.href = pathFor(suggested);
      } else {
        banner.hidden = true;
        applyDomTranslations();
        buildSwitcher();
      }
    });
    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'i18n-suggest-dismiss';
    dismiss.textContent = t('suggest_dismiss', suggested) || 'No thanks';
    dismiss.addEventListener('click', function () {
      safeSet(window.localStorage, DISMISS_KEY, suggested);
      banner.hidden = true;
    });
    banner.appendChild(span);
    banner.appendChild(accept);
    banner.appendChild(dismiss);
    banner.hidden = false;
  }

  function init() {
    buildSwitcher();
    if (MODE === 'overlay') applyDomTranslations();

    var stored = getStoredLocale();
    var isRoot = window.location.pathname === '/' || window.location.pathname === '/index.html';

    if (MODE === 'page' && stored && stored !== PAGE_LOCALE && isRoot && PAGE_LOCALE === DATA.defaultLocale) {
      var valid = DATA.registry.some(function (l) { return l.code === stored; });
      if (valid) {
        window.location.replace(pathFor(stored));
        return;
      }
    }

    if (!stored) {
      var suggestion = bestMatchFromBrowser();
      var dismissedFor = safeGet(window.localStorage, DISMISS_KEY);
      var current = currentLocale();
      if (suggestion && suggestion !== current && suggestion !== dismissedFor) {
        showSuggestBanner(suggestion);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
