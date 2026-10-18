// ============================================
// SUPERMALL SIMULATOR - Main Game Logic
// ============================================

import './style.css';
import { SceneManager } from './sceneManager.js';
import { UIManager } from './uiManager.js';
import { SoundManager } from './soundManager.js';
import {
  GAME_CONFIG, SHOP_TYPES, LAND_EXPANSIONS, UPGRADES,
  MALL_LEVELS, TENANTS, LEVEL_SCALE, formatCoins, formatCurrency, getShopIncome
} from './gameData.js';

// ====== GAME STATE ======
const gameState = {
  coins: GAME_CONFIG.INITIAL_COINS,
  totalIncomePerSec: 0,
  incomeMultiplier: 1.0,
  activeShops: 0,
  mallLevel: 1,
  mallTier: 'Pasar Mini',
  gridCols: GAME_CONFIG.INITIAL_GRID_SIZE.cols,
  gridRows: GAME_CONFIG.INITIAL_GRID_SIZE.rows,
  grid: {},
  upgrades: [],
  theme: 'dark',
  stats: {
    totalEarned: 0,
    totalShopsBuilt: 0,
    totalExpansions: 0,
  }
};

// ====== SAVE / LOAD ======
function saveGame() {
  try {
    localStorage.setItem('supermall_v2', JSON.stringify({
      coins: gameState.coins,
      gridCols: gameState.gridCols,
      gridRows: gameState.gridRows,
      grid: gameState.grid,
      upgrades: gameState.upgrades,
      theme: gameState.theme,
      stats: gameState.stats,
    }));
  } catch (e) { /* silent */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem('supermall_v2');
    if (!raw) return false;
    const d = JSON.parse(raw);
    gameState.coins     = d.coins ?? GAME_CONFIG.INITIAL_COINS;
    gameState.gridCols  = d.gridCols ?? GAME_CONFIG.INITIAL_GRID_SIZE.cols;
    gameState.gridRows  = d.gridRows ?? GAME_CONFIG.INITIAL_GRID_SIZE.rows;
    gameState.grid      = d.grid ?? {};
    gameState.upgrades  = d.upgrades ?? [];
    gameState.theme     = d.theme ?? 'dark';
    gameState.stats     = d.stats ?? { totalEarned: 0, totalShopsBuilt: 0, totalExpansions: 0 };
    return true;
  } catch { return false; }
}

// ====== GRID INIT ======
function initGrid(cols, rows) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = `${col}_${row}`;
      if (!gameState.grid[key]) {
        gameState.grid[key] = {
          col, row, occupied: false,
          shopType: null, tenant: null,
          incomePerSec: 0, level: 1,
        };
      }
    }
  }
}

// ====== RECALCULATE STATE ======
function recalcState() {
  let totalIncome = 0;
  let shopCount   = 0;

  Object.values(gameState.grid).forEach(tile => {
    if (tile.occupied && tile.shopType) {
      shopCount++;
      if (tile.tenant) totalIncome += tile.incomePerSec;
    }
  });

  // Multiplier from upgrades
  let multiplier = 1.0;
  UPGRADES.filter(u => gameState.upgrades.includes(u.id)).forEach(u => {
    if (u.effect.incomeMultiplier) multiplier *= u.effect.incomeMultiplier;
  });

  gameState.totalIncomePerSec = totalIncome;
  gameState.incomeMultiplier  = multiplier;
  gameState.activeShops       = shopCount;

  // Mall level
  const prevLevel = gameState.mallLevel;
  const lvl = [...MALL_LEVELS].reverse().find(l => shopCount >= l.minShops);
  if (lvl) {
    gameState.mallLevel = lvl.level;
    gameState.mallTier  = lvl.name;
  }
  return { levelUp: gameState.mallLevel > prevLevel, newLevel: gameState.mallLevel };
}

// ====== SHOP ACTIONS ======
function buildShop(key, shopTypeDef) {
  const tile = gameState.grid[key];
  if (!tile || tile.occupied || gameState.coins < shopTypeDef.buildCost) return false;
  gameState.coins -= shopTypeDef.buildCost;
  tile.occupied   = true;
  tile.shopType   = shopTypeDef.id;
  tile.level      = 1;
  tile.incomePerSec = getShopIncome(shopTypeDef, 1);
  gameState.stats.totalShopsBuilt++;
  return true;
}

