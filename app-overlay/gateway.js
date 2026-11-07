#!/usr/bin/env node
/**
 * fnOS 统一网关适配层
 * ------------------------------------------------------------------
 * 背景：飞牛桌面网页端走 HTTPS，若桌面入口按 http://NAS:端口 内嵌，
 *       浏览器会以「混合内容」为由直接拦截，表现为打开后页面全白。
 * 做法：让应用同时监听 $TRIM_APPDEST/app.sock（Unix Socket），
 *       网关会把 /app/<appname>/... 原样转发到这个 socket（不剥前缀）。
 *       本进程负责：剥前缀 → 转发给本地 TCP 服务 → 回写时把
 *       前端里的绝对路径补上前缀，使其在网关子路径下也能加载。
 * 说明：不改动 lxserver 上游代码；直连 http://NAS:端口 不受影响。
 */
'use strict'

const http = require('http')
const net = require('net')
const fs = require('fs')
const path = require('path')

const SOCK = process.env.GATEWAY_SOCK || path.join(__dirname, 'app.sock')
const PREFIX = (process.env.GATEWAY_PREFIX || '/app/lxserver').replace(/\/+$/, '')
const UP_HOST = process.env.UPSTREAM_HOST || '127.0.0.1'
const UP_PORT = Number(process.env.PORT || 9527)

// 前端里以 / 开头的绝对路径，顶层段落在这些值内才补前缀，避免误伤普通文本
const SEGMENTS = [
  'api', 'music', 'js', 'library', 'dislike', 'filemanager',
  'sw\\.js', 'favicon\\.ico', 'manifest\\.json',
]
// '"/api/  '"/music/  `/api/  三种引号都要覆盖
const STRING_RE = new RegExp('([\'"`])/(' + SEGMENTS.join('|') + ')', 'g')
// HTML 属性：href="/..." src="/..." action="/..."
const ATTR_RE = /(\b(?:href|src|action)\s*=\s*["'])\/(?!app\/)/g

const isRewritable = (ct) =>
  /text\/html|javascript|text\/css|application\/json|text\/plain/i.test(ct || '')

function rewriteBody(buf) {
  let s = buf.toString('utf8')
  s = s.replace(ATTR_RE, '$1' + PREFIX + '/')
  s = s.replace(STRING_RE, (_m, q, seg) => q + PREFIX + '/' + seg)
  return Buffer.from(s, 'utf8')
}

function stripPrefix(url) {
  const u = url || '/'
  if (u === PREFIX) return '/'
  if (u.startsWith(PREFIX + '/')) return u.slice(PREFIX.length)
  return u
}

const server = http.createServer((req, res) => {
  const target = stripPrefix(req.url)
  const headers = Object.assign({}, req.headers)
  headers['accept-encoding'] = 'identity' // 拿到明文才能改写
  delete headers.host

  const upReq = http.request(
    { host: UP_HOST, port: UP_PORT, method: req.method, path: target, headers },
    (upRes) => {
      const status = upRes.statusCode || 200
      const h = Object.assign({}, upRes.headers)

      // 重定向也要补前缀：/admin -> /app/lxserver/admin/，
      // 否则 301 会把浏览器带到飞牛主站的裸路径上（后台管理进不去的根因之一）。
      if (h.location && h.location.startsWith('/') && !h.location.startsWith(PREFIX + '/')) {
        h.location = PREFIX + h.location
      }

      if (!isRewritable(h['content-type'])) {
        res.writeHead(status, h)
        upRes.pipe(res)
        return
      }

      const chunks = []
      upRes.on('data', (c) => chunks.push(c))
      upRes.on('end', () => {
        const body = rewriteBody(Buffer.concat(chunks))
        delete h['content-length']
        delete h['content-encoding']
        delete h['transfer-encoding'] // 改写后按定长返回，二者不可并存
        delete h.etag
        delete h['last-modified']
        if (h.location && h.location.startsWith('/') && !h.location.startsWith(PREFIX + '/')) {
          h.location = PREFIX + h.location
        }
        h['content-length'] = Buffer.byteLength(body)
        res.writeHead(status, h)
        res.end(body)
      })
    }
  )

  upReq.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' })
      res.end('<!doctype html><meta charset="utf-8"><p style="font:16px sans-serif;padding:24px">'
        + '洛雪音乐服务正在启动，请稍候刷新。</p>')
    } else {
      res.destroy()
    }
  })
  req.pipe(upReq)
})

// WebSocket 等升级请求：原样转发（仅剥前缀）
server.on('upgrade', (req, socket, head) => {
  const target = stripPrefix(req.url)
  const lines = [`${req.method} ${target} HTTP/1.1`]
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`)
  }
  const raw = Buffer.from(lines.join('\r\n') + '\r\n\r\n', 'latin1')

  const up = net.connect(UP_PORT, UP_HOST, () => {
    up.write(raw)
    if (head && head.length) up.write(head)
    up.pipe(socket)
    socket.pipe(up)
  })
  const bye = () => { try { up.destroy() } catch (_) {} try { socket.destroy() } catch (_) {} }
  up.on('error', bye)
  socket.on('error', bye)
})

function listen() {
  try {
    if (fs.existsSync(SOCK)) fs.unlinkSync(SOCK)
  } catch (_) {}
  server.listen(SOCK, () => {
    try { fs.chmodSync(SOCK, 0o777) } catch (_) {}
    console.log(`[gateway] unix socket ${SOCK} -> ${UP_HOST}:${UP_PORT}, prefix=${PREFIX}`)
  })
}

server.on('error', (e) => {
  // 端口/路径被占用时重试一次
  if (e && e.code === 'EADDRINUSE') {
    try { fs.unlinkSync(SOCK) } catch (_) {}
    setTimeout(listen, 800)
    return
  }
  console.error('[gateway] error:', e && e.message)
  process.exit(1)
})

listen()

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => {
      try { fs.unlinkSync(SOCK) } catch (_) {}
      process.exit(0)
    })
    setTimeout(() => {
      try { fs.unlinkSync(SOCK) } catch (_) {}
      process.exit(0)
    }, 2000).unref()
  })
}
