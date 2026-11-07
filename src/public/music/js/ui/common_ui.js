/**
 * Common UI & Initialization Helpers
 */

(function () {
    // --- Setting Tooltips Mobile Support ---

    /**
     * After a tooltip becomes visible, clamp it so it never overflows the viewport.
     * Applies a corrective margin-left to the .setting-tooltip-content element.
     */
    function clampTooltipPosition(trigger) {
        const tooltip = trigger.querySelector('.setting-tooltip-content');
        if (!tooltip) return;

        // Reset any previous correction first
        tooltip.style.marginLeft = '';

        // Use rAF to ensure the browser has rendered the tooltip at its natural position
        requestAnimationFrame(() => {
            const rect = tooltip.getBoundingClientRect();
            const padding = 8; // min distance from viewport edge (px)
            let correction = 0;

            if (rect.left < padding) {
                // Overflows left edge → push right
                correction = padding - rect.left;
            } else if (rect.right > window.innerWidth - padding) {
                // Overflows right edge → push left
                correction = (window.innerWidth - padding) - rect.right;
            }

            if (correction !== 0) {
                tooltip.style.marginLeft = correction + 'px';
            }
        });
    }

    document.addEventListener('click', function (e) {
        const trigger = e.target.closest('.setting-tooltip-trigger');

        // Close all other tooltips
        document.querySelectorAll('.setting-tooltip-trigger.is-active').forEach(activeTrigger => {
            if (activeTrigger !== trigger) {
                activeTrigger.classList.remove('is-active');
                const t = activeTrigger.querySelector('.setting-tooltip-content');
                if (t) t.style.marginLeft = '';
            }
        });

        if (trigger) {
            // If it's a mobile device (or doesn't support hover)
            if (window.matchMedia('(hover: none)').matches) {
                trigger.classList.toggle('is-active');
                if (trigger.classList.contains('is-active')) {
                    clampTooltipPosition(trigger);
                } else {
                    const t = trigger.querySelector('.setting-tooltip-content');
                    if (t) t.style.marginLeft = '';
                }
                e.stopPropagation();
            }
        }
    });

    // Close tooltip when clicking outside
    document.addEventListener('touchstart', function (e) {
        if (!e.target.closest('.setting-tooltip-trigger')) {
            document.querySelectorAll('.setting-tooltip-trigger.is-active').forEach(trigger => {
                trigger.classList.remove('is-active');
                const t = trigger.querySelector('.setting-tooltip-content');
                if (t) t.style.marginLeft = '';
            });
        }
    }, { passive: true });
})();


/**
 * 跳转至管理后台
 * fnOS 下页面挂在 /app/<appname>/ 子路径，绝对路径 /admin 会跑到飞牛主站上，
 * 这里按当前路径前缀拼出真实地址，并补尾斜杠避免服务端 301 丢前缀。
 */
function goToAdmin() {
    var adminPath = (window.CONFIG && window.CONFIG['admin.path']) || '/admin';
    adminPath = String(adminPath).trim() || '/admin';
    if (adminPath.charAt(0) !== '/') adminPath = '/' + adminPath;
    adminPath = adminPath.replace(/\/+$/, '') + '/';

    var prefix = '';
    var m = location.pathname.match(/^\/app\/[^/]+/);
    if (m) prefix = m[0];

    location.href = prefix + adminPath;
}

/**
 * --- Project Agreement Modal Logic ---
 */

/**
 * 检查是否已接受协议，若未接受则展示弹窗
 */
function checkProjectAgreement() {
    // [fnOS 定制] 启动时不再弹出项目声明，直接视为已接受
    try {
        localStorage.setItem('lx_agreement_accepted', 'true');
    } catch (e) { /* ignore */ }
    const modal = document.getElementById('project-agreement-modal');
    if (modal) modal.classList.add('hidden');
    return;
}

function checkProjectAgreementLegacy() {
    const isAccepted = localStorage.getItem('lx_agreement_accepted');
    const modal = document.getElementById('project-agreement-modal');

    if (isAccepted === 'true') {
        console.log('[Agreement] Status: Already accepted.');
        return;
    }

    if (modal) {
        console.log('[Agreement] Status: Not accepted. Showing modal.');
        // 将 modal 移到 body 直接子元素，防止被祖先 transform/hidden 容器破坏布局
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        console.warn('[Agreement] Modal element not found!');
    }
}

/**
 * 接受协议并关闭弹窗
 */
function acceptProjectAgreement() {
    localStorage.setItem('lx_agreement_accepted', 'true');
    const modal = document.getElementById('project-agreement-modal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
            // 接受后自动跳转到关于界面展示详细协议
            readAgreementInAbout();
        }, 300);
    }
}

/**
 * 在“关于”页面查看详细协议并自动滚动
 */
