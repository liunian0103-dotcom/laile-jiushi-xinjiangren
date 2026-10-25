/* Display only: NiumaRewards remains the authority for awarding and spending. */
(() => {
  "use strict";
  let root, rewardNode, balanceNode, redemptionHint;
  let state = { reward: 100, balance: 0, visible: true };
  const number = value => Math.max(0, Math.floor(Number(value) || 0));
  const format = value => number(value).toLocaleString("zh-CN");
  const write = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };

  function mount() {
    if (root?.isConnected) return true;
    const hud = document.querySelector("#game-shell .hud");
    if (!hud) return false;
    root = document.createElement("div");
    root.className = "points-hud";
    root.setAttribute("aria-label", "本站通关奖励与礼遇钱包");
    root.innerHTML = '<span class="points-goal-label">通关可得</span><span class="points-goal"><b class="points-goal-value"></b><span>积分</span></span><span class="points-wallet">礼遇钱包 <b class="points-wallet-value"></b></span>';
    hud.prepend(root);
    rewardNode = root.querySelector(".points-goal-value");
    balanceNode = root.querySelector(".points-wallet-value");
    render();
    return true;
  }

  function render() {
    if (!root) return;
    write(rewardNode, `+${format(state.reward)}`);
    write(balanceNode, format(state.balance));
    root.hidden = !state.visible;
    root.setAttribute("aria-label", `本站通关可得 ${state.reward} 积分，礼遇钱包 ${state.balance} 积分`);
    if (redemptionHint) {
      redemptionHint.textContent = state.balance >= 100
        ? `钱包 ${format(state.balance)} · 可兑 ¥5 葡萄干券（演示）`
        : `钱包 ${format(state.balance)} · ${100 - state.balance} 积分后可兑葡萄干券（演示）`;
    }
  }

  function setStage(next = {}) {
    if (Object.hasOwn(next, "reward")) state.reward = number(next.reward);
    if (Object.hasOwn(next, "balance")) state.balance = number(next.balance);
    mount();
    render();
  }

  function setVisible(visible) {
    state.visible = !!visible;
    mount();
    render();
  }

  // Call only after an actual successful award and after the departure modal opens.
  // This does not change the wallet, reward text, or any saved state.
  function celebrate({ points = 0, balance = state.balance } = {}) {
    state.balance = number(balance);
    mount();
    render();
    const reward = document.querySelector("#stageRewardText");
    if (!reward || number(points) === 0) return;

    const text = reward.textContent;
    const match = text.match(/^\+(\d+)\s*(.*)$/s);
    if (match && number(match[1]) === number(points)) {
      const amount = document.createElement("span");
      amount.className = "points-earned-amount";
      amount.textContent = `+${format(points)}`;
      const unit = document.createElement("span");
      unit.className = "points-earned-unit";
      unit.textContent = match[2];
      reward.replaceChildren(amount, unit);
    }
    reward.classList.add("points-reward-line");
    reward.setAttribute("aria-live", "polite");
    if (!redemptionHint?.isConnected) {
      redemptionHint = document.createElement("p");
      redemptionHint.className = "points-redemption-hint";
      reward.after(redemptionHint);
    }
    render();
    reward.classList.remove("points-earned");
    void reward.offsetWidth;
    reward.classList.add("points-earned");
  }

  window.XinjiangPoints = Object.freeze({ mount, setStage, setVisible, celebrate });
})();
