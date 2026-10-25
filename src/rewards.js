(function () {
  'use strict';
  const KEY = 'niuma.rewards.v1';
  const POINTS = [100, 150, 200, 250, 300];
  const GOODS = [
    { id: 'raisins', shop: '丝路果干铺（虚拟）', name: '吐鲁番葡萄干', amount: 5, cost: 100, icon: '🍇', place: '吐鲁番' },
    { id: 'dates', shop: '沙海红枣铺（虚拟）', name: '若羌红枣', amount: 10, cost: 250, icon: '🌴', place: '若羌' },
    { id: 'dairy', shop: '草原奶香屋（虚拟）', name: '伊犁奶制品', amount: 20, cost: 500, icon: '🥛', place: '伊犁' },
    { id: 'gift', shop: '天山伴手礼（虚拟）', name: '新疆特产礼盒', amount: 30, cost: 800, icon: '🎁', place: '天山' }
  ];
  let state = { version: 1, balance: 0, awards: [], coupons: [] };
  let persistent = true, storageWarning = '', panel, callback, tab = 'shop', pending = null, receipt = null, message = '', returnFocus;
  const copy = value => JSON.parse(JSON.stringify(value));
  const uid = () => window.crypto && typeof window.crypto.randomUUID === 'function' ? window.crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function decode(raw) {
    if (raw === null) return { version: 1, balance: 0, awards: [], coupons: [] };
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Number.isSafeInteger(data.balance) || data.balance < 0 || !Array.isArray(data.awards) || !Array.isArray(data.coupons)) throw Error('Invalid wallet');
    const keys = new Set(), ids = new Set();
    let expected = 0;
    data.awards.forEach(a => {
      if (!a || typeof a.runId !== 'string' || !a.runId || !Number.isInteger(a.stage) || a.stage < 1 || a.stage > 5 || a.points !== POINTS[a.stage - 1]) throw Error('Invalid award');
      const key = JSON.stringify([a.runId, a.stage]);
      if (keys.has(key)) throw Error('Duplicate award');
      keys.add(key); expected += a.points;
    });
    data.coupons.forEach(c => {
      const good = c && GOODS.find(g => g.id === c.productId);
      if (!good || typeof c.id !== 'string' || !c.id || ids.has(c.id) || typeof c.createdAt !== 'string' || !Number.isFinite(Date.parse(c.createdAt)) || c.cost !== good.cost) throw Error('Invalid coupon');
      ids.add(c.id); expected -= c.cost;
    });
    if (expected !== data.balance) throw Error('Invalid balance');
    return { version: 1, balance: data.balance, awards: copy(data.awards), coupons: copy(data.coupons) };
  }
  function fallback(reason) {
    persistent = false;
    storageWarning = reason + '当前仅本次页面有效，刷新后新增积分与券不会保留。';
  }
  function refresh() {
    if (!persistent) return;
    try { state = decode(window.localStorage.getItem(KEY)); }
    catch (_) { fallback('无法读取本地钱包，原有存档未覆盖。'); }
  }
  refresh();
  function snapshot() {
    return { balance: state.balance, coupons: state.coupons.map(c => ({ ...copy(c), ...GOODS.find(g => g.id === c.productId), id: c.id })), persistent, storageWarning };
  }
  function notify() {
    render();
    if (typeof callback === 'function') { try { callback(snapshot()); } catch (error) { console.error('NiumaRewards onChange failed', error); } }
  }
  function save(next) {
    if (persistent) {
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); }
      catch (_) {
        fallback('本地保存不可用。');
        message = '本次未发奖或扣分。可在当前页面重试，但无法刷新保留。';
        notify(); return false;
      }
    }
    state = next;
    notify(); return true;
  }
  function beginRun() { return 'run-' + uid(); }
  function awardStage(args) {
    refresh();
    const { runId, stage } = args || {};
    const result = () => ({ awarded: false, points: 0, balance: state.balance });
    if (typeof runId !== 'string' || !runId.trim() || runId.length > 200 || !Number.isInteger(stage) || stage < 1 || stage > 5) return result();
    if (state.awards.some(a => a.runId === runId && a.stage === stage)) return result();
    const points = POINTS[stage - 1];
    const next = copy(state);
    next.balance += points;
    next.awards.push({ runId, stage, points });
    if (!save(next)) return result();
    message = '';
    return { awarded: true, points, balance: state.balance };
  }
  function redeem(id) {
    refresh();
    const good = GOODS.find(g => g.id === id);
    if (!good) return;
    if (state.balance < good.cost) { message = '还差 ' + (good.cost - state.balance) + ' 积分，继续通关就能兑换。'; notify(); return; }
    const next = copy(state);
    const coupon = { id: 'DEMO-' + uid(), productId: good.id, cost: good.cost, createdAt: new Date().toISOString() };
    next.balance -= good.cost;
    next.coupons.push(coupon);
    if (save(next)) { receipt = coupon; message = '兑换成功，已放入「我的券」。'; render(); }
  }
  function dateText(value) { return new Date(value).toLocaleString('zh-CN', { hour12: false }); }
  function card(g, coupon) {
    const lack = Math.max(0, g.cost - state.balance);
    return `<article class="nr-ticket nr-${g.id}"><div class="nr-ticket-top"><span class="nr-place">${g.place}特产</span><span class="nr-stamp">演示券</span></div><div class="nr-product"><span class="nr-icon" aria-hidden="true">${g.icon}</span><div><h3>${g.name}</h3><p>${g.shop}</p></div></div><div class="nr-value"><strong><small>¥</small>${g.amount}</strong><span>抵现券<small>仅用于玩法演示</small></span></div><div class="nr-ticket-bottom">${coupon ? `<p>兑换日期：${esc(dateText(coupon.createdAt))}</p><p class="nr-number">演示编号：${esc(coupon.id)}</p><button type="button" data-nr-detail="${esc(coupon.id)}">查看券详情</button>` : `<div class="nr-cost"><b>${g.cost}</b> 旅行积分</div><button type="button" data-nr-buy="${g.id}">${lack ? '还差 ' + lack + ' 积分' : '兑换这张券'}</button>`}</div></article>`;
  }
  function dialog() {
    const coupon = receipt;
    const good = GOODS.find(g => g.id === (coupon ? coupon.productId : pending));
    if (!good) return '';
    return `<div class="nr-dialog-backdrop"><section class="nr-dialog" aria-label="${coupon ? '券详情' : '确认兑换'}"><span class="nr-stamp">演示专用 · 无实际价值</span><h3>${coupon ? '你的特产演示券' : '确认兑换这张券？'}</h3><p>${good.shop}</p><p><strong>${good.name} · ${good.amount}元抵现券</strong></p>${coupon ? `<p>兑换日期：${esc(dateText(coupon.createdAt))}</p><p class="nr-number">演示编号：${esc(coupon.id)}</p>` : `<p>消耗 <strong>${good.cost}</strong> 旅行积分，兑换后剩余 <strong>${Math.max(0, state.balance - good.cost)}</strong> 积分。</p>`}<p class="nr-disclaimer">演示商城，优惠券不可实际消费。商家名称和券额均为演示设定，不代表真实合作，不支持核销。</p><div class="nr-actions">${coupon ? '<button type="button" data-nr-action="dismiss">知道了</button>' : '<button type="button" class="nr-secondary" data-nr-action="dismiss">取消</button><button type="button" data-nr-action="confirm">确认兑换</button>'}</div></section></div>`;
  }
  function render() {
    if (!panel || panel.hidden) return;
    const active = panel.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = active && ['data-nr-action', 'data-nr-tab', 'data-nr-buy', 'data-nr-detail'].map(k => active.hasAttribute(k) ? [k, active.getAttribute(k)] : null).find(Boolean);
    panel.innerHTML = `<section class="nr-sheet" role="dialog" aria-modal="true" aria-label="新疆特产演示商城" tabindex="-1"><header class="nr-header"><div><span class="nr-eyebrow">丝路旅途 · 通关有礼</span><h2>把新疆装进行囊</h2></div><button type="button" class="nr-close" data-nr-action="close" aria-label="关闭商城">×</button></header><p class="nr-disclaimer">演示商城，优惠券不可实际消费</p><div class="nr-wallet"><div><span>我的旅行积分</span><strong>${state.balance}</strong></div><p>每站通关得积分<br>新旅程继续攒，不随开局清零</p></div>${storageWarning ? `<p class="nr-warning" role="alert">${esc(storageWarning)}</p>` : ''}<nav class="nr-tabs" aria-label="商城页面"><button type="button" data-nr-tab="shop" aria-pressed="${tab === 'shop'}">特产商城</button><button type="button" data-nr-tab="coupons" aria-pressed="${tab === 'coupons'}">我的券 · ${state.coupons.length}</button></nav><p class="nr-status" role="status" aria-live="polite">${esc(message)}</p><div class="nr-grid">${tab === 'shop' ? GOODS.map(g => card(g)).join('') : state.coupons.length ? state.coupons.slice().reverse().map(c => card(GOODS.find(g => g.id === c.productId), c)).join('') : '<div class="nr-empty"><span aria-hidden="true">🎒</span><h3>行囊里还没有券</h3><p>通关第一站可得100积分，正好兑换一张葡萄干演示券。</p><button type="button" data-nr-action="close">返回旅途，去通关</button></div>'}</div><footer class="nr-footer">五站奖励：100 / 150 / 200 / 250 / 300 积分<br>虚拟商家 · 模拟兑换 · 不支持实际消费或核销</footer></section>${dialog()}`;
    const match = focusKey && Array.from(panel.querySelectorAll('button')).find(b => b.getAttribute(focusKey[0]) === focusKey[1]);
    if (pending || receipt) (panel.querySelector('.nr-dialog button')).focus();
    else if (match) match.focus();
    else if (active) panel.querySelector('.nr-sheet').focus();
  }
  function dismiss() { pending = null; receipt = null; render(); panel.querySelector('.nr-sheet').focus(); }
  function click(event) {
    event.stopPropagation();
    const button = event.target.closest('button');
    if (!button || !panel.contains(button)) {
      // Clicking receipt text (including the second click of a double click)
      // must keep keyboard events in the modal instead of the game document.
      if (!panel.contains(document.activeElement)) (panel.querySelector('.nr-dialog button') || panel.querySelector('.nr-sheet')).focus();
      return;
    }
    const action = button.dataset.nrAction;
    if (action === 'close') { close(); return; }
    if (action === 'dismiss') { dismiss(); return; }
    if (action === 'confirm') {
      if (!pending) return;
      const id = pending; pending = null;
      redeem(id); return;
    }
    if (pending || receipt) return;
    if (button.dataset.nrTab) { tab = button.dataset.nrTab; message = ''; render(); }
    if (button.dataset.nrBuy) {
      refresh();
      const good = GOODS.find(g => g.id === button.dataset.nrBuy);
      if (state.balance < good.cost) message = '还差 ' + (good.cost - state.balance) + ' 积分，通关下一站继续攒。';
      else { pending = good.id; message = ''; }
      render();
    }
    if (button.dataset.nrDetail) { receipt = state.coupons.find(c => c.id === button.dataset.nrDetail); render(); }
  }
  function keydown(event) {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (pending || receipt) dismiss(); else close(); }
    if (event.key !== 'Tab') return;
    const area = panel.querySelector('.nr-dialog') || panel;
    const buttons = Array.from(area.querySelectorAll('button')).filter(b => !b.disabled);
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
  function mount(options) {
    if (!options || !options.root || typeof options.root.appendChild !== 'function') return;
    if (panel) { close(); panel.remove(); }
    callback = options.onChange;
    panel = document.createElement('div'); panel.className = 'niuma-rewards'; panel.hidden = true; panel.tabIndex = -1;
    panel.addEventListener('click', click);
    panel.addEventListener('keydown', keydown);
    // The game disables native touch scrolling on :root. Keep this fallback
    // inside our panel rather than changing the game's document-level styles.
    let touchScroll = null;
    panel.addEventListener('touchstart', event => {
      touchScroll = null;
      if (event.touches.length !== 1) return;
      const area = event.target.closest('.nr-dialog, .nr-sheet');
      if (!area) return;
      for (let parent = area; parent; parent = parent.parentElement) {
        if (window.getComputedStyle(parent).touchAction === 'none') {
          touchScroll = { area, y: event.touches[0].clientY }; break;
        }
      }
    }, { passive: true });
    panel.addEventListener('touchmove', event => {
      event.stopPropagation();
      if (!touchScroll || event.touches.length !== 1) return;
      const y = event.touches[0].clientY;
      touchScroll.area.scrollTop += touchScroll.y - y;
      touchScroll.y = y;
      if (event.cancelable) event.preventDefault();
    }, { passive: false });
    ['touchend', 'touchcancel'].forEach(type => panel.addEventListener(type, () => { touchScroll = null; }));
    ['pointerdown', 'pointerup', 'pointermove', 'keyup', 'touchstart', 'touchend'].forEach(type => panel.addEventListener(type, e => e.stopPropagation()));
    options.root.appendChild(panel); refresh(); notify();
  }
  function open(nextTab) {
    if (!panel) return;
    if (panel.hidden) returnFocus = document.activeElement;
    tab = nextTab === 'coupons' ? 'coupons' : 'shop'; pending = null; receipt = null; message = '';
    refresh(); panel.hidden = false; notify(); panel.querySelector('.nr-sheet').focus();
  }
  function close() {
    if (!panel) return;
    panel.hidden = true; pending = null; receipt = null;
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
  }
  window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) { refresh(); notify(); } });
  window.NiumaRewards = Object.freeze({ mount, open, close, beginRun, awardStage, getState: () => { refresh(); return snapshot(); } });
}());
