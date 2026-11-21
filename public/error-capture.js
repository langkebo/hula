// Global error capture - report via Tauri IPC
var _errorReporting = false;
var _report = function (tag, msg) {
  if (window.__TAURI_INTERNALS__ && !_errorReporting) {
    _errorReporting = true;
    try {
      var p = window.__TAURI_INTERNALS__.invoke('set_complete', { task: tag + ': ' + String(msg).slice(0, 200) });
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

// Android 旧版 WebView 兜底（ES5，必须先于模块脚本执行）。
// 产物按 chrome90 构建，minSdkVersion 26 的设备可能停留在 Chrome 58-61，
// 会在模块脚本解析阶段直接白屏，此时 Vue/i18n 都还没加载，只能用静态文案提示。
var _MIN_ANDROID_WEBVIEW_MAJOR = 90;
var _readAndroidWebViewMajor = function () {
  var ua = navigator.userAgent || '';
  if (ua.indexOf('Android') === -1) return null;
  var match = /Chrome\/(\d+)/.exec(ua);
  if (!match) return null;
  var major = parseInt(match[1], 10);
  return isNaN(major) ? null : major;
};
var _showUnsupportedWebViewNotice = function (major) {
  _report('UNSUPPORTED-WEBVIEW', 'android chrome/' + major + ' < ' + _MIN_ANDROID_WEBVIEW_MAJOR);
  var render = function () {
    if (document.getElementById('unsupported-webview-notice')) return;
    var overlay = document.createElement('div');
    overlay.id = 'unsupported-webview-notice';
    overlay.setAttribute('role', 'alert');
    overlay.style.cssText =
      'position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;' +
      'display:flex;align-items:center;justify-content:center;padding:24px;' +
      'background:#ffffff;color:#1f2329;text-align:center;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    var box = document.createElement('div');
    box.style.cssText = 'max-width:420px;line-height:1.7;';
    var title = document.createElement('div');
    title.style.cssText = 'font-size:18px;font-weight:600;margin-bottom:12px;';
    title.textContent = '当前系统 WebView 版本过低';
    var desc = document.createElement('div');
    desc.style.cssText = 'font-size:14px;color:#646a73;white-space:pre-line;';
    desc.textContent =
      '需要 Chrome 90 或更高版本。请升级 Android System WebView 或 Chrome 后重新打开应用。\n' +
      'Chrome 90 or newer is required. Please update Android System WebView or Chrome, then reopen the app.';
    box.appendChild(title);
    box.appendChild(desc);
    overlay.appendChild(box);
    (document.body || document.documentElement).appendChild(overlay);
  };
  if (document.body) {
    render();
  } else {
    document.addEventListener('DOMContentLoaded', render);
  }
};
var _androidWebViewMajor = _readAndroidWebViewMajor();
if (_androidWebViewMajor !== null && _androidWebViewMajor < _MIN_ANDROID_WEBVIEW_MAJOR) {
  _showUnsupportedWebViewNotice(_androidWebViewMajor);
}
