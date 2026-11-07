#!/usr/bin/env node
/**
 * 移动端 UI 冒烟脚本（390×844，模拟手机）
 *
 *   node tools/ui-smoke.mjs http://127.0.0.1:9527/ [输出目录]
 *
 * 依赖：npm i -D puppeteer-core（或全局安装），并准备一个 Chromium。
 *   CHROME=/usr/bin/chromium node tools/ui-smoke.mjs ...
 *
 * 产出：首页 / 搜索结果 / 设置 / 播放页 截图，打印 JS 错误与关键元素可见性。
 */
import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer-core'

const URL_ = process.argv[2] || 'http://127.0.0.1:9527/'
const OUT = process.argv[3] || 'shots'
const CHROME = process.env.CHROME || '/usr/bin/chromium'
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setCacheEnabled(false)
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)) })

await page.goto(URL_, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(2500)
await page.screenshot({ path: path.join(OUT, '1-home.png') })

// 单用户模式下这些区块应当隐藏
const hidden = await page.evaluate(() => {
  const pick = (id) => {
    const el = document.getElementById(id)
    if (!el) return 'missing'
    return getComputedStyle(el).display === 'none' ? 'hidden' : 'visible'
  }
  return {
    syncBlock: pick('sync-settings-block'),
    headerUser: pick('header-user-info'),
    tokenSection: pick('token-management-section'),
    tabbar: pick('m-tabbar'),
  }
})

// 搜索一首歌，验证列表行能显示歌手
let listRow = null
try {
  await page.evaluate(() => document.getElementById('tab-search')?.click())
  await sleep(600)
  await page.type('#search-input', '周杰伦', { delay: 40 })
  await page.keyboard.press('Enter')
  await sleep(4000)
  await page.screenshot({ path: path.join(OUT, '2-search.png') })
  listRow = await page.evaluate(() => {
    const row = document.querySelector('#search-results .song-row, #song-list .song-row')
    if (!row) return null
    const sub = row.querySelector('.song-row-sub, .song-row-singer')
    return { preview: row.innerText.replace(/\s+/g, ' ').slice(0, 80), sub: sub?.innerText ?? null }
  })
} catch (e) {
  errors.push('搜索流程: ' + String(e).slice(0, 120))
}

console.log(JSON.stringify({ url: URL_, hidden, listRow, errors: errors.slice(0, 8) }, null, 2))
await browser.close()
