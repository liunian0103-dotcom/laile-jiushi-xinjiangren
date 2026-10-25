(function () {
  'use strict';

  // Tunable character balance. The game owns when and how these values apply.
  const assetBase = new URL('../assets/characters/', document.currentScript.src);
  const characters = [
    {
      id: 'chen-xu', name: '陈序', gender: '男', job: '运维工程师',
      intro: '接得住系统故障，接不住凌晨三点的电话。',
      quote: '这次，给自己留个退路。', trait: '回滚预案',
      benefit: '每站抵挡 1 次越线伤害', cost: '弹珠伤害 −10%',
      style: '稳一点，也能走远', color: '#447baf',
      damageScale: 0.9, initialVolley: 3, stageSafetyCharges: 1,
      bonusPierce: 0, extraFirstLootPick: 0
    },
    {
      id: 'lu-xiao', name: '陆骁', gender: '男', job: '同城骑手',
      intro: '系统只算准时，没人算他跑了多远。',
      quote: '下一单，送自己去远方。', trait: '抄近道',
      benefit: '初始穿透 1 块障碍', cost: '基础弹数 2 颗（少 1 颗）',
      style: '路被堵住，就穿过去', color: '#ed9b32',
      damageScale: 1, initialVolley: 2, stageSafetyCharges: 0,
      bonusPierce: 1, extraFirstLootPick: 0
    },
    {
      id: 'lin-wan', name: '林晚', gender: '女', job: '视觉设计师',
      intro: '改过一百版，终于想为自己定一稿。',
      quote: '这一次，我就是最终稿。', trait: '第二方案',
      benefit: '每站首个技能箱多学 1 次', cost: '基础弹数 2 颗（少 1 颗）',
      style: '多一个方案，多一条路', color: '#926bc6',
      damageScale: 1, initialVolley: 2, stageSafetyCharges: 0,
      bonusPierce: 0, extraFirstLootPick: 1
    }
  ].map(function (character) {
    return Object.freeze(Object.assign(character, {
      portrait: new URL(character.id + '-portrait.svg', assetBase).href,
      artwork: new URL(character.id + '.svg', assetBase).href
    }));
  });

  let screen = null;
  let selectedId = characters[0].id;
  let onConfirm = null;
  let returnFocus = null;
  let mountCount = 0;

  function lookup(id) {
    return characters.find(function (character) { return character.id === id; }) || characters[0];
  }

  function get(id) { return Object.assign({}, lookup(id)); }
  function list() { return characters.map(function (character) { return get(character.id); }); }

  function createProfile(id) {
    const character = lookup(id);
    const profile = {};
    ['id', 'name', 'job', 'intro', 'portrait', 'artwork', 'damageScale',
      'initialVolley', 'stageSafetyCharges', 'bonusPierce', 'extraFirstLootPick'
    ].forEach(function (key) { profile[key] = character[key]; });
    return profile;
  }

  function updateSelection(id) {
    selectedId = lookup(id).id;
    if (!screen) return;
    screen.querySelectorAll('.nc-choice').forEach(function (input) {
      input.checked = input.value === selectedId;
    });
    screen.querySelector('.nc-confirm').textContent = '就选' + lookup(selectedId).name + '，出发 →';
    screen.querySelector('.nc-selected-line').textContent = lookup(selectedId).quote;
  }

  function close() {
    if (!screen || screen.hidden) return;
    screen.hidden = true;
    if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
      returnFocus.focus({ preventScroll: true });
    }
    returnFocus = null;
  }

  function open(options) {
    if (!screen) return;
    if (screen.hidden) returnFocus = document.activeElement;
    const id = options && Object.prototype.hasOwnProperty.call(options, 'selectedId')
      ? options.selectedId : selectedId;
    updateSelection(id);
    screen.hidden = false;
    screen.querySelector('.nc-choice:checked').focus({ preventScroll: true });
  }

  function mount(options) {
    if (!options || !options.root || typeof options.root.appendChild !== 'function') {
      throw new TypeError('NiumaCharacters.mount requires a DOM root.');
    }
    close();
    if (screen) screen.remove();
    onConfirm = typeof options.onConfirm === 'function' ? options.onConfirm : null;
    const prefix = 'nc-' + (++mountCount);
    screen = document.createElement('section');
    screen.className = 'nc-screen';
    screen.hidden = true;
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');
    screen.setAttribute('aria-labelledby', prefix + '-title');
    screen.innerHTML = `
      <div class="nc-panel">
        <header class="nc-header">
          <div><p class="nc-eyebrow">牛马突围 / 出发登记</p><h1 id="${prefix}-title">今天，换你选自己。</h1></div>
          <button type="button" class="nc-close" aria-label="关闭选角">×</button>
        </header>
        <div class="nc-roster" role="radiogroup" aria-label="选择一位出发的打工人">
          ${characters.map(function (character) { return `
            <label class="nc-card" style="--nc-accent:${character.color}">
              <input class="nc-choice" type="radio" name="${prefix}-character" value="${character.id}"
                aria-labelledby="${prefix}-${character.id}-name" aria-describedby="${prefix}-${character.id}-info">
              <span class="nc-card-inner">
                <span class="nc-card-top"><span>突围通行证</span><span class="nc-check" aria-hidden="true">✓</span></span>
                <span class="nc-identity">
                  <span class="nc-portrait"><img src="${character.portrait}" alt="${character.name}的原创像素头像" draggable="false"></span>
                  <span class="nc-nameplate"><strong id="${prefix}-${character.id}-name">${character.name}</strong><span>${character.job}</span><small>${character.style}</small></span>
                </span>
                <span class="nc-info" id="${prefix}-${character.id}-info">
                  <span class="nc-intro">${character.intro}</span>
                  <span class="nc-trait"><b>${character.trait}</b><span>${character.benefit}</span></span>
                  <span class="nc-cost"><b>代价</b> ${character.cost}</span>
                </span>
                <span class="nc-card-bottom" aria-hidden="true"><span class="nc-barcode"></span><span class="nc-select-label"></span></span>
              </span>
            </label>`; }).join('')}
        </div>
        <footer class="nc-footer"><p class="nc-selected-line" aria-live="polite"></p><button type="button" class="nc-confirm"></button></footer>
      </div>`;
    options.root.appendChild(screen);
    screen.addEventListener('change', function (event) {
      if (event.target.classList.contains('nc-choice')) updateSelection(event.target.value);
    });
    screen.querySelector('.nc-close').addEventListener('click', close);
    screen.querySelector('.nc-confirm').addEventListener('click', function () {
      if (screen.hidden) return;
      const id = selectedId;
      close(); // Close before callback: queued clicks cannot confirm twice.
      if (onConfirm) onConfirm(id);
    });
    screen.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(screen.querySelectorAll('button, input:checked'));
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault(); focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && index === focusable.length - 1) {
        event.preventDefault(); focusable[0].focus();
      }
    });
    updateSelection(selectedId);
  }

  window.NiumaCharacters = Object.freeze({ mount: mount, open: open, close: close,
    list: list, get: get, createProfile: createProfile });
})();
