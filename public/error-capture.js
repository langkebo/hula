// Global error capture - report via Tauri IPC
var _errorReporting = false;
var _report = function (tag, msg) {
  if (window.__TAURI__ && !_errorReporting) {
    _errorReporting = true;
    try {
      var p = window.__TAURI__.core.invoke('set_complete', { task: tag + ': ' + String(msg).slice(0, 200) });
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {} finally {
      _errorReporting = false;
    }
  }
};
window.addEventListener(
  'error',
  function (e) {
    if (e.target && e.target.tagName === 'SCRIPT') {
      _report('MOD-LOAD-ERR', (e.target.src || 'inline') + ' | ' + (e.message || ''));
    } else if (e.message && e.message.indexOf('Importing a module script failed') !== -1) {
      _report('MOD-IMPORT-FAIL', 'file=' + (e.filename || '?') + ' msg=' + (e.message || ''));
    } else {
      _report('JS-RUNTIME-ERROR', e.message + ' ' + e.filename + ':' + e.lineno + ':' + e.colno);
    }
  },
  true
);
window.addEventListener('unhandledrejection', function (e) {
  var reason = e.reason;
  var detail = '';
  if (reason && typeof reason === 'object') {
    detail = 'msg=' + (reason.message || '') + ' stack=' + String(reason.stack || '').slice(0, 200);
  } else {
    detail = String(reason);
  }
  _report('UNHANDLED-REJ', detail.slice(0, 250));
});