function rentShop(key, shopDef) {
  const tile = gameState.grid[key];
  if (!tile || !tile.occupied || tile.tenant || gameState.coins < shopDef.rentCost) return false;
  gameState.coins -= shopDef.rentCost;
  const tenantList = TENANTS[shopDef.id] || ['Tenant Baru'];
  tile.tenant = tenantList[Math.floor(Math.random() * tenantList.length)];
  return true;
}

function upgradeShop(key) {
  const tile = gameState.grid[key];
  if (!tile || !tile.occupied) return false;
  const shopDef = SHOP_TYPES.find(s => s.id === tile.shopType);
  if (!shopDef) return false;
  if (tile.level >= GAME_CONFIG.MAX_SHOP_LEVEL) return { success: false, reason: 'max' };

  const upgCost = Math.floor(shopDef.buildCost * tile.level * 0.5);
  if (gameState.coins < upgCost) return { success: false, reason: 'coins', cost: upgCost };

  gameState.coins -= upgCost;
  tile.level++;
  tile.incomePerSec = getShopIncome(shopDef, tile.level);
  return { success: true, newLevel: tile.level };
}

function demolishShop(key) {
  const tile = gameState.grid[key];
  if (!tile || !tile.occupied) return false;
  const shopDef = SHOP_TYPES.find(s => s.id === tile.shopType);
  const refund = shopDef ? Math.floor(shopDef.buildCost * 0.3) : 0;
  gameState.coins += refund;
  tile.occupied = false; tile.shopType = null;
  tile.tenant = null; tile.incomePerSec = 0; tile.level = 1;
  return refund;
}

function expandLand(expansion) {
  if (gameState.coins < expansion.cost) return false;
  gameState.coins -= expansion.cost;
  gameState.gridCols = Math.min(GAME_CONFIG.GRID_COLS, gameState.gridCols + expansion.addCols);
  gameState.gridRows = Math.min(GAME_CONFIG.GRID_ROWS, gameState.gridRows + expansion.addRows);
  initGrid(gameState.gridCols, gameState.gridRows);
  gameState.stats.totalExpansions++;
  return true;
}

function buyUpgrade(upgrade) {
  if (gameState.coins < upgrade.cost || gameState.upgrades.includes(upgrade.id)) return false;
  gameState.coins -= upgrade.cost;
  gameState.upgrades.push(upgrade.id);
  return true;
}

