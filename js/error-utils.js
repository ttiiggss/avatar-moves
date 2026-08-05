// Shared error reporting helpers for the Avatar Legends pages.
// Failures are logged and surfaced in the UI instead of dying silently.
(function (global) {
  'use strict';

  var BANNER_ID = 'avatarErrorBanner';

  function banner() {
    var el = document.getElementById(BANNER_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute('role', 'alert');
    el.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:99999',
      'padding:0.75rem 1rem', 'background:#5a1111', 'color:#ffe9e9',
      'font:600 0.85rem/1.4 system-ui,sans-serif', 'display:none',
      'box-shadow:0 -4px 16px rgba(0,0,0,0.5)'
    ].join(';');
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function show(message) {
    var el = banner();
    el.textContent = message;
    el.style.display = 'block';
  }

  function describe(err) {
    if (!err) return 'unknown error';
    if (err instanceof Error) return err.message;
    return String(err);
  }

  // Logs and displays an error. Returns the error so callers can rethrow.
  function report(context, err) {
    console.error('[avatar-moves] ' + context + ':', err);
    show('Something went wrong (' + context + '): ' + describe(err) +
      '. Reload the page; details are in the browser console.');
    return err;
  }

  function warn(context, message) {
    console.warn('[avatar-moves] ' + context + ': ' + message);
  }

  // Element lookup that fails loudly — for elements the page cannot work without.
  function requireEl(id) {
    var el = document.getElementById(id);
    if (!el) throw new Error('required element #' + id + ' is missing from the page');
    return el;
  }

  // Element lookup for optional elements: logs instead of returning silently.
  function optionalEl(id, context) {
    var el = document.getElementById(id);
    if (!el) warn(context || 'optionalEl', 'element #' + id + ' not found; skipping update');
    return el;
  }

  // Runs a step, reporting (not swallowing the diagnosis of) any failure.
  // Returns true on success so callers can decide whether to continue.
  function runStep(context, fn) {
    try {
      fn();
      return true;
    } catch (err) {
      report(context, err);
      return false;
    }
  }

  // Wraps an event handler so errors surface instead of vanishing into the
  // event loop, while still rethrowing for the global handler / devtools.
  function wrap(context, fn) {
    return function () {
      try {
        return fn.apply(this, arguments);
      } catch (err) {
        report(context, err);
        throw err;
      }
    };
  }

  function handleImageError(img) {
    warn('image', 'failed to load "' + (img && img.getAttribute('src')) + '"; using icon fallback');
    if (img) {
      img.style.display = 'none';
      img.dataset.loadFailed = 'true';
    }
  }

  function install() {
    global.addEventListener('error', function (event) {
      report('uncaught error', event.error || event.message);
    });
    global.addEventListener('unhandledrejection', function (event) {
      report('unhandled promise rejection', event.reason);
    });
  }

  global.AvatarErrors = {
    install: install,
    report: report,
    warn: warn,
    requireEl: requireEl,
    optionalEl: optionalEl,
    runStep: runStep,
    wrap: wrap,
    handleImageError: handleImageError
  };

  install();
})(window);
