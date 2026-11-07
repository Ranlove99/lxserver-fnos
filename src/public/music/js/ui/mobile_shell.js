/* ==========================================================================
   LX Music Web · Mobile Shell Runtime
   1) 底部导航（搜索 / 歌单 / 排行榜 / 我的）
   2) 顶部「更多」底部弹层（收纳低频入口）
   3) 全屏播放页控制区（飞牛音乐风格：进度 + 主控 + 工具排）
   全部逻辑仅在 ≤767px 生效，桌面端不做任何改动。
   ========================================================================== */
(function () {
    'use strict'

    const $ = (id) => document.getElementById(id)
    const isMobile = () => window.innerWidth <= 767
    const audio = () => window.LXPlayback || document.getElementById('audio-player')

    /* ------------------------------------------------------------------ utils */
    const fmt = (sec) => {
        if (!Number.isFinite(sec) || sec < 0) sec = 0
        const m = Math.floor(sec / 60)
        const s = Math.floor(sec % 60)
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }

    /* --------------------------------------------------------- 1. 底部导航 */
    const TABS = [
        { key: 'search', icon: 'fa-magnifying-glass', label: '搜索' },
        { key: 'songlist', icon: 'fa-layer-group', label: '歌单' },
        { key: 'leaderboard', icon: 'fa-trophy', label: '排行榜' },
        { key: 'favorites', icon: 'fa-heart', label: '我的' },
    ]

    function buildTabbar() {
        if ($('m-tabbar')) return
        const nav = document.createElement('nav')
        nav.id = 'm-tabbar'
        nav.setAttribute('aria-label', '主导航')
        nav.innerHTML = TABS.map(t => `
            <button type="button" class="m-tab" data-tab="${t.key}" aria-label="${t.label}">
                <i class="fas ${t.icon}"></i>
                <span>${t.label}</span>
            </button>`).join('')
        nav.addEventListener('click', (e) => {
            const btn = e.target.closest('.m-tab')
            if (!btn) return
            const key = btn.dataset.tab
            if (key === 'favorites') {
                // 「我的」= 侧边抽屉，收纳收藏 / 本地音乐 / 设置 / 关于等二级入口
                setActiveTab('favorites')
                window.toggleSidebar?.()
                return
            }
            setActiveTab(key)
            switchTab(key)
        })
        document.body.appendChild(nav)
    }

    /* 抽屉内点击任意入口后自动收起抽屉，并同步底部高亮 */
    function bindDrawerLinks() {
        const sidebar = $('main-sidebar')
        if (!sidebar) return
        sidebar.addEventListener('click', (e) => {
            const link = e.target.closest('a[onclick], #tab-favorites, #tab-dislike, .playlist-sidebar-item')
            if (!link) return
            if (link.id === 'tab-favorites' || link.id === 'tab-dislike') return
            setTimeout(() => {
                if (!sidebar.classList.contains('-translate-x-full')) window.toggleSidebar?.()
            }, 120)
        })
    }

    function setActiveTab(key) {
        document.querySelectorAll('#m-tabbar .m-tab').forEach(b => {
            b.classList.toggle('is-active', b.dataset.tab === key)
        })
    }

    /* 跟随原生视图切换同步高亮 */
    function watchViewChange() {
        const views = ['search', 'songlist', 'leaderboard', 'favorites', 'settings', 'about']
        // 设置 / 关于这类二级页面在底部导航里归属「我的」
        const MAP = { settings: 'favorites', about: 'favorites' }
        const target = document.getElementById('main-views')
        if (!target) return
        new MutationObserver(() => {
            for (const v of views) {
                const el = $('view-' + v)
                if (el && !el.classList.contains('hidden')) {
                    setActiveTab(MAP[v] || v)
                    return
                }
            }
        }).observe(target, { subtree: true, attributes: true, attributeFilter: ['class'] })
    }

    /* --------------------------------------------------- 2. 顶部「更多」面板 */
    function buildMoreButton() {
        const header = document.querySelector('main > header')
        if (!header || $('m-more-btn')) return
        const btn = document.createElement('button')
        btn.id = 'm-more-btn'
        btn.type = 'button'
        btn.setAttribute('aria-label', '更多')
        btn.innerHTML = '<i class="fas fa-ellipsis-vertical"></i>'
        btn.addEventListener('click', () => openSheet())
        header.appendChild(btn)
    }

    const SHEET_ITEMS = [
        { icon: 'fa-sliders', label: '设置', run: () => switchTab('settings') },
        { icon: 'fa-folder-open', label: '本地音乐', run: () => switchTab('localmusic') },
        { icon: 'fa-moon', label: '睡眠定时器', run: () => $('sleep-timer-trigger')?.click() },
        { icon: 'fa-shield-halved', label: '管理后台', run: () => { if (typeof goToAdmin === 'function') goToAdmin() } },
        { icon: 'fa-circle-info', label: '关于', run: () => switchTab('about') },
        { icon: 'fa-arrow-right-from-bracket', label: '退出登录', danger: true, run: () => { $('logout-btn')?.click() } },
    ]

    // 播放页专用的「更多」项
    const PLAYER_ITEMS = [
        { icon: 'fa-gauge-high', label: '切换播放速度', run: cycleRate },
        { icon: 'fa-moon', label: '睡眠定时器', run: () => $('sleep-timer-trigger')?.click() },
        { icon: 'fa-images', label: '分享歌词卡片', run: () => window.lyricCard?.open() },
        { icon: 'fa-list-ul', label: '播放队列', run: () => window.toggleQueueDrawer?.() },
    ]

    const RATES = [1, 1.25, 1.5, 2, 0.75, 0.5]
    function cycleRate() {
        const btn = $('playback-rate-btn')
        const cur = parseFloat((btn?.textContent || '1.0').replace('x', '')) || 1
        const idx = RATES.indexOf(cur)
        const next = RATES[(idx + 1) % RATES.length]
        window.setPlaybackRate?.(next)
        window.showToast?.('info', `播放速度 ${next}x`, 1200)
    }

    function buildSheet() {
        if ($('m-sheet')) return
        const bd = document.createElement('div')
        bd.id = 'm-sheet-backdrop'
        bd.addEventListener('click', closeSheet)

        const sheet = document.createElement('div')
        sheet.id = 'm-sheet'
        sheet.innerHTML = `
            <div class="m-sheet-handle"></div>
            <div class="m-sheet-title" id="m-sheet-title">更多功能</div>
            <div id="m-sheet-body"></div>`
        sheet.addEventListener('click', (e) => {
            const b = e.target.closest('.m-sheet-item')
            if (!b) return
            closeSheet()
            const item = (sheet._items || [])[+b.dataset.i]
            setTimeout(() => item?.run(), 200)
        })
        document.body.append(bd, sheet)
    }

    function openSheet(items) {
        // 单用户模式免登录，退出登录没有意义，直接不展示
        const list = (items || SHEET_ITEMS).filter(it => !(it.label === '退出登录' && window.lx_config && window.lx_config.singleUser))
        const sheet = $('m-sheet')
        if (!sheet) return
        sheet._items = list
        $('m-sheet-title').textContent = items ? '播放选项' : '更多功能'
        $('m-sheet-body').innerHTML = list.map((it, i) => `
            <button type="button" class="m-sheet-item${it.danger ? ' is-danger' : ''}" data-i="${i}">
                <i class="fas ${it.icon}"></i><span>${it.label}</span>
            </button>`).join('')
        $('m-sheet-backdrop')?.classList.add('is-open')
        sheet.classList.add('is-open')
    }

    function closeSheet() {
        $('m-sheet-backdrop')?.classList.remove('is-open')
        $('m-sheet')?.classList.remove('is-open')
    }

    /* ------------------------------------------ 3. 全屏播放页控制区 */
    function buildDetailControls() {
        const view = $('view-player-detail')
        if (!view || $('m-detail-controls')) return

        const wrap = document.createElement('div')
        wrap.id = 'm-detail-controls'
        wrap.innerHTML = `
            <div class="m-dc-progress">
                <span id="m-dc-cur">00:00</span>
                <div class="m-dc-track" id="m-dc-track" role="slider"
                     aria-label="播放进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                    <div class="m-dc-fill" id="m-dc-fill"></div>
                    <div class="m-dc-knob" id="m-dc-knob"></div>
                </div>
                <span id="m-dc-dur">00:00</span>
            </div>
            <div class="m-dc-buttons">
                <button type="button" class="m-dc-side" data-act="mode" aria-label="播放模式">
                    <i class="fas fa-redo"></i>
                </button>
                <button type="button" data-act="prev" aria-label="上一首">
                    <i class="fas fa-backward-step"></i>
                </button>
                <button type="button" id="m-dc-play" aria-label="播放 / 暂停">
                    <i class="fas fa-play"></i>
                </button>
                <button type="button" data-act="next" aria-label="下一首">
                    <i class="fas fa-forward-step"></i>
                </button>
                <button type="button" class="m-dc-side" data-act="queue" aria-label="播放队列">
                    <i class="fas fa-list-ul"></i>
                </button>
            </div>
            <div class="m-dc-tools">
                <button type="button" data-act="like" aria-label="喜欢">
                    <i class="fas fa-heart"></i><span>喜欢</span>
                </button>
                <button type="button" data-act="download" aria-label="下载">
                    <i class="fas fa-circle-down"></i><span>下载</span>
                </button>
                <button type="button" data-act="comment" aria-label="评论">
                    <i class="fas fa-comment-dots"></i><span>评论</span>
                </button>
                <button type="button" data-act="effects" aria-label="音效">
                    <i class="fas fa-sliders"></i><span>音效</span>
                </button>
                <button type="button" data-act="more" aria-label="更多">
                    <i class="fas fa-ellipsis"></i><span>更多</span>
                </button>
            </div>`
        view.appendChild(wrap)

        /* 主控 */
        wrap.querySelector('#m-dc-play').addEventListener('click', () => window.togglePlay?.())
        wrap.querySelector('[data-act="prev"]').addEventListener('click', () => window.playPrev?.())
        wrap.querySelector('[data-act="next"]').addEventListener('click', () => window.playNext?.())
        wrap.querySelector('[data-act="queue"]').addEventListener('click', () => window.toggleQueueDrawer?.())
        wrap.querySelector('[data-act="mode"]').addEventListener('click', cyclePlayMode)

        /* 工具排：全部代理到原有实现，避免重复造逻辑 */
        wrap.querySelector('[data-act="like"]').addEventListener('click', () => {
            $('player-like-btn')?.click()
            setTimeout(syncLike, 300)
        })
        wrap.querySelector('[data-act="download"]').addEventListener('click', () => {
            const b = document.querySelector('[data-mobile-btn="download"]')
            if (b) b.click()
        })
        wrap.querySelector('[data-act="comment"]').addEventListener('click', () => window.toggleCommentModal?.())
        wrap.querySelector('[data-act="effects"]').addEventListener('click', () => window.soundEffects?.toggle())
        wrap.querySelector('[data-act="more"]').addEventListener('click', () => openSheet(PLAYER_ITEMS))

        bindSeek()
    }

    /* 播放模式循环切换 */
    const MODE_ORDER = ['list', 'single', 'random', 'order']
    const MODE_ICON = { list: 'fa-redo', single: 'fa-repeat', random: 'fa-shuffle', order: 'fa-arrow-right' }
    const MODE_TEXT = { list: '列表循环', single: '单曲循环', random: '随机播放', order: '顺序播放' }

    function currentMode() {
        const i = document.querySelector('#play-mode-btn i')
        const cls = i ? i.className : ''
        if (cls.includes('fa-random')) return 'random'
        if (cls.includes('fa-redo-alt') || cls.includes('fa-repeat')) return 'single'
        if (cls.includes('fa-play')) return 'order'
        return 'list'
    }

    function cyclePlayMode() {
        const next = MODE_ORDER[(MODE_ORDER.indexOf(currentMode()) + 1) % MODE_ORDER.length]
        window.setPlayMode?.(next)
        const btn = document.querySelector('#m-detail-controls [data-act="mode"] i')
        if (btn) btn.className = `fas ${MODE_ICON[next]}`
        window.showToast?.('info', MODE_TEXT[next], 1200)
    }

    /* 进度条拖动 */
    function bindSeek() {
        const track = $('m-dc-track')
        if (!track) return
        const a = audio()
        let dragging = false

        const pctFromEvent = (e) => {
            const r = track.getBoundingClientRect()
            const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left
            return Math.max(0, Math.min(1, x / r.width))
        }
        const paint = (pct) => {
            $('m-dc-fill').style.width = (pct * 100) + '%'
            $('m-dc-knob').style.left = (pct * 100) + '%'
        }
        const onMove = (e) => {
            if (!dragging) return
            e.preventDefault()
            const p = pctFromEvent(e)
            paint(p)
            $('m-dc-cur').textContent = fmt((a?.duration || 0) * p)
        }
        const onUp = (e) => {
            if (!dragging) return
            dragging = false
            track.classList.remove('is-dragging')
            const p = pctFromEvent(e.changedTouches ? e.changedTouches[0] : e)
            if (a && Number.isFinite(a.duration)) {
                a.currentTime = p * a.duration
                if (window.musicVisualizer) window.musicVisualizer.applySettings?.()
            }
        }

        track.addEventListener('pointerdown', (e) => {
            if (!a || !Number.isFinite(a.duration)) return
            dragging = true
            track.classList.add('is-dragging')
            track.setPointerCapture?.(e.pointerId)
            onMove(e)
        })
        track.addEventListener('pointermove', onMove)
        track.addEventListener('pointerup', onUp)
        track.addEventListener('pointercancel', onUp)
    }

    let rafPending = false
    function syncProgress() {
        if (rafPending || document.body.classList.contains('is-detail-open') === false) return
        rafPending = true
        requestAnimationFrame(() => {
            rafPending = false
            const a = audio()
            if (!a) return
            const dur = Number.isFinite(a.duration) ? a.duration : 0
            const pct = dur > 0 ? a.currentTime / dur : 0
            const fill = $('m-dc-fill'), knob = $('m-dc-knob')
            if (fill) fill.style.width = (pct * 100) + '%'
            if (knob) knob.style.left = (pct * 100) + '%'
            const cur = $('m-dc-cur')
            if (cur) cur.textContent = fmt(a.currentTime)
            const d = $('m-dc-dur')
            if (d) d.textContent = fmt(dur)
            const t = $('m-dc-track')
            if (t) t.setAttribute('aria-valuenow', Math.round(pct * 100))
            const play = $('m-dc-play')
            if (play) {
                const playing = !a.paused && !a.ended
                play.classList.toggle('is-playing', playing)
                const icon = play.querySelector('i')
                if (icon) icon.className = playing ? 'fas fa-pause' : 'fas fa-play'
            }
        })
    }

    function syncLike() {
        const src = $('player-like-btn')
        const btn = document.querySelector('#m-detail-controls [data-act="like"]')
        if (!src || !btn) return
        const liked = src.classList.contains('text-red-500') ||
            getComputedStyle(src).color.replace(/\s/g, '') === 'rgb(239,68,68)'
        btn.classList.toggle('is-liked', liked)
        const i = btn.querySelector('i')
        if (i) i.className = liked ? 'fas fa-heart' : 'far fa-heart'
    }

    /* ------------------------------------------- 4. 详情页开关状态同步 */
    function watchDetailState() {
        const view = $('view-player-detail')
        if (!view) return
        // 以「是否真的铺满屏幕」为准，而不是只看 class：
        // 不同入口（点击封面 / 手势 / 浏览器前进后退）改动的方式不一致，
        // 只看 class 会漏判，表现为底部播放条与导航压在控制区上、点击错位。
        const isOpen = () => {
            if (view.classList.contains('hidden')) return false
            if (view.classList.contains('translate-y-[100%]')) return false
            const r = view.getBoundingClientRect()
            return r.height > innerHeight * 0.5 && r.top < innerHeight * 0.5
        }
        let last = null
        const apply = () => {
            const open = isOpen()
            if (open === last) return
            last = open
            document.body.classList.toggle('is-detail-open', open)
            if (open) {
                syncProgress()
                syncLike()
                const m = document.querySelector('#m-detail-controls [data-act="mode"] i')
                if (m) m.className = `fas ${MODE_ICON[currentMode()]}`
            }
        }
        new MutationObserver(apply).observe(view, {
            attributes: true,
            attributeFilter: ['class', 'style'],
        })
        // 兜底：低帧率 WebView 里 class 变更可能合并，轮询保证状态不会卡住
        setInterval(apply, 400)
        apply()
    }

    /* ---------------------------------------------------------------- 启动 */
    function boot() {
        buildTabbar()
        buildMoreButton()
        buildSheet()
        buildDetailControls()
        watchViewChange()
        watchDetailState()
        bindDrawerLinks()
        setActiveTab('search')

        const a = audio()
        if (a) {
            a.addEventListener('timeupdate', syncProgress)
            a.addEventListener('durationchange', syncProgress)
            a.addEventListener('play', syncProgress)
            a.addEventListener('pause', syncProgress)
            a.addEventListener('loadedmetadata', syncProgress)
        }
        /* 歌曲切换后刷新喜欢态 */
        const titleEl = $('player-title')
        if (titleEl) new MutationObserver(() => setTimeout(syncLike, 120))
            .observe(titleEl, { childList: true, characterData: true, subtree: true })

        /* 抽屉展开时收起底部导航 */
        const sidebar = $('main-sidebar')
        if (sidebar) {
            new MutationObserver(() => {
                if (!isMobile()) return
                document.body.classList.toggle(
                    'is-drawer-open',
                    !sidebar.classList.contains('-translate-x-full')
                )
            }).observe(sidebar, { attributes: true, attributeFilter: ['class'] })
        }

        /* 播放队列抽屉同理 */
        const queue = $('queue-drawer')
        if (queue) {
            new MutationObserver(() => {
                if (!isMobile()) return
                document.body.classList.toggle(
                    'is-queue-open',
                    !queue.classList.contains('translate-x-full')
                )
            }).observe(queue, { attributes: true, attributeFilter: ['class'] })
        }

        window.addEventListener('resize', () => {
            if (!isMobile()) {
                document.body.classList.remove('is-detail-open')
                document.body.classList.remove('is-drawer-open')
                document.body.classList.remove('is-queue-open')
            }
        })
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true })
    } else {
        boot()
    }

    /* 供外部（如 app.js 内的切页逻辑）调用 */
    window.MobileShell = { setActiveTab, openSheet, closeSheet }
})()