function readAgreementInAbout() {
    if (typeof switchTab === 'function') {
        switchTab('about');
        setTimeout(() => {
            const aboutContainer = document.getElementById('view-about');
            if (aboutContainer) {
                const agreementHeader = Array.from(aboutContainer.querySelectorAll('h2')).find(h => h.innerText.includes('项目协议'));
                if (agreementHeader) {
                    agreementHeader.scrollIntoView({ behavior: 'smooth' });
                } else {
                    aboutContainer.scrollTo({ top: aboutContainer.scrollHeight, behavior: 'smooth' });
                }
            }
        }, 500);
    }

    // 手机端自动收起侧边栏
    if (window.innerWidth <= 1024 && typeof toggleSidebar === 'function') {
        const sidebar = document.getElementById('main-sidebar');
        if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
            toggleSidebar();
        }
    }
}

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    checkProjectAgreement();
});

/**
 * 字符串编辑距离相似度计算 (Levenshtein Distance)
 * @param {string} a 
 * @param {string} b 
 * @returns {number} 0 ~ 1 之间的相似度得分
 */
function calcSimilar(a, b) {
    if (!a || !b) return 0;
    a = String(a).trim().toLowerCase();
    b = String(b).trim().toLowerCase();
    if (a === b) return 1;
    if (a.length > b.length) {
        let t = b;
        b = a;
        a = t;
    }
    const al = a.length;
    const bl = b.length;
    if (bl === 0) return 0;

    let mp = [];
    for (let i = 0; i <= bl; i++) mp[i] = i;

    for (let i = 1; i <= al; i++) {
        const ai = a.charAt(i - 1);
        let lt = mp[0];
        mp[0] = mp[0] + 1;
        for (let j = 1; j <= bl; j++) {
            const tmp = Math.min(mp[j] + 1, mp[j - 1] + 1, lt + (ai === b.charAt(j - 1) ? 0 : 1));
            lt = mp[j];
            mp[j] = tmp;
        }
    }
    return Math.max(0, 1 - (mp[bl] / bl));
}

/**
 * 搜索结果按文本相似度重排序与去重
 * @param {Array} list 原始搜索结果列表
 * @param {string} keyword 搜索关键词
 * @param {boolean} isSong 是否为歌曲搜索 (true: 歌曲, false: 歌单/其他)
 * @returns {Array} 排序并去重后的结果列表
 */
function sortSearchResults(list, keyword, isSong = true) {
    if (!Array.isArray(list) || list.length === 0) return [];
    if (!keyword) return list;

    // 1. 去重 (歌曲基于 id / songmid / hash；歌单基于 id / playListId)
    const seen = new Set();
    const uniqueList = list.filter(item => {
        const key = item.id || item.songmid || item.hash || item.playListId || `${item.name}_${item.singer || item.author || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // 2. 计算匹配度并排序
    //    [Fix] 之前用「歌名 + 歌手」整串算相似度，歌手名越短得分越高，
    //    导致「九万字 / 吱」这类单字歌手的翻唱把正版（九万字 / 黄诗扶）顶到后面，
    //    列表里看起来像歌手只显示了一个字。这里改成以歌名为主要权重，
    //    歌手只作为轻微加权，同分时保留平台原始顺序（平台的相关性排序通常最好）。
    const kw = keyword.trim().toLowerCase();
    const readWho = (item) => String(isSong ? (item.singer || item.artist || '') : (item.author || item.creator || '')).toLowerCase();
    // 判断这次是「按歌名搜」还是「按歌手搜」：
    // 搜「九万字」时大量条目歌名就是关键词；搜「周杰伦」时大量条目歌手是关键词。
    // 只看单一条件时，歌手名恰好等于关键词的其它歌会把正版顶掉。
    let nameExact = 0;
    let whoExact = 0;
    for (const it of uniqueList) {
        if (String(it.name || '').toLowerCase() === kw) nameExact++;
        if (readWho(it) === kw) whoExact++;
    }
    const singerSearch = whoExact > nameExact;

    return uniqueList.map((item, idx) => {
        const name = String(item.name || '').toLowerCase();
        const who = readWho(item);
        let score = Math.max(calcSimilar(kw, name), calcSimilar(kw, who)) * 3;

        if (singerSearch ? (who === kw) : (name === kw)) {
            score += 1.9;
        } else if (singerSearch ? (name === kw) : (who === kw)) {
            score += 0.9;
        } else if (name.includes(kw)) {
            score += 0.4;
        } else if (who.includes(kw)) {
            score += 0.3;
        }
        // 歌手名极短（多为翻唱昵称或脏数据）轻微降权，避免压过正版
        if (isSong && who && who.length <= 1) score -= 0.15;

        return { score, idx, data: item };
    })
    .sort((a, b) => (b.score - a.score) || (a.idx - b.idx))
    .map(item => item.data);
}

window.calcSimilar = calcSimilar;
window.sortSearchResults = sortSearchResults;

