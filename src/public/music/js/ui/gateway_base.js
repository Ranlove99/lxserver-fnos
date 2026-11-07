/**
 * 飞牛网关前缀适配
 *
 * 应用被飞牛挂在 /app/lxserver/ 下时，页面里的 /api/... 绝对路径会被浏览器
 * 解析到主站根目录（https://域名/api/...），请求打到飞牛主站而不是本应用，
 * 结果就是 404：页面能打开、设置能看见，但播放/音频加载失败。
 *
 * 这里在最早阶段补齐前缀，只作用于本应用自己的接口和静态资源，
 * 不影响第三方直链、也不影响 http://ip:端口 直连访问。
 */
(function () {
    'use strict';

    var matched = location.pathname.match(/^(\/app\/[^/]+)/);
    if (!matched) return;
    var prefix = matched[1];
    if (!prefix || prefix === '/app') return;

    // 本应用后端路由与根静态资源
    var OWN_PATHS = [
        '/api/music', '/api/user', '/api/users', '/api/custom-source',
        '/api/data', '/api/config', '/api/webdav', '/api/files',
        '/api/status', '/api/restart', '/api/backup', '/api/admin',
        '/api/utils', '/api/storage', '/api/logs', '/api/login',
        '/icon.svg', '/favicon.ico', '/manifest.json'
    ];

    // 网关会把脚本里的 "/api/..." 文本重写成 "/app/<app>/api/..."，
    // 比较前先剥掉前缀，保证两种形态都能识别。
    function normalize(url) {
        return url.indexOf(prefix + '/') === 0 ? url.slice(prefix.length) : url;
    }

    function needsPrefix(url) {
        var u = normalize(url);
        for (var i = 0; i < OWN_PATHS.length; i++) {
            var p = normalize(OWN_PATHS[i]);
            if (u === p || u.indexOf(p + '/') === 0 || u.indexOf(p + '?') === 0 || u.indexOf(p + '#') === 0) {
                return true;
            }
        }
        return false;
    }

    function rewrite(url) {
        if (typeof url !== 'string' || url.charAt(0) !== '/') return url;
        if (url.indexOf(prefix + '/') === 0) return url;
        return needsPrefix(url) ? prefix + url : url;
    }

    window.__lxGatewayPrefix = prefix;
    window.__lxGatewayUrl = rewrite;

    // fetch
    var origFetch = window.fetch;
    if (typeof origFetch === 'function') {
        window.fetch = function (input, init) {
            if (typeof input === 'string') return origFetch.call(this, rewrite(input), init);
            if (input && typeof input.url === 'string' && needsPrefix(input.url)) {
                try {
                    return origFetch.call(this, new Request(rewrite(input.url), input), init);
                } catch (e) { /* 忽略，按原样发起 */ }
            }
            return origFetch.call(this, input, init);
        };
    }

    // XMLHttpRequest
    var origOpen = XMLHttpRequest.prototype.open;
    if (typeof origOpen === 'function') {
        XMLHttpRequest.prototype.open = function (method, url) {
            if (typeof url === 'string') arguments[1] = rewrite(url);
            return origOpen.apply(this, arguments);
        };
    }

    // EventSource（播放进度 SSE）
    var OrigEventSource = window.EventSource;
    if (typeof OrigEventSource === 'function') {
        var GatewayEventSource = function (url, config) {
            return new OrigEventSource(rewrite(url), config);
        };
        GatewayEventSource.prototype = OrigEventSource.prototype;
        GatewayEventSource.CONNECTING = 0;
        GatewayEventSource.OPEN = 1;
        GatewayEventSource.CLOSED = 2;
        window.EventSource = GatewayEventSource;
    }

    // 音频地址：audio.src 直接赋绝对路径时同样需要补前缀
    var mediaDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    if (mediaDesc && mediaDesc.get && mediaDesc.set) {
        Object.defineProperty(HTMLMediaElement.prototype, 'src', {
            configurable: true,
            enumerable: mediaDesc.enumerable,
            get: mediaDesc.get,
            set: function (value) { mediaDesc.set.call(this, rewrite(value)); }
        });
    }
})();
