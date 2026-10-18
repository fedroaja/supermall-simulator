// ============================================
// SUPERMALL SIMULATOR - UI Manager
// ============================================

import {
  SHOP_TYPES, LAND_EXPANSIONS, UPGRADES, TENANTS,
  LEVEL_SCALE, GAME_CONFIG, formatCoins, formatCurrency, getShopIncome
} from './gameData.js';

export class UIManager {
  constructor(gameState, onAction) {
    this.gameState = gameState;
    this.onAction = onAction;
    this.selectedShopType = null;
    this.activeTab = 'build';

    this.initTabs();
    this.renderBuildPanel();
    this.renderExpandPanel();
    this.renderUpgradePanel();
    this.bindGlobalEvents();
  }

  // ====== TABS ======
  initTabs() {
    document.querySelectorAll('.tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeTab = tab.dataset.tab;
        document.querySelectorAll('.panel-content').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${this.activeTab}`).classList.add('active');
        if (this.activeTab === 'manage') this.renderManagePanel();
        if (this.activeTab === 'expand') this.renderExpandPanel();
        if (this.activeTab === 'upgrade') this.renderUpgradePanel();
      });
    });
  }

  // ====== BUILD PANEL ======
  renderBuildPanel() {
    const grid = document.getElementById('shop-grid');
    grid.innerHTML = '';

    SHOP_TYPES.forEach(shopType => {
      const unlocked = this.gameState.mallLevel >= shopType.unlockLevel;
      const canAfford = this.gameState.coins >= shopType.buildCost;

      const card = document.createElement('div');
      card.className = `shop-card ${!unlocked ? 'disabled' : ''} ${this.selectedShopType?.id === shopType.id ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="shop-card-icon">${shopType.icon}</div>
        <div class="shop-card-name">${shopType.name}</div>
        <div class="shop-card-cost">💰 ${formatCoins(shopType.buildCost)}</div>
        <div class="shop-card-income">📈 +${formatCoins(shopType.baseIncomePerSec)}/dtk</div>
        ${!unlocked ? `<div style="font-size:0.62rem;color:var(--red)">🔒 Level ${shopType.unlockLevel}</div>` : ''}
        ${unlocked && !canAfford ? `<div style="font-size:0.62rem;color:var(--red)">Koin kurang</div>` : ''}
      `;

      if (unlocked) {
        card.addEventListener('click', () => {
          this.selectedShopType = this.selectedShopType?.id === shopType.id ? null : shopType;
          this.renderBuildPanel();
          this.onAction(this.selectedShopType ? 'select-shop-type' : 'deselect-shop-type', shopType);
        });
      }
      grid.appendChild(card);
    });
  }

  // ====== EXPAND PANEL ======
  renderExpandPanel() {
    const grid = document.getElementById('expand-grid');
    grid.innerHTML = '';

    LAND_EXPANSIONS.forEach(exp => {
      const unlocked = this.gameState.mallLevel >= exp.unlockLevel;
      const canAfford = this.gameState.coins >= exp.cost;

      const card = document.createElement('div');
      card.className = `expand-card ${(!unlocked || !canAfford) ? 'disabled' : ''}`;
      card.innerHTML = `
        <span style="font-size:28px">${exp.icon}</span>
        <div class="expand-card-info">
          <div class="expand-card-name">${exp.name}</div>
          <div class="expand-card-size">${exp.desc}</div>
          ${!unlocked ? `<div style="font-size:0.62rem;color:var(--red)">🔒 Level ${exp.unlockLevel}</div>` : ''}
          ${unlocked && !canAfford ? `<div style="font-size:0.62rem;color:var(--red)">Koin kurang</div>` : ''}
        </div>
        <div class="expand-card-cost">💰 ${formatCoins(exp.cost)}</div>
      `;

      if (unlocked && canAfford) {
        card.addEventListener('click', () => this.onAction('expand-land', exp));
      }
      grid.appendChild(card);
    });
  }

  // ====== MANAGE PANEL ======
  renderManagePanel() {
    const list = document.getElementById('manage-list');
    list.innerHTML = '';

    const occupied = Object.entries(this.gameState.grid)
      .filter(([, tile]) => tile.occupied && tile.shopType);

    if (!occupied.length) {
      list.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:20px;">Belum ada toko. Bangun toko terlebih dahulu!</div>`;
      return;
    }

    occupied.forEach(([key, tile]) => {
      const shopDef = SHOP_TYPES.find(s => s.id === tile.shopType);
      if (!shopDef) return;
      const lvlInfo = LEVEL_SCALE[tile.level] || LEVEL_SCALE[1];

      const item = document.createElement('div');
      item.className = 'manage-item';
      item.innerHTML = `
        <span style="font-size:24px">${shopDef.icon}</span>
        <div class="manage-item-info">
          <div class="manage-item-name">
            ${shopDef.name}
            <span class="level-badge">Lv.${tile.level} ${lvlInfo.label}</span>
          </div>
          <div class="manage-item-tenant">${tile.tenant ? `👤 ${tile.tenant}` : '🚫 Belum ada tenant'}</div>
        </div>
        <div style="text-align:right">
          <div class="manage-item-income">+${formatCoins(tile.incomePerSec)}/dtk</div>
          ${tile.tenant ? `<div style="font-size:0.65rem;color:var(--text-muted)">Aktif</div>` : ''}
        </div>
      `;
      list.appendChild(item);
    });
  }

  // ====== UPGRADE PANEL ======
  renderUpgradePanel() {
    const list = document.getElementById('upgrade-list');
    list.innerHTML = '';

    UPGRADES.forEach(upg => {
      const unlocked = this.gameState.mallLevel >= upg.unlockLevel;
      const purchased = this.gameState.upgrades.includes(upg.id);
      const canAfford = this.gameState.coins >= upg.cost;

      const card = document.createElement('div');
      card.className = `upgrade-card ${(!unlocked || purchased || !canAfford) ? 'disabled' : ''}`;
      card.innerHTML = `
        <div class="upgrade-card-header">
          <span class="upgrade-card-icon">${upg.icon}</span>
          <span class="upgrade-card-name">${upg.name}</span>
          ${purchased ? '<span style="color:var(--green);font-size:0.72rem;margin-left:auto">✓ Aktif</span>' : ''}
        </div>
        <div class="upgrade-card-desc">${upg.desc}</div>
        ${!purchased ? `<div class="upgrade-card-cost">💰 ${formatCoins(upg.cost)}</div>` : ''}
        ${!unlocked ? `<div style="font-size:0.65rem;color:var(--red)">🔒 Level ${upg.unlockLevel}</div>` : ''}
        ${unlocked && !purchased && !canAfford ? `<div style="font-size:0.65rem;color:var(--red)">Koin kurang</div>` : ''}
      `;

      if (unlocked && !purchased && canAfford) {
        card.addEventListener('click', () => this.onAction('buy-upgrade', upg));
      }
      list.appendChild(card);
    });
  }

  // ====== TILE INFO PANEL ======
  showTileInfo(key, tile, shopDef) {
    const panel = document.getElementById('tile-info-panel');

    document.getElementById('tile-info-icon').textContent = shopDef ? shopDef.icon : '🟩';
    document.getElementById('tile-info-name').textContent = shopDef ? shopDef.name : 'Lahan Kosong';

    const progressEl = document.getElementById('level-progress');
    const upgCostRow = document.getElementById('tile-upgcost-row');

    if (tile.occupied && shopDef) {
      const lvl = tile.level || 1;
      const lvlInfo = LEVEL_SCALE[lvl] || LEVEL_SCALE[1];
      const isMax = lvl >= GAME_CONFIG.MAX_SHOP_LEVEL;

      document.getElementById('tile-info-status').textContent = tile.tenant
        ? `Disewa oleh ${tile.tenant}`
        : 'Kosong — siap disewakan';

      document.getElementById('tile-income').textContent = `+${formatCoins(tile.incomePerSec)}/dtk`;
      document.getElementById('tile-tenant').textContent = tile.tenant || '—';
      document.getElementById('tile-level').textContent = `${lvl} — ${lvlInfo.label}`;

      // Level progress bar
      progressEl.style.display = '';
      document.getElementById('lvl-label-from').textContent = `Lv.${lvl}`;
      document.getElementById('lvl-label-to').textContent = isMax ? 'Maks!' : `→ Lv.${lvl + 1}`;
      document.getElementById('lvl-progress-fill').style.width = `${(lvl / GAME_CONFIG.MAX_SHOP_LEVEL) * 100}%`;

      // Upgrade cost
      if (!isMax) {
        const upgCost = Math.floor(shopDef.buildCost * lvl * 0.5);
        document.getElementById('tile-upgcost').textContent = `💰 ${formatCoins(upgCost)}`;
        upgCostRow.style.display = '';
      } else {
        upgCostRow.style.display = 'none';
      }

      // Actions
      const actions = document.getElementById('tile-actions');
      actions.innerHTML = '';

      if (!tile.tenant) {
        const rentBtn = document.createElement('button');
        rentBtn.className = 'btn-primary';
        rentBtn.textContent = `🤝 Sewa (${formatCoins(shopDef.rentCost)} koin)`;
        rentBtn.addEventListener('click', () => this.onAction('rent-shop', { key, shopDef }));
        actions.appendChild(rentBtn);
      } else if (!isMax) {
        const upgBtn = document.createElement('button');
        const upgCost = Math.floor(shopDef.buildCost * lvl * 0.5);
        upgBtn.className = 'btn-secondary';
        upgBtn.textContent = `⬆️ Upgrade ke Lv.${lvl + 1} (${formatCoins(upgCost)})`;
        upgBtn.addEventListener('click', () => this.onAction('upgrade-shop', { key }));
        actions.appendChild(upgBtn);
      } else {
        const maxEl = document.createElement('div');
        maxEl.style.cssText = 'text-align:center;color:var(--accent);font-size:0.85rem;font-weight:700;padding:6px';
        maxEl.textContent = '⭐ Level Maksimum!';
        actions.appendChild(maxEl);
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-danger';
      removeBtn.textContent = '🗑️ Bongkar (refund 30%)';
      removeBtn.addEventListener('click', () => {
        this.onAction('demolish-shop', { key });
        this.hideTileInfo();
      });
      actions.appendChild(removeBtn);

    } else {
      document.getElementById('tile-info-status').textContent = 'Lahan kosong — tersedia';
      document.getElementById('tile-income').textContent = '—';
      document.getElementById('tile-tenant').textContent = '—';
      document.getElementById('tile-level').textContent = '—';
      progressEl.style.display = 'none';
      upgCostRow.style.display = 'none';

      const actions = document.getElementById('tile-actions');
      actions.innerHTML = '';

      if (this.selectedShopType) {
        const buildBtn = document.createElement('button');
        buildBtn.className = 'btn-primary';
        buildBtn.textContent = `🏗️ Bangun ${this.selectedShopType.name} (${formatCoins(this.selectedShopType.buildCost)})`;
        buildBtn.addEventListener('click', () => {
          this.onAction('build-shop', { key, shopType: this.selectedShopType });
          this.hideTileInfo();
        });
        actions.appendChild(buildBtn);
      } else {
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:0.78rem;color:var(--text-muted);text-align:center;padding:8px;line-height:1.5';
        hint.textContent = 'Pilih tipe toko di tab Bangun terlebih dahulu, lalu klik tile ini.';
        actions.appendChild(hint);
      }
    }

    panel.classList.remove('hidden');
  }

  hideTileInfo() {
    document.getElementById('tile-info-panel').classList.add('hidden');
  }

  // ====== HUD UPDATES ======
  updateHUD(gameState) {
    document.getElementById('coin-value').textContent = formatCurrency(gameState.coins);
    const income = gameState.totalIncomePerSec * gameState.incomeMultiplier;
    document.getElementById('income-value').textContent = income > 0
      ? `+${formatCoins(income)}/dtk`
      : '+0/dtk';
    document.getElementById('shops-count').textContent = gameState.activeShops;
    document.getElementById('mall-level').textContent = gameState.mallLevel;
    document.getElementById('mall-tier').textContent = gameState.mallTier;
  }

  animateCoinGain() {
    const el = document.getElementById('coin-display');
    el.style.transform = 'scale(1.08)';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 140);
  }

  // ====== TOAST ======
  showToast(message, type = 'info', icon = '') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconMap = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `${icon || iconMap[type]} ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  // ====== MILESTONE ======
  showMilestone(icon, title, desc) {
    document.getElementById('milestone-icon').textContent = icon;
    document.getElementById('milestone-title').textContent = title;
    document.getElementById('milestone-desc').textContent = desc;
    document.getElementById('milestone-modal').classList.remove('hidden');
  }

  // ====== GLOBAL EVENTS ======
  bindGlobalEvents() {
    document.getElementById('close-tile-info').addEventListener('click', () => this.hideTileInfo());
    document.getElementById('milestone-close').addEventListener('click', () => {
      document.getElementById('milestone-modal').classList.add('hidden');
    });
    document.getElementById('btn-help').addEventListener('click', () => {
      this.showToast('Klik tile kosong → pilih toko → bangun → sewa tenant untuk income otomatis!', 'info', '💡');
    });
  }

  // ====== REFRESH ======
  refresh(gameState) {
    this.gameState = gameState;
    this.updateHUD(gameState);
    this.renderBuildPanel();
    if (this.activeTab === 'manage') this.renderManagePanel();
    if (this.activeTab === 'expand') this.renderExpandPanel();
    if (this.activeTab === 'upgrade') this.renderUpgradePanel();
  }
}