// ====== MAIN ======
async function main() {
  const bar  = document.getElementById('loading-bar');
  const pct  = document.getElementById('loading-percent');
  const setP = (p) => { bar.style.width = `${p}%`; pct.textContent = `${p}%`; };

  setP(10); await sleep(80);
  const hasSave = loadGame();
  setP(30); await sleep(80);

  initGrid(gameState.gridCols, gameState.gridRows);
  setP(50); await sleep(120);

  const canvas = document.getElementById('game-canvas');
  const scene  = new SceneManager(canvas);
  const sound  = new SoundManager();
  setP(70); await sleep(150);

  // Apply saved theme
  applyTheme(gameState.theme, scene);

  scene.createTileGrid(gameState);
  setP(85); await sleep(120);

  // Restore saved shops
  if (hasSave) {
    Object.entries(gameState.grid).forEach(([key, tile]) => {
      if (tile.occupied && tile.shopType) {
        const shopDef = SHOP_TYPES.find(s => s.id === tile.shopType);
        if (shopDef) scene.addShopToScene(key, shopDef, gameState);
      }
    });
  }

  setP(100); await sleep(400);
  recalcState();

  const ui = new UIManager(gameState, handleAction);
  ui.updateHUD(gameState);

  document.getElementById('loading-screen').classList.add('hidden');

  // Welcome
  if (!hasSave) {
    setTimeout(() => ui.showToast('Selamat datang! Bangun kios pertama Anda 🏗️', 'success'), 800);
    setTimeout(() => ui.showMilestone('🏬', 'Selamat Datang!',
      'Anda adalah owner mall baru. Bangun kios dan sewakan ke tenant untuk income pasif!'), 1200);
  } else {
    setTimeout(() => ui.showToast(`Selamat datang kembali! 💰 ${formatCurrency(gameState.coins)} koin`, 'success'), 800);
  }

  // ====== ACTION HANDLER ======
  function handleAction(action, data) {
    sound._resume();

    switch (action) {
      case 'select-shop-type':
        sound.playClick();
        ui.showToast(`${data.icon} Mode bangun: ${data.name} — klik tile kosong`, 'info');
        break;

      case 'deselect-shop-type':
        sound.playClick();
        ui.showToast('Mode bangun dibatalkan', 'info');
        break;

      case 'build-shop': {
        const { key, shopType } = data;
        if (gameState.coins < shopType.buildCost) {
          sound.playError();
          ui.showToast(`Koin tidak cukup! Butuh ${formatCoins(shopType.buildCost)}`, 'error');
          return;
        }
        if (buildShop(key, shopType)) {
          scene.addShopToScene(key, shopType, gameState);
          const result = recalcState();
          ui.refresh(gameState);
          sound.playBuild();
          ui.showToast(`✅ ${shopType.name} dibangun!`, 'success');
          checkMilestone(result, ui, sound);
          saveGame();
        }
        break;
      }

      case 'rent-shop': {
        const { key, shopDef } = data;
        if (gameState.coins < shopDef.rentCost) {
          sound.playError();
          ui.showToast(`Koin tidak cukup! Sewa butuh ${formatCoins(shopDef.rentCost)}`, 'error');
          return;
        }
        if (rentShop(key, shopDef)) {
          const tile = gameState.grid[key];
          recalcState();
          ui.refresh(gameState);
          sound.playRent();
          ui.showToast(`🤝 ${tile.tenant} menyewa ${shopDef.name}!`, 'success');
          ui.showTileInfo(key, tile, shopDef);
          saveGame();
        }
        break;
      }

      case 'upgrade-shop': {
        const { key } = data;
        const tile = gameState.grid[key];
        const shopDef = SHOP_TYPES.find(s => s.id === tile?.shopType);
        const result = upgradeShop(key);

        if (result === false) {
          sound.playError();
          ui.showToast('Toko tidak bisa diupgrade!', 'error');
        } else if (!result.success) {
          if (result.reason === 'max') {
            ui.showToast('Toko sudah mencapai level maksimum! ⭐', 'info');
          } else {
            sound.playError();
            ui.showToast(`Koin tidak cukup! Butuh ${formatCoins(result.cost)}`, 'error');
          }
        } else {
          // Re-render building at new level
          scene.addShopToScene(key, shopDef, gameState);
          recalcState();
          ui.refresh(gameState);
          sound.playUpgrade();
          const lvlInfo = LEVEL_SCALE[tile.level] || LEVEL_SCALE[1];
          ui.showToast(`⬆️ ${shopDef?.name} naik ke Level ${tile.level} — ${lvlInfo.label}!`, 'success');
          ui.showTileInfo(key, tile, shopDef);
          saveGame();
        }
        break;
      }

      case 'demolish-shop': {
        const { key } = data;
        const tile = gameState.grid[key];
        const shopDef = SHOP_TYPES.find(s => s.id === tile?.shopType);
        const refund = demolishShop(key);
        if (refund !== false) {
          scene.removeShopFromScene(key);
          recalcState();
          ui.refresh(gameState);
          sound.playDemolish();
          ui.showToast(`🗑️ ${shopDef?.name} dibongkar. Refund: ${formatCoins(refund)} koin`, 'info');
          saveGame();
        }
        break;
      }

      case 'expand-land': {
        const exp = data;
        if (gameState.coins < exp.cost) {
          sound.playError();
          ui.showToast(`Koin tidak cukup! Butuh ${formatCoins(exp.cost)}`, 'error');
          return;
        }
        if (expandLand(exp)) {
          scene.expandGrid(gameState);
          recalcState();
          ui.refresh(gameState);
          sound.playExpand();
          ui.showToast(`📐 Lahan diperluas! (+${exp.addCols}x${exp.addRows} tile)`, 'success');
          ui.showMilestone('📐', 'Lahan Diperluas!',
            `Mall Anda kini ${gameState.gridCols}×${gameState.gridRows} tile. Bangun lebih banyak toko!`);
          saveGame();
        }
        break;
      }

      case 'buy-upgrade': {
        const upg = data;
        if (gameState.coins < upg.cost) {
          sound.playError();
          ui.showToast(`Koin tidak cukup! Butuh ${formatCoins(upg.cost)}`, 'error');
          return;
        }
        if (buyUpgrade(upg)) {
          recalcState();
          ui.refresh(gameState);
          sound.playUpgrade();
          ui.showToast(`${upg.icon} ${upg.name} berhasil dibeli! ${upg.desc}`, 'success');
          saveGame();
        }
        break;
      }
    }
  }

  // ====== CLICK HANDLER ======
  canvas.addEventListener('mouseup', (e) => {
    if (scene.isDragging || e.button !== 0) return;
    const hit = scene.getClickedTile();
    if (!hit) { ui.hideTileInfo(); return; }

    const { col, row, key } = hit;
    const tile = gameState.grid[key];
    if (!tile) return;

    const shopDef = tile.shopType ? SHOP_TYPES.find(s => s.id === tile.shopType) : null;
    scene.highlightTile(col, row, gameState, tile.occupied ? 0x6c63ff : 0x00e676);
    sound.playClick();

    // Auto-build if shop type selected and tile empty
    if (ui.selectedShopType && !tile.occupied) {
      handleAction('build-shop', { key, shopType: ui.selectedShopType });
      scene.hideHighlight();
      return;
    }

    ui.showTileInfo(key, tile, shopDef);
  });

  canvas.addEventListener('mousemove', () => {
    if (scene.isDragging) return;
    const hit = scene.getHoveredTile();
    if (!hit) return;
    const tile = gameState.grid[hit.key];
    const color = tile?.occupied ? 0x6c63ff : (ui.selectedShopType ? 0x00e676 : 0x444466);
    scene.highlightTile(hit.col, hit.row, gameState, color);
  });

  // ====== SOUND TOGGLE ======
  const btnSound = document.getElementById('btn-sound');
  btnSound.addEventListener('click', () => {
    const enabled = sound.toggle();
    btnSound.textContent = enabled ? '🔊' : '🔇';
    btnSound.classList.toggle('muted', !enabled);
    sound._resume();
  });

  // ====== THEME TOGGLE ======
  const btnTheme = document.getElementById('btn-theme');
  btnTheme.addEventListener('click', () => {
    gameState.theme = gameState.theme === 'dark' ? 'light' : 'dark';
    applyTheme(gameState.theme, scene);
    btnTheme.textContent = gameState.theme === 'dark' ? '🌙' : '☀️';
    sound.playClick();
    saveGame();
  });
  // Set initial icon
  btnTheme.textContent = gameState.theme === 'dark' ? '🌙' : '☀️';

  // ====== INCOME LOOP ======
  // Each active shop emits its own income per tick
  // Floating text shows per-shop income once per interval
  let lastTime = performance.now();
  let saveTimer = 0;
  let floatTimer = 0;
  const FLOAT_INTERVAL = 2.5; // seconds between floating income per shop

  function incomeLoop() {
    const now   = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    // Apply income
    const totalPerSec = gameState.totalIncomePerSec * gameState.incomeMultiplier;
    if (totalPerSec > 0) {
      const earned = totalPerSec * delta;
      gameState.coins += earned;
      gameState.stats.totalEarned += earned;
    }

    floatTimer += delta;
    saveTimer  += delta;

    // Every FLOAT_INTERVAL: show floating income from each rented shop
    if (floatTimer >= FLOAT_INTERVAL && totalPerSec > 0) {
      floatTimer = 0;

      const rentedShops = Object.entries(gameState.grid)
        .filter(([, t]) => t.occupied && t.tenant && t.incomePerSec > 0);

      // Show max 4 floats at a time to avoid clutter
      const toShow = rentedShops.slice(0, 4);
      toShow.forEach(([key, tile]) => {
        const perInterval = tile.incomePerSec * gameState.incomeMultiplier * FLOAT_INTERVAL;
        const pos = scene.getShopWorldPosition(key, gameState);
        // Small random offset so they don't overlap
        pos.x += (Math.random() - 0.5) * 0.8;
        scene.spawnFloatingText(pos, `+${formatCoins(perInterval)} 💰`, 0xffd700);
      });

      if (rentedShops.length > 0) {
        sound.playIncomeTick();
        ui.animateCoinGain();
      }
    }

    ui.updateHUD(gameState);

    // Auto-save
    if (saveTimer > 30) { saveGame(); saveTimer = 0; }

    requestAnimationFrame(incomeLoop);
  }

  incomeLoop();

  // ====== MILESTONE CHECK ======
  function checkMilestone(result, ui, sound) {
    if (result.levelUp) {
      const levelDef = MALL_LEVELS.find(l => l.level === result.newLevel);
      sound.playLevelUp();
      ui.showMilestone('🎉',
        `Mall Naik ke Level ${result.newLevel}!`,
        `Mall Anda kini menjadi "${levelDef?.name}"! Toko & fitur baru telah terbuka.`
      );
    }
  }
}

// ====== THEME HELPER ======
function applyTheme(theme, scene) {
  document.documentElement.setAttribute('data-theme', theme);
  if (scene) scene.setTheme(theme === 'light');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(console.error);
