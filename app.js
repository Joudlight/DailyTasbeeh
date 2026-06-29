/* =====================================================
   Dhikr Companion — Comprehensive Adhkar Platform
   Application logic v3.0
   - Sidebar navigation with ~20 categories
   - Search across all adhkar
   - Favorites/bookmark system
   - Progress tracking per category
   - Multi-stage counter (post-prayer 33+33+33+1)
   - No-counter cards for general duas
   - Hadith info modal (source, grading, explanation)
   - 99 Names of Allah display (no counter)
   - Standard international numbers
   ===================================================== */

(function () {
  'use strict';

  // ===================================================
  // 1. State + persistence
  // ===================================================
  const STORAGE_KEYS = {
    counts: 'dhikr:counts',
    custom: 'dhikr:custom',
    daily: 'dhikr:daily',
    streak: 'dhikr:streak',
    settings: 'dhikr:settings',
    completedToday: 'dhikr:completedToday',
    badges: 'dhikr:badges',
    completedEver: 'dhikr:completedEver',
    reminders: 'dhikr:reminders',
    favorites: 'dhikr:favorites',
    timerSessions: 'dhikr:timerSessions',
  };

  const DEFAULT_SETTINGS = {
    theme: 'light',
    sound: false,
    completionSound: true,
    vibration: true,
    fontScale: 'medium',
    remindersEnabled: false,
    remindersMorning: '05:00',
    remindersEvening: '17:30',
    hijriAdjustment: 0,
  };

  const BADGES = [
    { id: 'first_dhikr', icon: '🌟', title: 'أول ذكر', desc: 'أكمل أول ذكر' },
    { id: 'ten_today', icon: '🌙', title: 'يوم مبارك', desc: 'أكمل 10 أذكار في يوم' },
    { id: 'streak_3', icon: '🔥', title: 'ثلاثة أيام', desc: '3 أيام متتالية' },
    { id: 'streak_7', icon: '💎', title: 'أسبوع كامل', desc: '7 أيام متتالية' },
    { id: 'streak_30', icon: '👑', title: 'شهر الإصرار', desc: '30 يومًا متتالية' },
    { id: 'total_1000', icon: '🤲', title: 'ألف تسبيحة', desc: '1000 تسبيحة إجمالية' },
    { id: 'total_10000', icon: '✨', title: 'خادم الذكر', desc: '10000 تسبيحة إجمالية' },
    { id: 'all_morning', icon: '🌅', title: 'ورد الصباح', desc: 'أكمل كل أذكار الصباح' },
    { id: 'all_evening', icon: '🌃', title: 'ورد المساء', desc: 'أكمل كل أذكار المساء' },
    { id: 'sleep_dhikr', icon: '🌌', title: 'سكينة الليل', desc: 'أكمل كل أذكار النوم' },
    { id: 'wake_dhikr', icon: '☀️', title: 'صباح النور', desc: 'أكمل كل أذكار الاستيقاظ' },
    { id: 'all_postprayer', icon: '🕌', title: 'دبر الصلاة', desc: 'أكمل أذكار ما بعد الصلاة' },
    { id: 'all_names_read', icon: '📿', title: 'قارئ الأسماء', desc: 'تصفّح أسماء الله الحسنى كاملة' },
    { id: 'free_500', icon: '♾️', title: 'سبحة بلا حدود', desc: '500 تسبيحة في السبحة الحرة' },
  ];
  const BADGES_BY_ID = Object.fromEntries(BADGES.map(b => [b.id, b]));

  let state = {
    counts: {},
    custom: [],
    daily: {},
    streak: { count: 0, lastDay: null, best: 0 },
    settings: { ...DEFAULT_SETTINGS },
    completedToday: {},
    badges: {},
    completedEver: {},
    reminders: { lastMorning: null, lastEvening: null },
    favorites: {}, // { [id]: true }
    namesViewed: {}, // { [name_index]: true } — for the "all_names_read" badge
    timerSessions: [], // [{ id, activity, minutes, date, ts }] — productivity timer log
  };

  function loadState() {
    try {
      for (const k of Object.keys(STORAGE_KEYS)) {
        const raw = localStorage.getItem(STORAGE_KEYS[k]);
        if (raw !== null) state[k] = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to load state', e);
    }
    state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
    state.counts = state.counts || {};
    state.custom = state.custom || [];
    state.daily = state.daily || {};
    state.streak = state.streak || { count: 0, lastDay: null, best: 0 };
    if (state.streak.best == null) state.streak.best = state.streak.count || 0;
    state.completedToday = state.completedToday || {};
    state.badges = state.badges || {};
    state.completedEver = state.completedEver || {};
    state.reminders = state.reminders || { lastMorning: null, lastEvening: null };
    state.favorites = state.favorites || {};
    state.namesViewed = state.namesViewed || {};
    state.timerSessions = Array.isArray(state.timerSessions) ? state.timerSessions : [];
  }

  function saveState(key) {
    try {
      localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(state[key]));
    } catch (e) {
      console.warn('Failed to save state', e);
    }
  }

  // ===================================================
  // 2. Utilities
  // ===================================================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const dayKeyFromDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Use standard international numbers (1, 2, 3...) — NOT Arabic-Indic numerals
  function fmtNum(n) {
    return Number(n).toLocaleString('en-US');
  }

  function showToast(message, type = 'success', duration = 2400) {
    const container = $('#toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconMap = {
      success: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      warning: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      danger: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    };
    toast.innerHTML = `<span class="toast-icon">${iconMap[type] || iconMap.success}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('exit');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ===================================================
  // 3. Audio
  // ===================================================
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTapSound() {
    if (!state.settings.sound) return;
    const ctx = getAudioCtx(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  }

  function playCompletionSound() {
    if (!state.settings.completionSound) return;
    const ctx = getAudioCtx(); if (!ctx) return;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.08;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  function vibrate(pattern = 20) {
    if (!state.settings.vibration) return;
    if ('vibrate' in navigator) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  // ===================================================
  // 4. SVG defs for counter gradient
  // ===================================================
  function ensureSvgDefs() {
    if (document.getElementById('dhikrSvgDefs')) return;
    const svg = `
      <svg width="0" height="0" style="position:absolute" aria-hidden="true">
        <defs>
          <linearGradient id="counterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#14b88a"/>
            <stop offset="100%" stop-color="#0b7a5f"/>
          </linearGradient>
        </defs>
      </svg>`;
    document.body.insertAdjacentHTML('afterbegin', svg);
  }

  // ===================================================
  // 5. Counter logic
  // ===================================================
  function getCount(dhikrId) {
    return state.counts[dhikrId] || { count: 0, completedRounds: 0, lastTarget: null, stages: null };
  }

  function isCompleted(dhikr) {
    const c = getCount(dhikr.id);
    if (dhikr.target === undefined || dhikr.target === null) {
      // No-counter card — completion tracked via completedToday
      const tk = todayKey();
      return (state.completedToday[tk] || []).includes(dhikr.id);
    }
    return c.count >= dhikr.target;
  }

  function handleTap(dhikr, card) {
    const c = getCount(dhikr.id);
    const wasCompleted = c.count >= dhikr.target;
    c.count += 1;

    const center = card.querySelector && card.querySelector('.counter-center');
    if (center) {
      center.classList.remove('pulse');
      void center.offsetWidth;
      center.classList.add('pulse');
    }

    playTapSound();
    vibrate(15);

    const tk = todayKey();
    state.daily[tk] = (state.daily[tk] || 0) + 1;
    updateStreak();

    const nowCompleted = c.count >= dhikr.target;
    if (nowCompleted && !wasCompleted) {
      c.completedRounds = (c.completedRounds || 0) + 1;
      onDhikrCompleted(dhikr, card);
    }

    state.counts[dhikr.id] = c;
    saveState('counts');
    saveState('daily');
    saveState('streak');

    if (!dhikr.continueAfter && c.count > dhikr.target) {
      c.count = dhikr.target;
      state.counts[dhikr.id] = c;
      saveState('counts');
    }

    updateCardUI(card, dhikr);
    updateStats();
    checkBadges();
  }

  function handleUndo(dhikr, card) {
    const c = getCount(dhikr.id);
    if (c.count <= 0) return;
    c.count -= 1;
    state.counts[dhikr.id] = c;
    const tk = todayKey();
    if (state.daily[tk]) state.daily[tk] = Math.max(0, state.daily[tk] - 1);
    saveState('counts');
    saveState('daily');
    updateCardUI(card, dhikr);
    updateStats();
  }

  function handleReset(dhikr, card) {
    state.counts[dhikr.id] = { count: 0, completedRounds: 0, lastTarget: dhikr.target, stages: null };
    saveState('counts');
    const tk = todayKey();
    if (state.completedToday[tk]) {
      state.completedToday[tk] = state.completedToday[tk].filter(id => id !== dhikr.id);
      saveState('completedToday');
    }
    updateCardUI(card, dhikr);
    updateStats();
    showToast('تم تصفير العداد', 'warning', 1500);
  }

  // For no-counter cards: mark as "read/done"
  function handleReadToggle(dhikr, card) {
    const tk = todayKey();
    if (!state.completedToday[tk]) state.completedToday[tk] = [];
    const isDone = state.completedToday[tk].includes(dhikr.id);
    if (isDone) {
      state.completedToday[tk] = state.completedToday[tk].filter(id => id !== dhikr.id);
      showToast('تم إلغاء التحديد', 'warning', 1400);
    } else {
      state.completedToday[tk].push(dhikr.id);
      onDhikrCompleted(dhikr, card);
    }
    saveState('completedToday');
    updateCardUI(card, dhikr);
    updateStats();
    checkBadges();
  }

  function onDhikrCompleted(dhikr, card) {
    playCompletionSound();
    vibrate([30, 40, 30]);
    const tk = todayKey();
    if (!state.completedToday[tk]) state.completedToday[tk] = [];
    if (!state.completedToday[tk].includes(dhikr.id)) {
      state.completedToday[tk].push(dhikr.id);
      saveState('completedToday');
    }
    if (!state.completedEver) state.completedEver = {};
    if (!state.completedEver[dhikr.id]) {
      state.completedEver[dhikr.id] = true;
      saveState('completedEver');
    }
    triggerCelebration(card);
    const messages = ['ما شاء الله 🌟', 'تقبل الله 🤲', 'سبحان الله ✨', 'بارك الله فيك 🌿', 'أحسنت 🌸'];
    showToast(messages[Math.floor(Math.random() * messages.length)], 'success', 2200);
  }

  function triggerCelebration(card) {
    if (!card || !card.querySelector) return;
    const burst = card.querySelector('.celebration-burst');
    if (!burst) return;
    const colors = ['#14b88a', '#0b7a5f', '#c8a04a', '#e3c177', '#14b88a'];
    for (let i = 0; i < 14; i++) {
      const spark = document.createElement('span');
      spark.className = 'spark';
      spark.style.background = colors[i % colors.length];
      spark.style.left = '50%';
      spark.style.top = '50%';
      const angle = (Math.PI * 2 * i) / 14;
      const distance = 60 + Math.random() * 40;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      spark.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0)', opacity: 1 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.4)`, opacity: 1, offset: 0.3 },
          { transform: `translate(calc(-50% + ${dx * 1.3}px), calc(-50% + ${dy * 1.3 + 30}px)) scale(0)`, opacity: 0 },
        ],
        { duration: 900, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' }
      );
      burst.appendChild(spark);
      setTimeout(() => spark.remove(), 950);
    }
  }

  // ===================================================
  // 6. Favorites
  // ===================================================
  function toggleFavorite(id) {
    if (state.favorites[id]) {
      delete state.favorites[id];
      showToast('تمت الإزالة من المفضلة', 'warning', 1500);
    } else {
      state.favorites[id] = true;
      showToast('تمت الإضافة إلى المفضلة', 'success', 1500);
    }
    saveState('favorites');
    updateFavCount();
    // Re-render current view + favorites if open
    const activeView = $('.view-panel.active');
    if (activeView) {
      const viewId = activeView.id;
      if (viewId === 'view-favorites') renderFavoritesGrid();
      else if (viewId === 'view-category') renderCategoryGrid(currentCategoryId);
      else if (viewId === 'view-search') runSearch($('#searchInput').value.trim());
      else if (viewId === 'view-home') renderHomeView();
    }
  }

  function updateFavCount() {
    const count = Object.keys(state.favorites).length;
    const el = $('#favCount');
    if (el) {
      el.textContent = fmtNum(count);
      el.hidden = count === 0;
    }
  }

  // ===================================================
  // 7. Render dhikr cards
  // ===================================================
  function gradingClass(grading) {
    const g = (grading || '').toLowerCase();
    if (g.includes('قرآني') || g.includes('quran')) return 'quranic';
    if (g.includes('عام')) return 'general';
    if (g.includes('حسن')) return 'hasan';
    return '';
  }

  function renderDhikrCard(dhikr, options = {}) {
    const { isCustom = false, isFavorite = false, showCategory = false } = options;
    const isStaged = dhikr.type === 'staged';
    const hasCounter = dhikr.target != null && !isStaged;
    const c = getCount(dhikr.id);
    const completed = isCompleted(dhikr);

    const isDua = !!dhikr.noCounter;

    const card = document.createElement('article');
    let cls = 'dhikr-card';
    if (!hasCounter && !isStaged && !isDua) cls += ' no-counter';
    if (isDua) cls += ' dua-card';
    if (isStaged) cls += ' staged-card';
    if (completed) cls += ' completed';
    if (isFavorite || state.favorites[dhikr.id]) cls += ' is-favorite';
    card.className = cls;
    card.dataset.dhikrId = dhikr.id;
    card.dataset.custom = isCustom ? 'true' : 'false';
    if (isCustom) card.dataset.order = dhikr.order != null ? dhikr.order : 0;
    card.setAttribute('draggable', isCustom ? 'true' : 'false');

    // ====== Card head ======
    let headHtml = `<div class="dhikr-card-head">`;
    if (dhikr.label || showCategory) {
      const labelText = showCategory && dhikr.categoryName ? dhikr.categoryName : (dhikr.label || '');
      headHtml += `<span class="dhikr-label" lang="ar">${escapeHtml(labelText)}</span>`;
    } else {
      headHtml += `<span></span>`;
    }
    headHtml += `<div class="dhikr-actions">
      <button class="dhikr-mini-btn fav-btn ${state.favorites[dhikr.id] ? 'is-fav' : ''}" data-action="favorite" aria-label="إضافة للمفضلة" title="المفضلة">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
      <button class="dhikr-mini-btn info-btn" data-action="detail" aria-label="تفاصيل" title="التفاصيل والمصدر">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </button>`;
    if (!isStaged && hasCounter) {
      headHtml += `<button class="dhikr-mini-btn" data-action="focus" aria-label="وضع التركيز" title="وضع التركيز (ملء الشاشة)">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
      </button>`;
    }
    if (isCustom) {
      headHtml += `
        <button class="dhikr-mini-btn drag-handle" aria-label="إعادة ترتيب" title="اسحب لإعادة الترتيب">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
            <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
          </svg>
        </button>
        <button class="dhikr-mini-btn edit" data-action="edit" aria-label="تعديل" title="تعديل">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="dhikr-mini-btn" data-action="delete" aria-label="حذف" title="حذف">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>`;
    }
    headHtml += `</div></div>`;

    card.innerHTML = headHtml;

    // ====== Arabic text ======
    const arabicDiv = document.createElement('div');
    arabicDiv.className = 'dhikr-arabic';
    arabicDiv.lang = 'ar';
    arabicDiv.dir = 'rtl';
    arabicDiv.textContent = dhikr.arabic;
    card.appendChild(arabicDiv);

    // ====== Translation ======
    if (dhikr.translation) {
      const trDiv = document.createElement('div');
      trDiv.className = 'dhikr-translation';
      trDiv.textContent = dhikr.translation;
      card.appendChild(trDiv);
    }

    // ====== Source / grading bar ======
    if (dhikr.source || dhikr.grading) {
      const srcDiv = document.createElement('div');
      srcDiv.className = 'dhikr-source';
      if (dhikr.grading) {
        srcDiv.innerHTML += `<span class="grading-badge ${gradingClass(dhikr.grading)}">${escapeHtml(dhikr.grading)}</span>`;
      }
      if (dhikr.source) {
        srcDiv.innerHTML += `<span class="source-text">${escapeHtml(dhikr.source)}</span>`;
      }
      card.appendChild(srcDiv);
    }

    // ====== Counter area OR read card OR staged (skipped entirely for dua/display-only items) ======
    if (isStaged) {
      renderStagedCounter(card, dhikr);
    } else if (hasCounter) {
      renderCounterArea(card, dhikr);
    } else if (!isDua) {
      renderReadCard(card, dhikr);
    }

    // ====== Progress bar (only for counter cards) ======
    if (hasCounter) {
      const pct = Math.min(c.count / dhikr.target, 1);
      const barDiv = document.createElement('div');
      barDiv.className = 'dhikr-bar';
      barDiv.innerHTML = `<div class="dhikr-bar-fill" style="width: ${Math.round(pct * 100)}%"></div>`;
      card.appendChild(barDiv);
    }

    // ====== Footer (with mini actions) ======
    const footer = document.createElement('div');
    footer.className = 'dhikr-footer';
    if (hasCounter) {
      const pct = Math.min(c.count / dhikr.target, 1);
      const pctRounded = Math.round(pct * 100);
      let metaHtml = `<span class="pct">${pctRounded}%</span>`;
      if (c.completedRounds > 0) metaHtml += `<span>·</span><span>${fmtNum(c.completedRounds)} دورة</span>`;
      footer.innerHTML = `<div class="dhikr-progress-meta">${metaHtml}</div>`;
      footer.innerHTML += `<div class="dhikr-mini-actions">
        <button class="mini-btn" data-action="undo">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          <span>تراجع</span>
        </button>
        <button class="mini-btn danger" data-action="reset">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          <span>تصفير</span>
        </button>
      </div>`;
    } else if (isDua) {
      footer.innerHTML = `<div></div><div class="dhikr-mini-actions">
        <button class="mini-btn" data-action="copy-dua">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>نسخ</span>
        </button>
        <button class="mini-btn" data-action="share-dua">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          <span>مشاركة</span>
        </button>
      </div>`;
    } else if (!isStaged) {
      footer.innerHTML = `<div></div><div class="dhikr-mini-actions">
        <button class="mini-btn" data-action="toggle-read">
          ${completed
            ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>تم</span>'
            : '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>تم</span>'}
        </button>
      </div>`;
    }
    card.appendChild(footer);

    // ====== Celebration burst container ======
    const burst = document.createElement('div');
    burst.className = 'celebration-burst';
    burst.setAttribute('aria-hidden', 'true');
    card.appendChild(burst);

    // ====== Wire events ======
    wireCardEvents(card, dhikr, isCustom);

    return card;
  }

  function renderCounterArea(card, dhikr) {
    const c = getCount(dhikr.id);
    const target = dhikr.target;
    const isCompleted = c.count >= target;
    const pct = Math.min(c.count / target, 1);
    const circumference = 2 * Math.PI * 86;
    const dashOffset = circumference * (1 - pct);

    const area = document.createElement('div');
    area.className = 'counter-area';
    area.innerHTML = `
      <div class="counter-wrapper${isCompleted ? ' completed' : ''}">
        <svg class="counter-ring" viewBox="0 0 200 200">
          <circle class="track" cx="100" cy="100" r="86" fill="none" stroke-width="12"/>
          <circle class="progress" cx="100" cy="100" r="86" fill="none" stroke-width="12"
            stroke-dasharray="${circumference.toFixed(2)}"
            stroke-dashoffset="${dashOffset.toFixed(2)}"/>
        </svg>
        <div class="counter-center" role="button" tabindex="0" aria-label="اضغط للتسبيح">
          <div class="count-value">${fmtNum(c.count)}</div>
          <div class="count-target">
            <span class="sep">/</span><span class="target-num">${fmtNum(target)}</span>
          </div>
        </div>
        <div class="completion-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      </div>
    `;
    card.appendChild(area);
  }

  function renderReadCard(card, dhikr) {
    const completed = isCompleted(dhikr);
    const area = document.createElement('div');
    area.className = 'counter-area';
    area.innerHTML = `
      <div class="read-card" role="button" tabindex="0" aria-label="اضغط للتحديد كمنجزأ">
        <div class="read-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${completed ? '<polyline points="20 6 9 17 4 12"/>' : '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>'}
          </svg>
        </div>
        <div class="read-label">${completed ? 'تم بحمد الله' : 'اضغط للتحديد'}</div>
        <div class="read-hint">${dhikr.note || 'لا يوجد عدد محدد في السنة'}</div>
      </div>
    `;
    card.appendChild(area);
  }

  // ====== Staged counter (post-prayer 33+33+33+1) ======
  function renderStagedCounter(card, dhikr) {
    const c = getCount(dhikr.id);
    if (!c.stages || c.stages.length !== dhikr.stages.length) {
      c.stages = dhikr.stages.map(s => ({ count: 0, target: s.target }));
      state.counts[dhikr.id] = c;
    }

    const totalTarget = dhikr.stages.reduce((sum, s) => sum + s.target, 0);
    const totalDone = c.stages.reduce((sum, s) => sum + s.count, 0);
    const allCompleted = c.stages.every(s => s.count >= s.target);

    // Determine the current active stage
    let activeStage = -1;
    for (let i = 0; i < c.stages.length; i++) {
      if (c.stages[i].count < c.stages[i].target) { activeStage = i; break; }
    }

    const stagesDiv = document.createElement('div');
    stagesDiv.className = 'staged-stages';

    dhikr.stages.forEach((stage, i) => {
      const sc = c.stages[i];
      const stageCompleted = sc.count >= stage.target;
      const isActive = i === activeStage;
      const pct = Math.min(sc.count / stage.target, 1);

      const row = document.createElement('div');
      row.className = 'stage-row' + (isActive ? ' active' : '') + (stageCompleted ? ' completed' : '');
      row.innerHTML = `
        <div class="stage-num">${stageCompleted
          ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
          : (i + 1)}</div>
        <div class="stage-content">
          <div class="stage-arabic" lang="ar" dir="rtl">${escapeHtml(stage.arabic)}</div>
          <div class="stage-progress">
            <span class="stage-count">${fmtNum(sc.count)} / ${fmtNum(stage.target)}</span>
            <div class="stage-bar"><div class="stage-bar-fill" style="width: ${Math.round(pct * 100)}%"></div></div>
          </div>
        </div>
      `;
      stagesDiv.appendChild(row);
    });

    // Tap button (only enabled when there's an active stage)
    const tapBtn = document.createElement('button');
    tapBtn.className = 'staged-tap-btn';
    tapBtn.dataset.action = 'staged-tap';
    if (activeStage === -1) {
      tapBtn.disabled = true;
      tapBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>تم بحمد الله — ${fmtNum(totalDone)} تسبيحة</span>`;
    } else {
      const stage = dhikr.stages[activeStage];
      const sc = c.stages[activeStage];
      tapBtn.innerHTML = `<span>اضغط للتسبيح</span><span class="tap-count">${fmtNum(sc.count)} / ${fmtNum(stage.target)}</span>`;
    }
    stagesDiv.appendChild(tapBtn);

    // Reset button
    if (allCompleted) {
      const resetBtn = document.createElement('button');
      resetBtn.className = 'btn btn-secondary';
      resetBtn.style.marginTop = '8px';
      resetBtn.dataset.action = 'staged-reset';
      resetBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg><span>إعادة التعيين</span>`;
      stagesDiv.appendChild(resetBtn);
    }

    card.appendChild(stagesDiv);
  }

  function wireCardEvents(card, dhikr, isCustom) {
    // Favorite
    const favBtn = card.querySelector('[data-action="favorite"]');
    if (favBtn) favBtn.addEventListener('click', () => toggleFavorite(dhikr.id));

    // Detail modal
    const detailBtn = card.querySelector('[data-action="detail"]');
    if (detailBtn) detailBtn.addEventListener('click', () => openDetailModal(dhikr));

    // Counter tap (only for hasCounter, non-staged)
    const counterCenter = card.querySelector('.counter-center');
    if (counterCenter) {
      counterCenter.addEventListener('click', () => handleTap(dhikr, card));
      counterCenter.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleTap(dhikr, card); }
      });
    }

    // Read card tap (no counter)
    const readCard = card.querySelector('.read-card');
    if (readCard) {
      readCard.addEventListener('click', () => handleReadToggle(dhikr, card));
      readCard.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleReadToggle(dhikr, card); }
      });
    }

    // Staged tap button
    const stagedTapBtn = card.querySelector('[data-action="staged-tap"]');
    if (stagedTapBtn) {
      stagedTapBtn.addEventListener('click', () => handleStagedTap(dhikr, card));
    }
    const stagedResetBtn = card.querySelector('[data-action="staged-reset"]');
    if (stagedResetBtn) {
      stagedResetBtn.addEventListener('click', () => handleStagedReset(dhikr, card));
    }

    // Undo / Reset (counter cards)
    const undoBtn = card.querySelector('[data-action="undo"]');
    if (undoBtn) undoBtn.addEventListener('click', () => handleUndo(dhikr, card));
    const resetBtn = card.querySelector('[data-action="reset"]');
    if (resetBtn) resetBtn.addEventListener('click', () => handleReset(dhikr, card));

    // Toggle read
    const toggleReadBtn = card.querySelector('[data-action="toggle-read"]');
    if (toggleReadBtn) toggleReadBtn.addEventListener('click', () => handleReadToggle(dhikr, card));

    // Copy / Share single dua (display-only cards)
    const copyDuaBtn = card.querySelector('[data-action="copy-dua"]');
    if (copyDuaBtn) copyDuaBtn.addEventListener('click', () => copyDuaText(dhikr));
    const shareDuaBtn = card.querySelector('[data-action="share-dua"]');
    if (shareDuaBtn) shareDuaBtn.addEventListener('click', () => shareSingleDua(dhikr));

    // Focus mode
    const focusBtn = card.querySelector('[data-action="focus"]');
    if (focusBtn) focusBtn.addEventListener('click', () => openFocusOverlay(dhikr));

    // Custom: edit, delete, drag
    if (isCustom) {
      const editBtn = card.querySelector('[data-action="edit"]');
      const delBtn = card.querySelector('[data-action="delete"]');
      if (editBtn) editBtn.addEventListener('click', () => openCustomModal(dhikr));
      if (delBtn) delBtn.addEventListener('click', () => confirmDeleteCustom(dhikr));
      card.addEventListener('dragstart', onDragStart);
      card.addEventListener('dragover', onDragOver);
      card.addEventListener('drop', onDrop);
      card.addEventListener('dragend', onDragEnd);
      card.addEventListener('dragleave', onDragLeave);
    }
  }

  // ===================================================
  // 7b. Staged counter logic (post-prayer 33+33+33+1)
  // ===================================================
  function handleStagedTap(dhikr, card) {
    const c = getCount(dhikr.id);
    if (!c.stages || c.stages.length !== dhikr.stages.length) {
      c.stages = dhikr.stages.map(s => ({ count: 0, target: s.target }));
    }

    // Find active stage (the first not-completed stage)
    let activeIdx = -1;
    for (let i = 0; i < c.stages.length; i++) {
      if (c.stages[i].count < c.stages[i].target) { activeIdx = i; break; }
    }
    if (activeIdx === -1) return;

    const stage = dhikr.stages[activeIdx];
    const sc = c.stages[activeIdx];
    const wasCompleted = sc.count >= stage.target;
    sc.count += 1;

    playTapSound();
    vibrate(15);

    const tk = todayKey();
    state.daily[tk] = (state.daily[tk] || 0) + 1;
    updateStreak();

    const nowStageCompleted = sc.count >= stage.target;
    if (nowStageCompleted && !wasCompleted) {
      // Stage completed — vibrate longer, but only "complete" the dhikr when ALL stages are done
      vibrate([20, 30, 20]);
      const allDone = c.stages.every(s => s.count >= s.target);
      if (allDone) {
        onDhikrCompleted(dhikr, card);
      } else {
        showToast(`تمت المرحلة ${fmtNum(activeIdx + 1)} 🌿`, 'success', 1500);
      }
    }

    state.counts[dhikr.id] = c;
    saveState('counts');
    saveState('daily');
    saveState('streak');

    updateCardUI(card, dhikr);
    updateStats();
    checkBadges();
  }

  function handleStagedReset(dhikr, card) {
    const c = getCount(dhikr.id);
    c.stages = dhikr.stages.map(s => ({ count: 0, target: s.target }));
    c.completedRounds = 0;
    state.counts[dhikr.id] = c;
    saveState('counts');
    const tk = todayKey();
    if (state.completedToday[tk]) {
      state.completedToday[tk] = state.completedToday[tk].filter(id => id !== dhikr.id);
      saveState('completedToday');
    }
    updateCardUI(card, dhikr);
    updateStats();
    showToast('تم تصفير العداد', 'warning', 1500);
  }

  // ===================================================
  // 8. Update card UI after tap
  // ===================================================
  function updateCardUI(card, dhikr) {
    if (!card) return;
    const isStaged = dhikr.type === 'staged';
    const hasCounter = dhikr.target != null && !isStaged;
    const completed = isCompleted(dhikr);

    card.classList.toggle('completed', completed);

    if (isStaged) {
      // Re-render the staged section
      const oldStages = card.querySelector('.staged-stages');
      if (oldStages) oldStages.remove();
      renderStagedCounter(card, dhikr);
      // Re-wire staged events
      const stagedTapBtn = card.querySelector('[data-action="staged-tap"]');
      if (stagedTapBtn) stagedTapBtn.addEventListener('click', () => handleStagedTap(dhikr, card));
      const stagedResetBtn = card.querySelector('[data-action="staged-reset"]');
      if (stagedResetBtn) stagedResetBtn.addEventListener('click', () => handleStagedReset(dhikr, card));
      return;
    }

    if (!hasCounter) {
      // Read card — re-render
      const oldArea = card.querySelector('.counter-area');
      if (oldArea) oldArea.remove();
      renderReadCard(card, dhikr);
      const readCard = card.querySelector('.read-card');
      if (readCard) {
        readCard.addEventListener('click', () => handleReadToggle(dhikr, card));
        readCard.addEventListener('keydown', (e) => {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleReadToggle(dhikr, card); }
        });
      }
      const toggleReadBtn = card.querySelector('[data-action="toggle-read"]');
      if (toggleReadBtn) toggleReadBtn.addEventListener('click', () => handleReadToggle(dhikr, card));
      return;
    }

    // Counter card
    const c = getCount(dhikr.id);
    const target = dhikr.target;
    const pct = Math.min(c.count / target, 1);
    const circumference = 2 * Math.PI * 86;
    const dashOffset = circumference * (1 - pct);

    const wrapper = card.querySelector('.counter-wrapper');
    if (wrapper) wrapper.classList.toggle('completed', completed);

    const countEl = card.querySelector('.count-value');
    if (countEl) countEl.textContent = fmtNum(c.count);

    const progress = card.querySelector('.progress');
    if (progress) progress.setAttribute('stroke-dashoffset', dashOffset.toFixed(2));

    const barFill = card.querySelector('.dhikr-bar-fill');
    if (barFill) barFill.style.width = `${Math.round(pct * 100)}%`;

    const pctEl = card.querySelector('.pct');
    if (pctEl) pctEl.textContent = `${Math.round(pct * 100)}%`;

    const roundsEl = card.querySelector('.dhikr-progress-meta');
    if (roundsEl) {
      const roundsSpan = c.completedRounds > 0 ? `<span>·</span><span>${fmtNum(c.completedRounds)} دورة</span>` : '';
      roundsEl.innerHTML = `<span class="pct">${Math.round(pct * 100)}%</span>${roundsSpan}`;
    }
  }

  // ===================================================
  // 9. Stats + streak
  // ===================================================
  function updateStreak() {
    const today = new Date();
    const tk = dayKeyFromDate(today);
    if (state.streak.lastDay === tk) return;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yk = dayKeyFromDate(yesterday);
    if (state.streak.lastDay === yk) {
      state.streak.count = (state.streak.count || 0) + 1;
    } else if (state.streak.lastDay === null) {
      state.streak.count = 1;
    } else {
      state.streak.count = 1;
    }
    state.streak.lastDay = tk;
    state.streak.best = Math.max(state.streak.best || 0, state.streak.count || 0);
    saveState('streak');
  }

  function updateStats() {
    const tk = todayKey();
    const totalToday = state.daily[tk] || 0;
    const completedToday = (state.completedToday[tk] || []).length;
    const streak = state.streak.count || 0;

    const tEl = $('#statTotalToday'); if (tEl) tEl.textContent = fmtNum(totalToday);
    const cEl = $('#statCompleted'); if (cEl) cEl.textContent = fmtNum(completedToday);
    const sEl = $('#statStreak'); if (sEl) sEl.textContent = fmtNum(streak);

    renderStatsTab();
  }

  function renderStatsTab() {
    const totalAllTime = Object.values(state.daily).reduce((a, b) => a + b, 0);
    const lifetimeEl = $('#statLifetime'); if (lifetimeEl) lifetimeEl.textContent = fmtNum(totalAllTime);
    const bestStreakEl = $('#statBestStreak'); if (bestStreakEl) bestStreakEl.textContent = fmtNum(state.streak.best || 0);
    const freeEl = $('#statFreeTasbeeh');
    if (freeEl) freeEl.textContent = fmtNum((state.counts.free_tasbeeh && state.counts.free_tasbeeh.count) || 0);

    const today = new Date();

    // 7-day chart
    const chart = $('#weekChart');
    if (chart) {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const key = dayKeyFromDate(d);
        const weekdays = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
        days.push({ value: state.daily[key] || 0, label: weekdays[d.getDay()] });
      }
      const max = Math.max(1, ...days.map(d => d.value));
      chart.innerHTML = days.map(d => `
        <div class="week-bar-col">
          <div class="week-bar-track"><div class="week-bar-fill" style="height:${d.value > 0 ? Math.max(6, Math.round((d.value / max) * 100)) : 0}%"></div></div>
          <span class="week-bar-value">${fmtNum(d.value)}</span>
          <span class="week-bar-label">${d.label}</span>
        </div>`).join('');
    }

    // 70-day heatmap
    const heatmap = $('#heatmapGrid');
    if (heatmap) {
      const cells = [];
      for (let i = 69; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const key = dayKeyFromDate(d);
        cells.push({ v: state.daily[key] || 0, label: `${d.getDate()}/${d.getMonth() + 1}` });
      }
      const maxV = Math.max(1, ...cells.map(c => c.v));
      heatmap.innerHTML = cells.map(c => {
        let level = 0;
        if (c.v > 0) {
          const r = c.v / maxV;
          level = r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
        }
        return `<div class="heat-cell level-${level}" title="${c.label} — ${fmtNum(c.v)} تسبيحة"></div>`;
      }).join('');
    }

    // Category progress list
    const catList = $('#catProgressList');
    if (catList) {
      const tk = todayKey();
      const completedTodayList = state.completedToday[tk] || [];
      catList.innerHTML = window.ADHKAR_CATEGORIES.map(cat => {
        const items = window.ADHKAR_DATA[cat.id] || [];
        if (items.length === 0) return '';
        const completedCount = items.filter(it => completedTodayList.includes(it.id)).length;
        const pct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
        return `<div class="cat-progress-item">
          <span class="cat-progress-name">${escapeHtml(cat.name)}</span>
          <div class="cat-progress-bar-item"><div class="cat-progress-bar-fill" style="width: ${pct}%"></div></div>
          <span class="cat-progress-num">${fmtNum(completedCount)} / ${fmtNum(items.length)}</span>
        </div>`;
      }).join('');
    }
  }

  // ===================================================
  // 10. Badges
  // ===================================================
  function checkBadges() {
    const tk = todayKey();
    const completedTodayList = state.completedToday[tk] || [];
    const newUnlocks = [];

    const unlock = (id) => {
      if (!state.badges[id] && BADGES_BY_ID[id]) {
        state.badges[id] = true;
        newUnlocks.push(BADGES_BY_ID[id]);
      }
    };

    if (completedTodayList.length >= 1) unlock('first_dhikr');
    if (completedTodayList.length >= 10) unlock('ten_today');

    const s = state.streak.count || 0;
    if (s >= 3) unlock('streak_3');
    if (s >= 7) unlock('streak_7');
    if (s >= 30) unlock('streak_30');

    const totalAllTime = Object.values(state.daily).reduce((a, b) => a + b, 0);
    if (totalAllTime >= 1000) unlock('total_1000');
    if (totalAllTime >= 10000) unlock('total_10000');

    // Category completion badges
    if ((window.ADHKAR_DATA.morning || []).every(d => completedTodayList.includes(d.id))) unlock('all_morning');
    if ((window.ADHKAR_DATA.evening || []).every(d => completedTodayList.includes(d.id))) unlock('all_evening');
    if ((window.ADHKAR_DATA.sleep || []).every(d => completedTodayList.includes(d.id))) unlock('sleep_dhikr');
    if ((window.ADHKAR_DATA.waking || []).every(d => completedTodayList.includes(d.id))) unlock('wake_dhikr');
    if ((window.ADHKAR_DATA['post-prayer'] || []).every(d => completedTodayList.includes(d.id))) unlock('all_postprayer');

    // 99 names badge
    if (Object.keys(state.namesViewed).length >= 99) unlock('all_names_read');

    const freeC = state.counts.free_tasbeeh;
    if (freeC && freeC.count >= 500) unlock('free_500');

    if (newUnlocks.length) {
      saveState('badges');
      newUnlocks.forEach(b => {
        showToast(`إنجاز جديد: ${b.title} ${b.icon}`, 'success', 3200);
      });
      renderBadges();
    }
  }

  function renderBadges() {
    const row = $('#badgesRow');
    if (!row) return;
    row.innerHTML = BADGES.map(b => {
      const unlocked = !!state.badges[b.id];
      return `
        <div class="badge ${unlocked ? 'unlocked' : 'locked'}">
          <div class="badge-icon">${b.icon}</div>
          <div class="badge-title">${b.title}</div>
          <div class="badge-desc">${b.desc}</div>
        </div>`;
    }).join('');
  }

  // ===================================================
  // 11. Navigation (sidebar)
  // ===================================================
  let currentCategoryId = null;

  function setupNavigation() {
    $$('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat;
        navigateTo(cat);
        // Close mobile sidebar
        $('#sidebar').classList.remove('open');
        $('#sidebarBackdrop').classList.remove('show');
      });
    });
  }

  function navigateTo(cat) {
    // Determine if this is a top-level view (home/favorites/custom/stats/timer/calendar/search) or a category
    const topViews = ['home', 'favorites', 'custom', 'stats', 'timer', 'calendar', 'search'];
    const isTopView = topViews.includes(cat);

    $$('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    $$('.view-panel').forEach(panel => {
      let isActive = false;
      if (isTopView) {
        isActive = panel.id === `view-${cat}`;
      } else {
        // All category IDs map to the single view-category panel
        isActive = panel.id === 'view-category';
      }
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });
    if (cat === 'home') renderHomeView();
    else if (cat === 'favorites') renderFavoritesGrid();
    else if (cat === 'custom') renderCustomGrid();
    else if (cat === 'stats') renderStatsTab();
    else if (cat === 'timer') renderTimerTab();
    else if (cat === 'calendar') renderCalendarTab();
    else if (!isTopView) renderCategoryView(cat);
    // Scroll to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSidebarCategories() {
    const list = $('#catList');
    if (!list) return;
    let html = '';
    let duaHeaderAdded = false;
    window.ADHKAR_CATEGORIES.forEach(cat => {
      if (cat.group === 'dua' && !duaHeaderAdded) {
        html += `<div class="cat-section-label cat-section-label-sub">🤲 أدعية مختارة بالموضوع</div>`;
        duaHeaderAdded = true;
      }
      const items = window.ADHKAR_DATA[cat.id] || [];
      const isNames = cat.id === 'names';
      const count = isNames ? (window.ASMA_ALLAH ? window.ASMA_ALLAH.length : 0) : items.length;
      html += `<button class="cat-btn" data-cat="${cat.id}">
        <span class="cat-icon" aria-hidden="true">${getCatIcon(cat.icon)}</span>
        <span class="cat-label">${escapeHtml(cat.name)}</span>
        <span class="cat-count">${fmtNum(count)}</span>
      </button>`;
    });
    list.innerHTML = html;
    // Wire newly created buttons
    $$('#catList .cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigateTo(btn.dataset.cat);
        $('#sidebar').classList.remove('open');
        $('#sidebarBackdrop').classList.remove('show');
      });
    });
  }

  function getCatIcon(name) {
    const icons = {
      sunrise: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/></svg>',
      sunset: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="16 5 12 9 8 5"/></svg>',
      moon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
      alarm: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M5 3L2 6M22 6l-3-3M6.4 19.4L3 22M17.6 19.4L21 22M12 9v4l2 2"/></svg>',
      mosque: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-5a3 3 0 0 1 6 0v5M9 11h6"/></svg>',
      utensils: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>',
      check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      plane: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
      home: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      'door-in': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M3 12h12M11 8l4 4-4 4"/></svg>',
      'door-out': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M21 12H9M15 8l4 4-4 4"/></svg>',
      cloud: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
      heart: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
      users: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      shield: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      hands: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',
      book: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
      quran: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
      gift: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
      star: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
      clock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16.5 14.5"/></svg>',
      calendar: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><line x1="16" y1="2.5" x2="16" y2="6.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      crescent: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 1 0 11 11z"/></svg>',
    };
    return icons[name] || icons.book;
  }

  // ===================================================
  // 12. Render views
  // ===================================================
  function renderHomeView() {
    const container = $('#categoryCards');
    if (!container) return;
    const tk = todayKey();
    const completedTodayList = state.completedToday[tk] || [];

    let html = '';
    let duaHeaderAdded = false;
    window.ADHKAR_CATEGORIES.forEach(cat => {
      if (cat.group === 'dua' && !duaHeaderAdded) {
        html += `<div class="home-section-divider"><span>🤲 أدعية مختارة بالموضوع</span><small>اختيار منظم من الأدعية القرآنية والنبوية — للقراءة والمشاركة</small></div>`;
        duaHeaderAdded = true;
      }
      const items = window.ADHKAR_DATA[cat.id] || [];
      const isNames = cat.id === 'names';
      const isDuaCat = cat.group === 'dua';
      const totalCount = isNames ? (window.ASMA_ALLAH ? window.ASMA_ALLAH.length : 0) : items.length;
      const completedCount = items.filter(it => completedTodayList.includes(it.id)).length;
      const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      html += `<div class="cat-card${isDuaCat ? ' cat-card-dua' : ''}" data-cat="${cat.id}">
        <div class="cat-card-icon">${getCatIcon(cat.icon)}</div>
        <div class="cat-card-title">${escapeHtml(cat.name)}</div>
        <div class="cat-card-desc">${escapeHtml(cat.desc)}</div>
        <span class="cat-card-count">${fmtNum(totalCount)} عنصر</span>
        ${!isNames && !isDuaCat && items.length > 0 ? `<div class="cat-card-progress"><div class="cat-card-progress-fill" style="width: ${pct}%"></div></div>` : ''}
      </div>`;
    });
    container.innerHTML = html;

    // Wire click
    $$('.cat-card').forEach(card => {
      card.addEventListener('click', () => navigateTo(card.dataset.cat));
    });
  }

  function renderCategoryView(catId) {
    currentCategoryId = catId;
    const cat = window.ADHKAR_CATEGORIES.find(c => c.id === catId);
    if (!cat) return;

    $('#catViewTitle').textContent = cat.name;
    $('#catViewDesc').textContent = cat.desc;

    const grid = $('#categoryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // Special case: Names of Allah
    if (catId === 'names') {
      renderNamesGrid(grid);
      // Hide progress pill (no counter for names)
      $('#catProgressPill').hidden = true;
      return;
    }

    const items = window.ADHKAR_DATA[catId] || [];
    items.forEach(item => {
      const card = renderDhikrCard(item);
      grid.appendChild(card);
    });

    // Update progress pill
    updateCatProgressPill(catId);
  }

  // Public for staged re-render
  function renderCategoryGrid(catId) {
    renderCategoryView(catId);
  }

  function updateCatProgressPill(catId) {
    const pill = $('#catProgressPill');
    if (!pill) return;
    const cat = window.ADHKAR_CATEGORIES.find(c => c.id === catId);
    const items = window.ADHKAR_DATA[catId] || [];
    if (items.length === 0 || (cat && cat.group === 'dua')) { pill.hidden = true; return; }
    const tk = todayKey();
    const completedTodayList = state.completedToday[tk] || [];
    const completedCount = items.filter(it => completedTodayList.includes(it.id)).length;
    const pct = Math.round((completedCount / items.length) * 100);
    pill.hidden = false;
    $('#catProgressNum').textContent = `${fmtNum(completedCount)} / ${fmtNum(items.length)}`;
    $('#catProgressFill').style.width = `${pct}%`;
  }

  function renderNamesGrid(grid) {
    if (!window.ASMA_ALLAH) return;
    window.ASMA_ALLAH.forEach((entry, i) => {
      const idx = i + 1;
      const card = document.createElement('div');
      const isFav = state.favorites['name_' + idx];
      card.className = 'name-card' + (isFav ? ' is-favorite' : '');
      card.dataset.nameId = idx;
      card.innerHTML = `
        <button class="name-fav-btn ${isFav ? 'is-fav' : ''}" aria-label="إضافة للمفضلة">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <span class="name-num">${fmtNum(idx)}</span>
        <div class="name-arabic" lang="ar" dir="rtl">${escapeHtml(entry.name)}</div>
        <div class="name-meaning" lang="ar" dir="rtl">${escapeHtml(entry.meaning)}</div>
      `;
      // Mark as viewed
      state.namesViewed[idx] = true;
      // Wire favorite
      const favBtn = card.querySelector('.name-fav-btn');
      if (favBtn) {
        favBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const fid = 'name_' + idx;
          toggleFavorite(fid);
        });
      }
      grid.appendChild(card);
    });
    saveState('namesViewed');
    checkBadges();
  }

  function renderFavoritesGrid() {
    const grid = $('#favoritesGrid');
    const empty = $('#favoritesEmpty');
    if (!grid) return;

    const favIds = Object.keys(state.favorites);
    if (favIds.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    grid.innerHTML = '';
    // First: dhikr favorites (from all categories)
    const allAdhkar = window.getAllAdhkar();
    favIds.forEach(fid => {
      if (fid.startsWith('name_')) {
        // Name favorite — show as name card
        const idx = parseInt(fid.replace('name_', ''), 10);
        const entry = window.ASMA_ALLAH[idx - 1];
        if (entry) {
          const card = document.createElement('div');
          card.className = 'name-card is-favorite';
          card.innerHTML = `
            <button class="name-fav-btn is-fav" aria-label="إزالة من المفضلة">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
            <span class="name-num">${fmtNum(idx)}</span>
            <div class="name-arabic" lang="ar" dir="rtl">${escapeHtml(entry.name)}</div>
            <div class="name-meaning" lang="ar" dir="rtl">${escapeHtml(entry.meaning)}</div>
          `;
          card.querySelector('.name-fav-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(fid);
          });
          grid.appendChild(card);
        }
      } else {
        const item = allAdhkar.find(a => a.id === fid);
        if (item) {
          const card = renderDhikrCard(item, { isFavorite: true, showCategory: true });
          grid.appendChild(card);
        } else {
          // Maybe custom
          const custom = state.custom.find(c => c.id === fid);
          if (custom) {
            const card = renderDhikrCard(custom, { isCustom: true, isFavorite: true });
            grid.appendChild(card);
          }
        }
      }
    });
  }

  // ===================================================
  // 13. Search
  // ===================================================
  function setupSearch() {
    const input = $('#searchInput');
    const clearBtn = $('#searchClear');
    if (!input) return;

    let debounceTimer = null;
    input.addEventListener('input', () => {
      const val = input.value.trim();
      clearBtn.hidden = val.length === 0;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runSearch(val), 220);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.hidden = true;
      // Navigate back to home
      navigateTo('home');
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        clearBtn.hidden = true;
        navigateTo('home');
      }
    });
  }

  function runSearch(query) {
    if (!query || query.length < 2) {
      // If query cleared, go home
      const searchView = $('#view-search');
      if (!searchView.hidden) navigateTo('home');
      return;
    }

    // Switch to search view
    $$('.cat-btn').forEach(b => b.classList.remove('active'));
    $$('.view-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'view-search');
      panel.hidden = panel.id !== 'view-search';
    });

    const grid = $('#searchGrid');
    const empty = $('#searchEmpty');
    const desc = $('#searchResultDesc');
    if (!grid) return;

    const q = query.toLowerCase();
    const allAdhkar = window.getAllAdhkar();
    const results = allAdhkar.filter(item => {
      const fields = [
        item.arabic || '',
        item.transliteration || '',
        item.translation || '',
        item.source || '',
        item.label || '',
        item.grading || '',
        item.explanation || '',
        item.categoryName || '',
      ];
      return fields.some(f => f.toLowerCase().includes(q));
    });

    // Also search in 99 Names
    const nameResults = [];
    if (window.ASMA_ALLAH) {
      window.ASMA_ALLAH.forEach((entry, i) => {
        if ((entry.name || '').toLowerCase().includes(q) || (entry.meaning || '').toLowerCase().includes(q)) {
          nameResults.push({ entry, idx: i + 1 });
        }
      });
    }

    // Also search in custom
    const customResults = (state.custom || []).filter(item => {
      const fields = [item.arabic || '', item.label || ''];
      return fields.some(f => f.toLowerCase().includes(q));
    });

    if (desc) desc.textContent = `وجدنا ${fmtNum(results.length + nameResults.length + customResults.length)} نتيجة لـ «${query}»`;

    grid.innerHTML = '';

    if (results.length === 0 && nameResults.length === 0 && customResults.length === 0) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    results.forEach(item => {
      const card = renderDhikrCard(item, { showCategory: true });
      grid.appendChild(card);
    });

    customResults.forEach(item => {
      const card = renderDhikrCard(item, { isCustom: true, showCategory: true });
      grid.appendChild(card);
    });

    // Render matching names as name cards
    nameResults.forEach(({ entry, idx }) => {
      const card = document.createElement('div');
      card.className = 'name-card';
      card.innerHTML = `
        <span class="name-num">${fmtNum(idx)}</span>
        <div class="name-arabic" lang="ar" dir="rtl">${escapeHtml(entry.name)}</div>
        <div class="name-meaning" lang="ar" dir="rtl">${escapeHtml(entry.meaning)}</div>
      `;
      grid.appendChild(card);
    });
  }

  // ===================================================
  // 14. Custom dhikr management
  // ===================================================
  function renderCustomGrid() {
    const grid = $('#customGrid');
    const empty = $('#customEmpty');
    if (!grid) return;

    const sorted = [...state.custom].sort((a, b) => (a.order || 0) - (b.order || 0));

    if (sorted.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    grid.innerHTML = '';
    sorted.forEach((d, i) => {
      const card = renderDhikrCard(d, { isCustom: true, index: i });
      grid.appendChild(card);
    });
  }

  function openCustomModal(existing = null) {
    const modal = $('#customModal');
    if (!modal) return;
    const form = $('#customForm');
    form.reset();
    if (existing) {
      $('#customModalTitle').textContent = 'تعديل الذكر';
      $('#customId').value = existing.id;
      $('#customArabic').value = existing.arabic;
      $('#customLabel').value = existing.label || '';
      $('#customTarget').value = existing.target;
      $('#customContinue').checked = !!existing.continueAfter;
    } else {
      $('#customModalTitle').textContent = 'إنشاء ذكر مخصص';
      $('#customId').value = '';
      $('#customTarget').value = 33;
    }
    showModal(modal);
    setTimeout(() => $('#customArabic').focus(), 200);
  }

  function closeModal(modal) {
    modal.classList.remove('show');
    setTimeout(() => { modal.hidden = true; }, 240);
  }

  function showModal(modal) {
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('show'));
  }

  function saveCustomFromForm(e) {
    e.preventDefault();
    const id = $('#customId').value || ('c' + Date.now().toString(36));
    const arabic = $('#customArabic').value.trim();
    const label = $('#customLabel').value.trim();
    const target = Math.max(1, Math.min(100000, parseInt($('#customTarget').value, 10) || 33));
    const continueAfter = $('#customContinue').checked;

    if (!arabic) {
      showToast('الرجاء إدخال النص العربي', 'warning');
      return;
    }

    const existingIndex = state.custom.findIndex(c => c.id === id);
    if (existingIndex >= 0) {
      state.custom[existingIndex] = { ...state.custom[existingIndex], arabic, label, target, continueAfter };
      showToast('تم تحديث الذكر', 'success');
    } else {
      const maxOrder = state.custom.reduce((m, c) => Math.max(m, c.order || 0), 0);
      state.custom.push({ id, arabic, label, target, continueAfter, order: maxOrder + 1 });
      showToast('تم إضافة الذكر', 'success');
    }
    saveState('custom');
    renderCustomGrid();
    closeModal($('#customModal'));
  }

  function confirmDeleteCustom(dhikr) {
    showConfirm(`هل تريد حذف «${dhikr.label || dhikr.arabic.slice(0, 30)}»؟`, () => {
      state.custom = state.custom.filter(c => c.id !== dhikr.id);
      saveState('custom');
      delete state.counts[dhikr.id];
      saveState('counts');
      renderCustomGrid();
      showToast('تم الحذف', 'success');
    });
  }

  // Drag and drop
  let dragSourceId = null;
  function onDragStart(e) {
    if (e.currentTarget.dataset.custom !== 'true') { e.preventDefault(); return; }
    dragSourceId = e.currentTarget.dataset.dhikrId;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragSourceId); } catch (_) {}
  }
  function onDragOver(e) {
    if (e.currentTarget.dataset.custom !== 'true') return;
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }
  function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
  function onDrop(e) {
    e.preventDefault();
    const targetCard = e.currentTarget;
    targetCard.classList.remove('drag-over');
    const targetId = targetCard.dataset.dhikrId;
    if (!dragSourceId || dragSourceId === targetId) return;
    const sorted = [...state.custom].sort((a, b) => (a.order || 0) - (b.order || 0));
    const fromIdx = sorted.findIndex(c => c.id === dragSourceId);
    const toIdx = sorted.findIndex(c => c.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    sorted.forEach((c, i) => { c.order = i; });
    state.custom = sorted;
    saveState('custom');
    renderCustomGrid();
  }
  function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    $$('.dhikr-card').forEach(c => c.classList.remove('drag-over'));
    dragSourceId = null;
  }

  // ===================================================
  // 15. Detail modal (hadith info)
  // ===================================================
  function openDetailModal(dhikr) {
    const modal = $('#detailModal');
    const body = $('#detailModalBody');
    if (!modal || !body) return;

    let html = '';

    if (dhikr.arabic) {
      html += `<div class="detail-section">
        <div class="detail-label">النص العربي</div>
        <div class="detail-arabic" lang="ar" dir="rtl">${escapeHtml(dhikr.arabic)}</div>
      </div>`;
    }

    if (dhikr.transliteration) {
      html += `<div class="detail-section">
        <div class="detail-label">النقل الحرفي (Transliteration)</div>
        <div class="detail-transliteration">${escapeHtml(dhikr.transliteration)}</div>
      </div>`;
    }

    if (dhikr.translation) {
      html += `<div class="detail-section">
        <div class="detail-label">الترجمة / المعنى</div>
        <div class="detail-translation">${escapeHtml(dhikr.translation)}</div>
      </div>`;
    }

    if (dhikr.source || dhikr.grading) {
      html += `<div class="detail-section">
        <div class="detail-label">المصدر والتخريج</div>
        <div class="detail-meta-row">`;
      if (dhikr.grading) {
        html += `<span class="grading-badge ${gradingClass(dhikr.grading)}">${escapeHtml(dhikr.grading)}</span>`;
      }
      html += `</div>`;
      if (dhikr.source) {
        html += `<div class="detail-source" style="margin-top: 8px;">${escapeHtml(dhikr.source)}</div>`;
      }
      html += `</div>`;
    }

    if (dhikr.explanation) {
      html += `<div class="detail-section">
        <div class="detail-label">شرح وفائدة</div>
        <div class="detail-explanation">${escapeHtml(dhikr.explanation)}</div>
      </div>`;
    }

    if (dhikr.note) {
      html += `<div class="detail-section">
        <div class="detail-note">📌 ${escapeHtml(dhikr.note)}</div>
      </div>`;
    }

    // For staged: show stages
    if (dhikr.type === 'staged' && dhikr.stages) {
      html += `<div class="detail-section">
        <div class="detail-label">المراحل</div>`;
      dhikr.stages.forEach((stage, i) => {
        html += `<div style="margin-bottom: 12px;">
          <div class="detail-arabic" style="font-size: 1.1rem; min-height: auto; padding: 6px 0;" lang="ar" dir="rtl">${escapeHtml(stage.arabic)}</div>
          <div style="text-align: center; font-size: 0.82rem; color: var(--text-muted);">${stage.transliteration ? escapeHtml(stage.transliteration) + ' · ' : ''}تُقال ${fmtNum(stage.target)} مرة</div>
        </div>`;
      });
      html += `</div>`;
    }

    if (!html) {
      html = '<p style="text-align:center; color: var(--text-muted);">لا توجد تفاصيل إضافية.</p>';
    }

    body.innerHTML = html;
    showModal(modal);
  }

  // ===================================================
  // 16. Settings drawer
  // ===================================================
  function setupSettingsDrawer() {
    const drawer = $('#settingsDrawer');
    const overlay = $('#drawerOverlay');
    const openBtn = $('#settingsBtn');
    const closeBtn = $('#closeDrawer');

    const open = () => {
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add('show'));
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
    };
    const close = () => {
      overlay.classList.remove('show');
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      setTimeout(() => { overlay.hidden = true; }, 240);
    };

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);

    const setupToggle = (id, key, onChange) => {
      const el = $(id);
      if (!el) return;
      el.setAttribute('aria-checked', state.settings[key] ? 'true' : 'false');
      el.addEventListener('click', () => {
        state.settings[key] = !state.settings[key];
        el.setAttribute('aria-checked', state.settings[key] ? 'true' : 'false');
        saveState('settings');
        if (onChange) onChange(state.settings[key]);
      });
    };

    setupToggle('#settingTheme', 'theme', (val) => applyTheme(val));
    setupToggle('#settingSound', 'sound', (val) => { if (val) playTapSound(); });
    setupToggle('#settingCompletion', 'completionSound', (val) => { if (val) playCompletionSound(); });
    setupToggle('#settingVibration', 'vibration', (val) => { if (val) vibrate(30); });

    $('#exportBtn').addEventListener('click', exportData);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', importData);

    $('#resetCountsBtn').addEventListener('click', () => {
      showConfirm('سيتم تصفير جميع العدّادات (مع الاحتفاظ بالأذكار المخصصة). هل أنت متأكد؟', () => {
        state.counts = {};
        state.completedToday = {};
        saveState('counts');
        saveState('completedToday');
        renderAll();
        updateStats();
        showToast('تم تصفير العدّادات', 'success');
      });
    });

    $('#clearDataBtn').addEventListener('click', () => {
      showConfirm('سيتم مسح جميع البيانات نهائيًا (الأذكار المخصصة، العدّادات، الإحصائيات، الإنجازات، المفضلة، وجلسات المؤقت). لا يمكن التراجع. هل أنت متأكد؟', () => {
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        state = {
          counts: {},
          custom: [],
          daily: {},
          streak: { count: 0, lastDay: null, best: 0 },
          settings: { ...DEFAULT_SETTINGS },
          completedToday: {},
          badges: {},
          completedEver: {},
          reminders: { lastMorning: null, lastEvening: null },
          favorites: {},
          namesViewed: {},
          timerSessions: [],
        };
        resetTimerHard();
        applyTheme(state.settings.theme);
        renderAll();
        updateStats();
        renderBadges();
        updateFavCount();
        close();
        showToast('تم مسح جميع البيانات', 'success');
      });
    });
  }

  // ===================================================
  // 16b. Sharing — site share modal (QR + social links) and per-dua share
  // ===================================================
  function getShareUrl() {
    try {
      return window.location.origin + window.location.pathname;
    } catch (_) {
      return window.location.href;
    }
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  function copyDuaText(dhikr) {
    let text = dhikr.arabic;
    if (dhikr.source) text += `\n\n— ${dhikr.source}`;
    text += `\n\nرفيق الذكر: ${getShareUrl()}`;
    copyTextToClipboard(text)
      .then(() => showToast('تم نسخ الدعاء', 'success', 1600))
      .catch(() => showToast('تعذر نسخ النص', 'warning', 1600));
  }

  function shareSingleDua(dhikr) {
    let text = dhikr.arabic;
    if (dhikr.source) text += `\n— ${dhikr.source}`;
    const url = getShareUrl();
    if (navigator.share) {
      navigator.share({ title: 'رفيق الذكر', text, url }).catch(() => {});
    } else {
      copyTextToClipboard(`${text}\n\n${url}`)
        .then(() => showToast('تم نسخ الدعاء، يمكنك لصقه ومشاركته الآن', 'success', 2200))
        .catch(() => showToast('تعذر نسخ النص', 'warning', 1600));
    }
  }

  let _qrGenerated = false;
  function renderShareQrCode() {
    const box = $('#shareQrCode');
    if (!box || _qrGenerated || typeof window.qrcode !== 'function') return;
    try {
      const url = getShareUrl();
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2 });
      _qrGenerated = true;
    } catch (err) {
      box.innerHTML = '<p style="font-size:.75rem;color:var(--text-muted);text-align:center;">تعذر إنشاء رمز QR</p>';
    }
  }

  function setupShareModal() {
    const modal = $('#shareModal');
    const openBtn = $('#shareBtn');
    if (!modal || !openBtn) return;

    const url = getShareUrl();
    const urlInput = $('#shareUrlInput');
    if (urlInput) urlInput.value = url;

    // Social links — built dynamically so they always reflect the real deployed URL
    const text = encodeURIComponent('رفيق الذكر — منصة أذكار وأدعية سنية شاملة بمصادر موثوقة 🤲');
    const encodedUrl = encodeURIComponent(url);
    const socialLinks = {
      shareWhatsapp: `https://wa.me/?text=${text}%20${encodedUrl}`,
      shareTelegram: `https://t.me/share/url?url=${encodedUrl}&text=${text}`,
      shareTwitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${text}`,
      shareFacebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      shareEmail: `mailto:?subject=${encodeURIComponent('رفيق الذكر')}&body=${text}%20${encodedUrl}`,
    };
    Object.keys(socialLinks).forEach((id) => {
      const el = $('#' + id);
      if (el) el.setAttribute('href', socialLinks[id]);
    });

    openBtn.addEventListener('click', () => {
      showModal(modal);
      renderShareQrCode();
    });

    const closeBtn = $('#closeShareModal');
    if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });

    const copyLinkBtn = $('#copyShareLinkBtn');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        copyTextToClipboard(url)
          .then(() => showToast('تم نسخ رابط الموقع', 'success', 1600))
          .catch(() => showToast('تعذر نسخ الرابط', 'warning', 1600));
      });
    }

    const nativeShareBtn = $('#nativeShareBtn');
    if (nativeShareBtn) {
      if (navigator.share) {
        nativeShareBtn.hidden = false;
        nativeShareBtn.addEventListener('click', () => {
          navigator.share({ title: 'رفيق الذكر', text: 'منصة أذكار وأدعية سنية شاملة بمصادر موثوقة', url }).catch(() => {});
        });
      } else {
        nativeShareBtn.hidden = true;
      }
    }
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0a1410' : '#0b7a5f';
    const settingToggle = $('#settingTheme');
    if (settingToggle) settingToggle.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
  }

  function setupThemeToggle() {
    $('#themeToggle').addEventListener('click', () => {
      state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
      saveState('settings');
      applyTheme(state.settings.theme);
    });
  }

  // ===================================================
  // 17. Font scale
  // ===================================================
  function applyFontScale(scale) {
    const map = { small: 0.85, medium: 1, large: 1.2 };
    document.documentElement.style.setProperty('--font-scale', map[scale] || 1);
  }

  function setupFontScale() {
    const buttons = $$('.font-size-btn');
    if (!buttons.length) return;
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.scale === state.settings.fontScale);
      btn.addEventListener('click', () => {
        state.settings.fontScale = btn.dataset.scale;
        saveState('settings');
        applyFontScale(state.settings.fontScale);
        buttons.forEach(b => b.classList.toggle('active', b === btn));
      });
    });
  }

  // ===================================================
  // 18. Reminders
  // ===================================================
  function fireReminder(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body, icon: './icon-192.png' }); return; } catch (e) {}
    }
    showToast(`${title} — ${body}`, 'success', 5000);
  }

  function checkReminders() {
    if (!state.settings.remindersEnabled) return;
    const now = new Date();
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const tk = todayKey();
    if (nowStr === state.settings.remindersMorning && state.reminders.lastMorning !== tk) {
      fireReminder('حان وقت أذكار الصباح 🌅', 'ابدأ يومك بذكر الله — أذكار الصباح في انتظارك');
      state.reminders.lastMorning = tk;
      saveState('reminders');
    }
    if (nowStr === state.settings.remindersEvening && state.reminders.lastEvening !== tk) {
      fireReminder('حان وقت أذكار المساء 🌙', 'اختم نهارك بذكر الله — أذكار المساء في انتظارك');
      state.reminders.lastEvening = tk;
      saveState('reminders');
    }
  }

  function setupReminders() {
    const toggle = $('#settingReminders');
    const morningInput = $('#remindMorningTime');
    const eveningInput = $('#remindEveningTime');
    if (morningInput) morningInput.value = state.settings.remindersMorning;
    if (eveningInput) eveningInput.value = state.settings.remindersEvening;

    if (toggle) {
      toggle.setAttribute('aria-checked', state.settings.remindersEnabled ? 'true' : 'false');
      toggle.addEventListener('click', () => {
        state.settings.remindersEnabled = !state.settings.remindersEnabled;
        toggle.setAttribute('aria-checked', state.settings.remindersEnabled ? 'true' : 'false');
        saveState('settings');
        if (state.settings.remindersEnabled && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
        showToast(state.settings.remindersEnabled ? 'تم تفعيل تذكير الأذكار' : 'تم إيقاف تذكير الأذكار', 'success', 1800);
      });
    }
    if (morningInput) morningInput.addEventListener('change', (e) => {
      state.settings.remindersMorning = e.target.value; saveState('settings');
    });
    if (eveningInput) eveningInput.addEventListener('change', (e) => {
      state.settings.remindersEvening = e.target.value; saveState('settings');
    });

    checkReminders();
    setInterval(checkReminders, 30000);
  }

  // ===================================================
  // 19. Export / Import
  // ===================================================
  function exportData() {
    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      custom: state.custom,
      settings: state.settings,
      badges: state.badges,
      streak: state.streak,
      completedEver: state.completedEver,
      daily: state.daily,
      counts: state.counts,
      favorites: state.favorites,
      completedToday: state.completedToday,
      timerSessions: state.timerSessions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dhikr-backup-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('تم تصدير البيانات', 'success');
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data || typeof data !== 'object') throw new Error('Invalid file');
        if (Array.isArray(data.custom)) { state.custom = data.custom; saveState('custom'); }
        if (data.settings) {
          state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
          saveState('settings');
          applyTheme(state.settings.theme);
          applyFontScale(state.settings.fontScale);
        }
        if (data.badges) { state.badges = data.badges; saveState('badges'); }
        if (data.streak) { state.streak = { count: 0, lastDay: null, best: 0, ...data.streak }; saveState('streak'); }
        if (data.completedEver) { state.completedEver = data.completedEver; saveState('completedEver'); }
        if (data.daily) { state.daily = data.daily; saveState('daily'); }
        if (data.counts) { state.counts = data.counts; saveState('counts'); }
        if (data.favorites) { state.favorites = data.favorites; saveState('favorites'); }
        if (data.completedToday) { state.completedToday = data.completedToday; saveState('completedToday'); }
        if (Array.isArray(data.timerSessions)) { state.timerSessions = data.timerSessions; saveState('timerSessions'); }
        renderAll();
        renderBadges();
        updateStats();
        updateFavCount();
        showToast('تم استيراد البيانات بنجاح', 'success');
      } catch (err) {
        showToast('فشل استيراد الملف: ' + err.message, 'danger', 3500);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ===================================================
  // 20. Confirmation modal
  // ===================================================
  let confirmCallback = null;
  function showConfirm(message, onConfirm) {
    const modal = $('#confirmModal');
    $('#confirmMessage').textContent = message;
    confirmCallback = onConfirm;
    showModal(modal);
  }
  function setupConfirmModal() {
    const modal = $('#confirmModal');
    $('#confirmCancel').addEventListener('click', () => closeModal(modal));
    $('#confirmOk').addEventListener('click', () => {
      closeModal(modal);
      if (confirmCallback) { confirmCallback(); confirmCallback = null; }
    });
  }

  // ===================================================
  // 21. Custom modal setup
  // ===================================================
  function setupCustomModal() {
    const modal = $('#customModal');
    $('#addCustomBtn').addEventListener('click', () => openCustomModal());
    $('#closeCustomModal').addEventListener('click', () => closeModal(modal));
    $('#cancelCustomBtn').addEventListener('click', () => closeModal(modal));
    $('#customForm').addEventListener('submit', saveCustomFromForm);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  }

  // Detail modal close
  function setupDetailModal() {
    const modal = $('#detailModal');
    $('#closeDetailModal').addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  }

  // ===================================================
  // 22. Focus overlay
  // ===================================================
  function openFocusOverlay(dhikr) {
    const overlay = $('#focusOverlay');
    if (!overlay) return;
    const isFree = dhikr.id === 'free_tasbeeh';
    const c = getCount(dhikr.id);
    const target = dhikr.target;
    const isInfinite = !isFinite(target);
    const pct = isInfinite ? 0 : Math.min(c.count / target, 1);
    const circumference = 2 * Math.PI * 86;
    const dashOffset = circumference * (1 - pct);
    const isCompleted = !isInfinite && c.count >= target;

    overlay.dataset.dhikrId = dhikr.id;
    overlay.innerHTML = `
      <button class="focus-close" id="focusCloseBtn" aria-label="إغلاق وضع التركيز">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      ${dhikr.label ? `<span class="dhikr-label focus-tag" lang="ar">${escapeHtml(dhikr.label)}</span>` : ''}
      ${dhikr.arabic ? `<div class="dhikr-arabic focus-arabic" lang="ar" dir="rtl">${escapeHtml(dhikr.arabic)}</div>` : `<div class="dhikr-arabic focus-arabic" lang="ar" dir="rtl">سُبْحَانَ اللَّهِ وَبِحَمْدِهِ</div>`}
      <div class="counter-area">
        <div class="counter-wrapper focus-wrapper${isCompleted ? ' completed' : ''}">
          <svg class="counter-ring" viewBox="0 0 200 200" ${isInfinite ? 'style="opacity:0"' : ''}>
            <circle class="track" cx="100" cy="100" r="86" fill="none" stroke-width="12"/>
            <circle class="progress" cx="100" cy="100" r="86" fill="none" stroke-width="12"
              stroke-dasharray="${circumference.toFixed(2)}"
              stroke-dashoffset="${dashOffset.toFixed(2)}"/>
          </svg>
          <div class="counter-center focus-tap" role="button" tabindex="0" aria-label="اضغط للتسبيح">
            <div class="count-value">${fmtNum(c.count)}</div>
            <div class="count-target">
              ${isInfinite
                ? `<span class="lap-label">دورة <span class="lap-count">${fmtNum(Math.floor(c.count / 33))}</span></span>`
                : `<span class="sep">/</span><span class="target-num">${fmtNum(target)}</span>`}
            </div>
          </div>
          <div class="completion-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div class="celebration-burst" aria-hidden="true"></div>
        </div>
      </div>
      <div class="focus-actions">
        <button class="btn btn-secondary" data-action="undo">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          <span>تراجع</span>
        </button>
        <button class="btn btn-danger-outline" data-action="reset">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          <span>تصفير</span>
        </button>
      </div>
      <p class="focus-hint">اضغط داخل الدائرة للتسبيح، أو استخدم مفتاح المسافة</p>
    `;

    const tapEl = overlay.querySelector('.focus-tap');
    tapEl.addEventListener('click', () => onOverlayTap(dhikr));
    tapEl.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onOverlayTap(dhikr); }
    });
    overlay.querySelector('[data-action="undo"]').addEventListener('click', () => {
      handleUndo(dhikr, overlay);
      if (isFree) updateFreeLap(overlay);
    });
    overlay.querySelector('[data-action="reset"]').addEventListener('click', () => {
      showConfirm('سيتم تصفير هذا العداد. هل أنت متأكد؟', () => {
        handleReset(dhikr, overlay);
        if (isFree) updateFreeLap(overlay);
      });
    });
    $('#focusCloseBtn').addEventListener('click', closeFocusOverlay);

    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('show'));
    document.body.style.overflow = 'hidden';
    setTimeout(() => tapEl.focus(), 200);
  }

  function onOverlayTap(dhikr) {
    const overlay = $('#focusOverlay');
    if (!overlay) return;
    handleTap(dhikr, overlay);
    if (dhikr.id === 'free_tasbeeh') {
      const c = getCount(dhikr.id);
      updateFreeLap(overlay);
      if (c.count > 0 && c.count % 33 === 0) {
        playCompletionSound();
        vibrate([20, 30, 20]);
        triggerCelebration(overlay);
        showToast(`دورة جديدة: ${fmtNum(Math.floor(c.count / 33))} 🌿`, 'success', 1800);
      }
    }
  }

  function updateFreeLap(overlay) {
    const c = getCount('free_tasbeeh');
    const lapEl = overlay.querySelector('.lap-count');
    if (lapEl) lapEl.textContent = fmtNum(Math.floor(c.count / 33));
    const countEl = overlay.querySelector('.count-value');
    if (countEl) countEl.textContent = fmtNum(c.count);
  }

  function closeFocusOverlay() {
    const overlay = $('#focusOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.hidden = true; overlay.innerHTML = ''; }, 240);
    renderAll();
    updateStats();
  }

  // ===================================================
  // 23. Hijri calendar — conversion utilities + calendar view
  // ===================================================

  // Calibrated tabular (civil) Hijri↔Gregorian conversion, verified against
  // the globally-announced start of 1448 AH (1 Muharram 1448 = 16 Jun 2026).
  // Like every purely-calculated Hijri calendar, this can differ by a day
  // from a given country's moon-sighting announcement — hence the small
  // ± adjustment control offered below.
  const HIJRI_EPOCH = 1948439;
  const HIJRI_MONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  const GREGORIAN_MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const WEEKDAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  function gregorianToJDN(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const y2 = y + 4800 - a;
    const m2 = m + 12 * a - 3;
    return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
  }

  function jdnToGregorian(jdn) {
    const a = jdn + 32044;
    const b = Math.floor((4 * a + 3) / 146097);
    const c = a - Math.floor((146097 * b) / 4);
    const d2 = Math.floor((4 * c + 3) / 1461);
    const e = c - Math.floor((1461 * d2) / 4);
    const m2 = Math.floor((5 * e + 2) / 153);
    const day = e - Math.floor((153 * m2 + 2) / 5) + 1;
    const month = m2 + 3 - 12 * Math.floor(m2 / 10);
    const year = 100 * b + d2 - 4800 + Math.floor(m2 / 10);
    return { year, month, day };
  }

  function jdnToHijri(jdn) {
    let l = jdn - HIJRI_EPOCH + 10632;
    const n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    const j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) + (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
    l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) - (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
    const month = Math.floor((24 * l) / 709);
    const day = l - Math.floor((709 * month) / 24);
    const year = 30 * n + j - 30;
    return { year, month, day };
  }

  function hijriToJDN(year, month, day) {
    return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + HIJRI_EPOCH - 1;
  }

  function hijriAdjustment() {
    return state.settings.hijriAdjustment || 0;
  }

  function gregorianToHijri(date) {
    const jdn = gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return jdnToHijri(jdn + hijriAdjustment());
  }

  function hijriToGregorianDate(year, month, day) {
    const jdn = hijriToJDN(year, month, day) - hijriAdjustment();
    const g = jdnToGregorian(jdn);
    return new Date(g.year, g.month - 1, g.day);
  }

  function getHijriMonthLength(year, month) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return hijriToJDN(nextYear, nextMonth, 1) - hijriToJDN(year, month, 1);
  }

  // Significant, broadly-agreed-upon Hijri dates (no disputed observances)
  function getIslamicEvent(y, m, d) {
    if (m === 1 && d === 1) return `رأس السنة الهجرية ${y}هـ`;
    if (m === 1 && d === 10) return 'يوم عاشوراء';
    if (m === 9 && d === 1) return 'بداية شهر رمضان المبارك';
    if (m === 10 && d === 1) return 'عيد الفطر المبارك';
    if (m === 12 && d === 9) return 'يوم عرفة';
    if (m === 12 && d === 10) return 'عيد الأضحى المبارك';
    return null;
  }

  function updateHeaderDate() {
    const el = $('#brandDate');
    if (!el) return;
    const today = new Date();
    const h = gregorianToHijri(today);
    el.textContent = `${WEEKDAYS_AR[today.getDay()]} · ${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year}هـ`;
  }

  let calMode = 'gregorian'; // 'gregorian' | 'hijri'
  let calAnchor = new Date(); // any date within the month currently displayed

  function calPrevMonth() {
    if (calMode === 'gregorian') {
      calAnchor = new Date(calAnchor.getFullYear(), calAnchor.getMonth() - 1, 1);
    } else {
      const h = gregorianToHijri(calAnchor);
      let hy = h.year, hm = h.month - 1;
      if (hm < 1) { hm = 12; hy -= 1; }
      calAnchor = hijriToGregorianDate(hy, hm, 1);
    }
    renderCalendarGrid();
  }

  function calNextMonth() {
    if (calMode === 'gregorian') {
      calAnchor = new Date(calAnchor.getFullYear(), calAnchor.getMonth() + 1, 1);
    } else {
      const h = gregorianToHijri(calAnchor);
      let hy = h.year, hm = h.month + 1;
      if (hm > 12) { hm = 1; hy += 1; }
      calAnchor = hijriToGregorianDate(hy, hm, 1);
    }
    renderCalendarGrid();
  }

  function renderTodayDateCard() {
    const today = new Date();
    const h = gregorianToHijri(today);
    const weekdayEl = $('#calTodayWeekday');
    const hijriEl = $('#calTodayHijri');
    const gregEl = $('#calTodayGregorian');
    const eventEl = $('#calTodayEvent');
    if (weekdayEl) weekdayEl.textContent = WEEKDAYS_AR[today.getDay()];
    if (hijriEl) hijriEl.textContent = `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year}هـ`;
    if (gregEl) gregEl.textContent = `${today.getDate()} ${GREGORIAN_MONTHS_AR[today.getMonth()]} ${today.getFullYear()}م`;
    const event = getIslamicEvent(h.year, h.month, h.day);
    if (eventEl) {
      eventEl.textContent = event ? `✦ ${event}` : '';
      eventEl.hidden = !event;
    }
  }

  function renderCalendarGrid() {
    const grid = $('#calGrid');
    const label = $('#calMonthLabel');
    if (!grid || !label) return;
    const today = new Date();
    const todayKeyStr = dayKeyFromDate(today);
    let cellsHtml = '';

    if (calMode === 'gregorian') {
      const year = calAnchor.getFullYear();
      const month = calAnchor.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const startWeekday = new Date(year, month, 1).getDay();
      for (let i = 0; i < startWeekday; i++) cellsHtml += '<div class="cal-cell empty"></div>';
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const h = gregorianToHijri(date);
        const isToday = dayKeyFromDate(date) === todayKeyStr;
        const weekday = date.getDay();
        const isWeekend = weekday === 5 || weekday === 6;
        const event = getIslamicEvent(h.year, h.month, h.day);
        const subLabel = h.day === 1 ? `${HIJRI_MONTHS[h.month - 1]}` : h.day;
        cellsHtml += `<div class="cal-cell${isToday ? ' is-today' : ''}${isWeekend ? ' is-weekend' : ''}${event ? ' has-event' : ''}"${event ? ` title="${escapeHtml(event)}"` : ''}>
          <span class="cal-day-main">${d}</span>
          <span class="cal-day-sub">${subLabel}</span>
        </div>`;
      }
      label.textContent = `${GREGORIAN_MONTHS_AR[month]} ${year}`;
    } else {
      const h0 = gregorianToHijri(calAnchor);
      const hYear = h0.year, hMonth = h0.month;
      const monthLen = getHijriMonthLength(hYear, hMonth);
      const firstGreg = hijriToGregorianDate(hYear, hMonth, 1);
      const startWeekday = firstGreg.getDay();
      for (let i = 0; i < startWeekday; i++) cellsHtml += '<div class="cal-cell empty"></div>';
      for (let d = 1; d <= monthLen; d++) {
        const gDate = new Date(firstGreg.getFullYear(), firstGreg.getMonth(), firstGreg.getDate() + (d - 1));
        const isToday = dayKeyFromDate(gDate) === todayKeyStr;
        const weekday = gDate.getDay();
        const isWeekend = weekday === 5 || weekday === 6;
        const event = getIslamicEvent(hYear, hMonth, d);
        cellsHtml += `<div class="cal-cell${isToday ? ' is-today' : ''}${isWeekend ? ' is-weekend' : ''}${event ? ' has-event' : ''}"${event ? ` title="${escapeHtml(event)}"` : ''}>
          <span class="cal-day-main">${d}</span>
          <span class="cal-day-sub">${gDate.getDate()}/${gDate.getMonth() + 1}</span>
        </div>`;
      }
      label.textContent = `${HIJRI_MONTHS[hMonth - 1]} ${hYear}هـ`;
    }
    grid.innerHTML = cellsHtml;
  }

  function renderCalendarTab() {
    renderTodayDateCard();
    renderCalendarGrid();
    const adjEl = $('#calAdjustValue');
    if (adjEl) {
      const adj = hijriAdjustment();
      adjEl.textContent = (adj > 0 ? '+' : '') + adj;
    }
  }

  function setupCalendarTab() {
    const prevBtn = $('#calPrevBtn');
    const nextBtn = $('#calNextBtn');
    const todayBtn = $('#calTodayBtn');
    if (prevBtn) prevBtn.addEventListener('click', calPrevMonth);
    if (nextBtn) nextBtn.addEventListener('click', calNextMonth);
    if (todayBtn) todayBtn.addEventListener('click', () => { calAnchor = new Date(); renderCalendarGrid(); });

    $$('.cal-mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.calmode;
        if (mode === calMode) return;
        calMode = mode;
        $$('.cal-mode-tab').forEach(t => t.classList.toggle('active', t === tab));
        renderCalendarGrid();
      });
    });

    $$('#calAdjustGroup [data-adj]').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.adj);
        const next = Math.max(-3, Math.min(3, hijriAdjustment() + delta));
        state.settings.hijriAdjustment = next;
        saveState('settings');
        renderCalendarTab();
        updateHeaderDate();
        showToast('تم ضبط التاريخ الهجري', 'success', 1500);
      });
    });

    const brandDateBtn = $('#brandDate');
    if (brandDateBtn) brandDateBtn.addEventListener('click', () => navigateTo('calendar'));
  }

  // ===================================================
  // 24. Productivity timer (Quran reading / study / focus)
  // ===================================================
  const TIMER_ACTIVITIES = [
    { id: 'quran', label: 'تلاوة القرآن', icon: 'quran' },
    { id: 'memorize', label: 'حفظ ومراجعة', icon: 'book' },
    { id: 'study', label: 'دراسة ومذاكرة', icon: 'star' },
    { id: 'focus', label: 'تركيز وذكر', icon: 'heart' },
  ];
  const TIMER_DURATIONS = [5, 10, 15, 20, 25, 30, 45, 60];
  const TIMER_RING_CIRC = 2 * Math.PI * 86; // r=86 in the SVG ring markup

  let timerState = {
    mode: 'countdown',       // 'countdown' | 'stopwatch'
    activityId: 'quran',
    durationMin: 15,
    status: 'idle',          // idle | running | paused
    elapsedMs: 0,
    startTs: null,
    intervalId: null,
  };

  function timerActivity() {
    return TIMER_ACTIVITIES.find(a => a.id === timerState.activityId) || TIMER_ACTIVITIES[0];
  }

  function formatClock(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  function currentTimerElapsedMs() {
    if (timerState.status === 'running' && timerState.startTs) {
      return timerState.elapsedMs + (Date.now() - timerState.startTs);
    }
    return timerState.elapsedMs;
  }

  function updateTimerDisplay() {
    const timeEl = $('#timerTimeDisplay');
    if (!timeEl) return;
    const ring = $('#timerProgressRing');
    const ringWrap = $('#timerRingWrap');
    const card = $('#timerCard');
    const startBtn = $('#timerStartBtn');
    const finishBtn = $('#timerFinishBtn');
    const resetBtn = $('#timerResetBtn');

    const elapsed = currentTimerElapsedMs();
    if (timerState.mode === 'countdown') {
      const targetMs = timerState.durationMin * 60000;
      const remainMs = Math.max(0, targetMs - elapsed);
      timeEl.textContent = formatClock(remainMs / 1000);
      const pct = targetMs > 0 ? Math.min(1, elapsed / targetMs) : 0;
      if (ring) ring.style.strokeDashoffset = String(TIMER_RING_CIRC * pct);
      if (ringWrap) ringWrap.classList.remove('is-stopwatch');
      if (elapsed >= targetMs && timerState.status === 'running') {
        finishTimerSession(true);
        return;
      }
    } else {
      timeEl.textContent = formatClock(elapsed / 1000);
      if (ringWrap) ringWrap.classList.add('is-stopwatch');
    }

    if (card) card.classList.toggle('is-running', timerState.status === 'running');
    if (startBtn) startBtn.textContent = timerState.status === 'running' ? 'إيقاف مؤقت' : (timerState.status === 'paused' ? 'استمرار' : 'ابدأ');
    if (finishBtn) finishBtn.hidden = timerState.status === 'idle' && elapsed === 0;
    if (resetBtn) resetBtn.hidden = timerState.status === 'idle' && elapsed === 0;
  }

  function startOrPauseTimer() {
    if (timerState.status === 'running') {
      timerState.elapsedMs += Date.now() - timerState.startTs;
      timerState.startTs = null;
      timerState.status = 'paused';
      clearInterval(timerState.intervalId);
      timerState.intervalId = null;
    } else {
      timerState.startTs = Date.now();
      timerState.status = 'running';
      timerState.intervalId = setInterval(updateTimerDisplay, 250);
    }
    updateTimerDisplay();
  }

  function resetTimer() {
    if (timerState.intervalId) clearInterval(timerState.intervalId);
    timerState.status = 'idle';
    timerState.elapsedMs = 0;
    timerState.startTs = null;
    timerState.intervalId = null;
    updateTimerDisplay();
  }

  // Hard reset used when the user clears all app data
  function resetTimerHard() {
    if (timerState.intervalId) clearInterval(timerState.intervalId);
    timerState = { mode: 'countdown', activityId: 'quran', durationMin: 15, status: 'idle', elapsedMs: 0, startTs: null, intervalId: null };
  }

  function logTimerSession(minutes) {
    if (minutes < 1) return; // ignore tiny/accidental sessions
    const entry = {
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      activity: timerState.activityId,
      minutes,
      date: todayKey(),
      ts: Date.now(),
    };
    state.timerSessions.unshift(entry);
    if (state.timerSessions.length > 300) state.timerSessions.length = 300;
    saveState('timerSessions');
  }

  function finishTimerSession(autoCompleted) {
    const elapsedMs = currentTimerElapsedMs();
    if (timerState.intervalId) clearInterval(timerState.intervalId);
    timerState.intervalId = null;
    const minutes = Math.round(elapsedMs / 60000);
    logTimerSession(minutes);

    const label = timerActivity().label;
    if (autoCompleted) {
      playCompletionSound();
      vibrate([0, 40, 60, 40]);
      if (document.visibilityState !== 'visible') {
        fireReminder('انتهت جلستك 🎉', `أتممت ${minutes} دقيقة من ${label}`);
      } else {
        showToast(`🎉 أتممت جلسة ${label} لمدة ${minutes} دقيقة`, 'success', 3200);
      }
    } else if (minutes >= 1) {
      showToast(`تم تسجيل ${minutes} دقيقة من ${label}`, 'success', 2400);
    }

    timerState.status = 'idle';
    timerState.elapsedMs = 0;
    timerState.startTs = null;
    updateTimerDisplay();
    renderTimerStats();
    renderTimerSessions();
  }

  function renderTimerActivities() {
    const wrap = $('#timerActivities');
    if (!wrap) return;
    wrap.innerHTML = TIMER_ACTIVITIES.map(a => `
      <button type="button" class="timer-activity-chip${a.id === timerState.activityId ? ' active' : ''}" data-activity="${a.id}">
        <span aria-hidden="true">${getCatIcon(a.icon)}</span><span>${escapeHtml(a.label)}</span>
      </button>`).join('');
    $$('#timerActivities .timer-activity-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        if (timerState.status === 'running') return; // don't swap activity mid-session
        timerState.activityId = btn.dataset.activity;
        $$('#timerActivities .timer-activity-chip').forEach(b => b.classList.toggle('active', b === btn));
        const labelEl = $('#timerActivityLabel');
        if (labelEl) labelEl.textContent = timerActivity().label;
      });
    });
  }

  function renderTimerDurations() {
    const wrap = $('#timerDurations');
    if (!wrap) return;
    const chips = TIMER_DURATIONS.map(min => `<button type="button" class="duration-chip${min === timerState.durationMin ? ' active' : ''}" data-duration="${min}">${min}</button>`).join('');
    wrap.innerHTML = `${chips}<span class="duration-custom-wrap"><input type="number" min="1" max="180" class="duration-custom-input" id="durationCustomInput" placeholder="مخصص" aria-label="مدة مخصصة بالدقائق"> دقيقة</span>`;
    $$('#timerDurations .duration-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        if (timerState.status !== 'idle') return;
        timerState.durationMin = Number(btn.dataset.duration);
        $$('#timerDurations .duration-chip').forEach(b => b.classList.toggle('active', b === btn));
        const customInput = $('#durationCustomInput');
        if (customInput) customInput.value = '';
        updateTimerDisplay();
      });
    });
    const customInput = $('#durationCustomInput');
    if (customInput) {
      customInput.addEventListener('change', () => {
        if (timerState.status !== 'idle') return;
        const val = Math.max(1, Math.min(180, Math.round(Number(customInput.value) || 0)));
        if (!val) return;
        customInput.value = val;
        timerState.durationMin = val;
        $$('#timerDurations .duration-chip').forEach(b => b.classList.toggle('active', Number(b.dataset.duration) === val));
        updateTimerDisplay();
      });
    }
  }

  function setTimerMode(mode) {
    if (timerState.status !== 'idle') return; // avoid switching mode mid-session
    timerState.mode = mode;
    $$('.timer-mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    const durationsWrap = $('#timerDurations');
    if (durationsWrap) durationsWrap.hidden = mode !== 'countdown';
    updateTimerDisplay();
  }

  function renderTimerStats() {
    const wrap = $('#timerInsightCards');
    if (!wrap) return;
    const tk = todayKey();
    const todaySessions = state.timerSessions.filter(s => s.date === tk);
    const todayMinutes = todaySessions.reduce((sum, s) => sum + s.minutes, 0);
    const lifetimeMinutes = state.timerSessions.reduce((sum, s) => sum + s.minutes, 0);
    wrap.innerHTML = `
      <div class="insight-card">
        <div class="insight-value">${fmtNum(todayMinutes)}</div>
        <div class="insight-label">دقيقة تركيز اليوم</div>
      </div>
      <div class="insight-card">
        <div class="insight-value">${fmtNum(todaySessions.length)}</div>
        <div class="insight-label">جلسات اليوم</div>
      </div>
      <div class="insight-card">
        <div class="insight-value">${fmtNum(lifetimeMinutes)}</div>
        <div class="insight-label">إجمالي الدقائق</div>
      </div>`;
  }

  function renderTimerSessions() {
    const list = $('#timerSessionsList');
    const empty = $('#timerSessionsEmpty');
    if (!list) return;
    const recent = state.timerSessions.slice(0, 6);
    if (recent.length === 0) {
      list.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    const tk = todayKey();
    list.innerHTML = recent.map(s => {
      const act = TIMER_ACTIVITIES.find(a => a.id === s.activity) || TIMER_ACTIVITIES[0];
      const d = new Date(s.ts);
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `<div class="timer-session-item">
        <span class="timer-session-icon" aria-hidden="true">${getCatIcon(act.icon)}</span>
        <span class="timer-session-info">
          <span class="timer-session-activity">${escapeHtml(act.label)}</span>
          <span class="timer-session-meta">${s.date === tk ? 'اليوم' : s.date} · ${timeStr}</span>
        </span>
        <span class="timer-session-minutes">${fmtNum(s.minutes)} د</span>
      </div>`;
    }).join('');
  }

  function renderTimerTab() {
    renderTimerActivities();
    renderTimerDurations();
    const durationsWrap = $('#timerDurations');
    if (durationsWrap) durationsWrap.hidden = timerState.mode !== 'countdown';
    const labelEl = $('#timerActivityLabel');
    if (labelEl) labelEl.textContent = timerActivity().label;
    updateTimerDisplay();
    renderTimerStats();
    renderTimerSessions();
  }

  function setupTimerTab() {
    $$('.timer-mode-tab').forEach(tab => {
      tab.addEventListener('click', () => setTimerMode(tab.dataset.mode));
    });
    const startBtn = $('#timerStartBtn');
    const resetBtn = $('#timerResetBtn');
    const finishBtn = $('#timerFinishBtn');
    if (startBtn) startBtn.addEventListener('click', startOrPauseTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetTimer);
    if (finishBtn) finishBtn.addEventListener('click', () => finishTimerSession(false));
  }

  // ===================================================
  // 25. Mobile sidebar toggle
  // ===================================================
  function setupMobileNav() {
    const toggle = $('#mobileNavToggle');
    const sidebar = $('#sidebar');
    const backdrop = $('#sidebarBackdrop');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      sidebar.classList.add('open');
      backdrop.hidden = false;
      requestAnimationFrame(() => backdrop.classList.add('show'));
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
      setTimeout(() => { backdrop.hidden = true; }, 240);
    });
  }

  // ===================================================
  // 26. Render all (re-render current views)
  // ===================================================
  function renderAll() {
    renderHomeView();
    renderSidebarCategories();
    const activeView = $('.view-panel.active');
    if (activeView) {
      const viewId = activeView.id;
      if (viewId === 'view-category' && currentCategoryId) renderCategoryView(currentCategoryId);
      else if (viewId === 'view-favorites') renderFavoritesGrid();
      else if (viewId === 'view-custom') renderCustomGrid();
      else if (viewId === 'view-timer') renderTimerTab();
      else if (viewId === 'view-calendar') renderCalendarTab();
      else if (viewId === 'view-search') {
        const q = $('#searchInput').value.trim();
        if (q) runSearch(q);
      }
    }
  }

  // ===================================================
  // 27. Init
  // ===================================================
  function init() {
    loadState();
    ensureSvgDefs();
    applyTheme(state.settings.theme);
    applyFontScale(state.settings.fontScale);

    renderSidebarCategories();
    setupNavigation();
    setupMobileNav();
    setupSearch();
    setupSettingsDrawer();
    setupThemeToggle();
    setupCustomModal();
    setupDetailModal();
    setupConfirmModal();
    setupShareModal();
    setupFontScale();
    setupReminders();
    setupTimerTab();
    setupCalendarTab();

    renderHomeView();
    updateStats();
    renderBadges();
    updateFavCount();
    updateHeaderDate();

    // Free-form tasbeeh FAB
    const fabFree = $('#freeTasbeehFab');
    if (fabFree) fabFree.addEventListener('click', () => openFocusOverlay(window.FREE_TASBEEH));

    // Footer year
    const footerYear = $('#footerYear');
    if (footerYear) footerYear.textContent = new Date().getFullYear();

    // Close focus overlay with Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const overlay = $('#focusOverlay');
        if (overlay && !overlay.hidden) {
          closeFocusOverlay();
          return;
        }
        const detailModal = $('#detailModal');
        if (detailModal && !detailModal.hidden) { closeModal(detailModal); return; }
        const customModal = $('#customModal');
        if (customModal && !customModal.hidden) { closeModal(customModal); return; }
        const confirmModal = $('#confirmModal');
        if (confirmModal && !confirmModal.hidden) { closeModal(confirmModal); return; }
        const shareModal = $('#shareModal');
        if (shareModal && !shareModal.hidden) { closeModal(shareModal); return; }
      }
    });

    // Re-check streak when day changes
    setInterval(() => {
      const tk = todayKey();
      if (state.daily[tk] && state.streak.lastDay !== tk) {
        updateStreak();
        updateStats();
      }
      updateHeaderDate();
    }, 60000);

    checkBadges();

    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW registration failed', err));
      });
    }

    // NOTE: double-tap-zoom prevention is handled entirely via the CSS
    // `touch-action: manipulation` rule (see styles.css). We intentionally do
    // NOT call preventDefault() on touchstart here — doing so on a touch
    // device suppresses the synthetic mouse/click events Safari & Chrome fire
    // afterwards (per the touch-events spec), which is why the Tasbeeh
    // counter, read cards, and category cards previously failed to register
    // taps on phones, and could also interfere with the browser's own
    // scroll-gesture detection on touch devices.
  }

  // Kick off
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
