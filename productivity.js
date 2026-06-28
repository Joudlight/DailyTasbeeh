/* =====================================================
   رفيق الذكر — Productivity & Time Management Module
   - Pomodoro / Focus / Study / Reading / Quran / Tasbeeh / Work / Custom
   - Task Manager with categories, priorities, filters
   - Daily Dashboard with statistics
   - Hijri Calendar
   ===================================================== */
(function () {
  'use strict';

  // ===================================================
  // 1. State & Persistence
  // ===================================================
  const STORAGE_KEY = 'dhikr:prod';

  const TIMER_MODES = [
    { id: 'pomodoro', label: 'بومودورو', icon: 'clock', desc: '25 دقيقة تركيز + 5 دقائق استراحة' },
    { id: 'focus', label: 'جلسة تركيز', icon: 'target', desc: 'وقت مخصص للتركيز العميق بدون مقاطعة' },
    { id: 'study', label: 'مذاكرة', icon: 'book-open', desc: 'تتبع وقت المذاكرة والمراجعة' },
    { id: 'reading', label: 'قراءة', icon: 'book', desc: 'وقت القراءة الحرة والاطلاع' },
    { id: 'quran', label: 'قراءة القرآن', icon: 'quran', desc: 'تلاوة وتدبر القرآن الكريم' },
    { id: 'tasbeeh', label: 'تسبيح', icon: 'heart', desc: 'وقت التسبيح والاستغفار' },
    { id: 'work', label: 'عمل', icon: 'briefcase', desc: 'ساعات العمل والإنجاز' },
    { id: 'custom', label: 'مخصص', icon: 'sliders', desc: 'جلسة زمنية حسب اختيارك' },
  ];

  const TASK_CATEGORIES = ['الدراسة', 'العمل', 'التسبيح', 'قراءة القرآن', 'الأذكار', 'المشاريع', 'السفر', 'الصحة', 'الرياضة', 'أخرى'];
  const TASK_PRIORITIES = [
    { id: 'low', label: 'منخفضة', color: '#8a958f' },
    { id: 'medium', label: 'متوسطة', color: '#c8a04a' },
    { id: 'high', label: 'عالية', color: '#e8674c' },
    { id: 'urgent', label: 'عاجلة', color: '#e11d48' },
  ];

  const HIJRI_MONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  const IMPORTANT_ISLAMIC_DATES = [
    { d: 1, m: 1, name: 'رأس السنة الهجرية' },
    { d: 10, m: 1, name: 'يوم عاشوراء' },
    { d: 12, m: 3, name: 'المولد النبوي الشريف' },
    { d: 27, m: 7, name: 'الإسراء والمعراج' },
    { d: 15, m: 8, name: 'ليلة البراءة (النصف من شعبان)' },
    { d: 1, m: 9, name: 'أول رمضان' },
    { d: 21, m: 9, name: 'ليلة القدر (إحدى ليالي العشر الأواخر)' },
    { d: 1, m: 10, name: 'عيد الفطر المبارك' },
    { d: 9, m: 12, name: 'يوم عرفة' },
    { d: 10, m: 12, name: 'عيد الأضحى المبارك' },
  ];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function fmtNum(n) { return Number(n).toLocaleString('en-US'); }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function weekKey(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.getFullYear() + '-W' + String(Math.ceil((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / 86400000 / 7) + 1).padStart(2, '0');
  }

  function monthKey(date) {
    const d = new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---- State ----
  let state = {
    timer: {
      mode: 'pomodoro',
      running: false,
      paused: false,
      seconds: 0,
      totalSeconds: 0,
      interval: null,
      startedAt: null,
      pomodoroFocus: 25,
      pomodoroShortBreak: 5,
      pomodoroLongBreak: 15,
      pomodoroCycles: 0,
      pomodoroPhase: 'focus',
      autoStart: false,
      soundEnabled: true,
    },
    sessions: {}, // { dateKey: [{ mode, duration, startTime }] }
    tasks: [], // Array of task objects
    taskNextId: 1,
    calendarMonth: 0, // 0 = current month
    calendarYear: 0, // 0 = current year
    fullscreen: false,
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state.timer = { ...state.timer, ...saved.timer, interval: null };
        state.sessions = saved.sessions || {};
        state.tasks = saved.tasks || [];
        state.taskNextId = saved.taskNextId || 1;
      }
    } catch (e) { console.warn('Failed to load productivity state', e); }
  }

  function saveState() {
    try {
      const toSave = {
        timer: { ...state.timer, interval: null, running: false, paused: false },
        sessions: state.sessions,
        tasks: state.tasks,
        taskNextId: state.taskNextId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) { console.warn('Failed to save productivity state', e); }
  }

  // ===================================================
  // 2. Audio for Timer
  // ===================================================
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTimerEndSound() {
    if (!state.timer.soundEnabled) return;
    const ctx = getAudioCtx(); if (!ctx) return;
    const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.12;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  }

  function playClickSound() {
    if (!state.timer.soundEnabled) return;
    const ctx = getAudioCtx(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  }

  // ===================================================
  // 3. Timer Engine
  // ===================================================
  function formatTime(sec) {
    if (sec <= 0) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function getTimerDuration() {
    const t = state.timer;
    if (t.mode === 'pomodoro') {
      return t.pomodoroPhase === 'focus' ? t.pomodoroFocus * 60 : (t.pomodoroPhase === 'shortBreak' ? t.pomodoroShortBreak * 60 : t.pomodoroLongBreak * 60);
    }
    return t.totalSeconds;
  }

  function getTimerModeLabel() {
    const mode = TIMER_MODES.find(m => m.id === state.timer.mode);
    return mode ? mode.label : state.timer.mode;
  }

  function getTimerProgress() {
    const total = getTimerDuration();
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, (total - state.timer.seconds) / total));
  }

  function tickTimer() {
    if (!state.timer.running || state.timer.paused) return;
    state.timer.seconds = Math.max(0, state.timer.seconds - 1);
    updateTimerDisplay();
    if (state.timer.seconds <= 0) {
      timerComplete();
    }
  }

  function timerComplete() {
    stopTimerInternal();
    playTimerEndSound();
    saveSession();
    if (state.timer.mode === 'pomodoro') {
      const t = state.timer;
      if (t.pomodoroPhase === 'focus') {
        t.pomodoroCycles++;
        if (t.pomodoroCycles % 4 === 0) {
          t.pomodoroPhase = 'longBreak';
        } else {
          t.pomodoroPhase = 'shortBreak';
        }
      } else {
        t.pomodoroPhase = 'focus';
      }
      if (t.autoStart) {
        t.seconds = getTimerDuration();
        t.running = true;
        t.paused = false;
        t.startedAt = Date.now();
        if (t.interval) clearInterval(t.interval);
        t.interval = setInterval(tickTimer, 1000);
        showToast('بدأت جلسة جديدة: ' + getTimerModeLabel(), 'success');
      }
    }
    updateTimerDisplay();
    renderDashboard();
    saveState();
  }

  function saveSession() {
    const completedSeconds = getTimerDuration() - state.timer.seconds;
    if (completedSeconds < 10) return;
    const key = todayKey();
    if (!state.sessions[key]) state.sessions[key] = [];
    state.sessions[key].push({
      mode: state.timer.mode,
      duration: completedSeconds,
      startTime: state.timer.startedAt || Date.now(),
      phase: state.timer.mode === 'pomodoro' ? state.timer.pomodoroPhase : null,
    });
    saveState();
  }

  function startTimer() {
    const t = state.timer;
    if (t.running) return;
    if (t.seconds <= 0) {
      t.seconds = getTimerDuration();
    }
    t.running = true;
    t.paused = false;
    t.startedAt = Date.now();
    if (t.interval) clearInterval(t.interval);
    t.interval = setInterval(tickTimer, 1000);
    playClickSound();
    updateTimerDisplay();
    saveState();
  }

  function pauseTimer() {
    const t = state.timer;
    if (!t.running || t.paused) return;
    t.paused = true;
    if (t.interval) { clearInterval(t.interval); t.interval = null; }
    playClickSound();
    updateTimerDisplay();
  }

  function resumeTimer() {
    const t = state.timer;
    if (!t.running || !t.paused) return;
    t.paused = false;
    if (t.interval) clearInterval(t.interval);
    t.interval = setInterval(tickTimer, 1000);
    playClickSound();
    updateTimerDisplay();
  }

  function stopTimerInternal() {
    const t = state.timer;
    t.running = false;
    t.paused = false;
    if (t.interval) { clearInterval(t.interval); t.interval = null; }
  }

  function resetTimer() {
    const t = state.timer;
    stopTimerInternal();
    t.seconds = getTimerDuration();
    updateTimerDisplay();
  }

  function setTimerMode(mode) {
    const t = state.timer;
    stopTimerInternal();
    t.mode = mode;
    t.pomodoroPhase = 'focus';
    t.seconds = getTimerDuration();
    updateTimerDisplay();
    renderTimerView();
    saveState();
  }

  function setPomodoroPhase(phase) {
    const t = state.timer;
    stopTimerInternal();
    t.pomodoroPhase = phase;
    t.seconds = getTimerDuration();
    updateTimerDisplay();
    renderTimerView();
    saveState();
  }

  // ===================================================
  // 4. Task Management
  // ===================================================
  function createTask(data) {
    const task = {
      id: state.taskNextId++,
      title: data.title || '',
      description: data.description || '',
      dueDate: data.dueDate || '',
      dueTime: data.dueTime || '',
      category: data.category || 'أخرى',
      priority: data.priority || 'medium',
      status: data.status || 'pending', // pending, in_progress, completed, archived
      notes: data.notes || '',
      createdAt: Date.now(),
      completedAt: null,
      order: state.tasks.length,
    };
    state.tasks.push(task);
    saveState();
    return task;
  }

  function updateTask(id, data) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const task = state.tasks[idx];
    if (data.title !== undefined) task.title = data.title;
    if (data.description !== undefined) task.description = data.description;
    if (data.dueDate !== undefined) task.dueDate = data.dueDate;
    if (data.dueTime !== undefined) task.dueTime = data.dueTime;
    if (data.category !== undefined) task.category = data.category;
    if (data.priority !== undefined) task.priority = data.priority;
    if (data.status !== undefined) {
      task.status = data.status;
      if (data.status === 'completed') task.completedAt = Date.now();
      else task.completedAt = null;
    }
    if (data.notes !== undefined) task.notes = data.notes;
    saveState();
    return task;
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
  }

  function toggleTaskStatus(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if (task.status === 'completed') {
      task.status = 'pending';
      task.completedAt = null;
    } else {
      task.status = 'completed';
      task.completedAt = Date.now();
    }
    saveState();
  }

  function duplicateTask(id) {
    const original = state.tasks.find(t => t.id === id);
    if (!original) return;
    const task = createTask({
      title: original.title + ' (نسخة)',
      description: original.description,
      dueDate: original.dueDate,
      dueTime: original.dueTime,
      category: original.category,
      priority: original.priority,
      status: 'pending',
      notes: original.notes,
    });
    saveState();
    return task;
  }

  function archiveTask(id) {
    updateTask(id, { status: 'archived' });
  }

  function getFilteredTasks(filters) {
    let tasks = [...state.tasks].filter(t => t.status !== 'archived');
    if (filters) {
      if (filters.category && filters.category !== 'الكل') tasks = tasks.filter(t => t.category === filters.category);
      if (filters.priority && filters.priority !== 'all') tasks = tasks.filter(t => t.priority === filters.priority);
      if (filters.status && filters.status !== 'all') tasks = tasks.filter(t => t.status === filters.status);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
      }
    }
    return tasks;
  }

  function sortTasks(tasks, sortBy) {
    const sorted = [...tasks];
    switch (sortBy) {
      case 'dueDate':
        sorted.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate) || a.dueTime.localeCompare(b.dueTime);
        });
        break;
      case 'priority':
        const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        sorted.sort((a, b) => (pOrder[a.priority] || 99) - (pOrder[b.priority] || 99));
        break;
      case 'created':
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
      default:
        sorted.sort((a, b) => a.order - b.order);
    }
    return sorted;
  }

  // ===================================================
  // 5. Hijri Calendar (Tabular)
  // ===================================================
  function gregorianToHijri(date) {
    try {
      const f = new Intl.DateTimeFormat('en-u-ca-islamic', { day: 'numeric', month: 'numeric', year: 'numeric' });
      const parts = f.formatToParts(date);
      let hDay = 0, hMonth = 0, hYear = 0;
      for (const p of parts) {
        if (p.type === 'day') hDay = parseInt(p.value, 10);
        if (p.type === 'month') hMonth = parseInt(p.value, 10);
        if (p.type === 'year') hYear = parseInt(p.value, 10);
      }
      if (hDay && hMonth && hYear) {
        return { year: hYear, month: hMonth, day: hDay, monthName: HIJRI_MONTHS[hMonth - 1] };
      }
    } catch (_) {}
    const g = new Date(date);
    let y = g.getFullYear(), m = g.getMonth() + 1, d = g.getDate();
    if (m <= 2) { y--; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
    const hijriEpoch = 1948439;
    const days = Math.round(jd) - hijriEpoch;
    const hYear = Math.floor((30 * days + 10646) / 10631);
    const r = days - Math.floor((hYear - 1) * 10631 / 30);
    const hMonth = Math.min(12, Math.max(1, Math.ceil(r / 29.5)));
    const hDay = Math.min(30, Math.max(1, Math.floor(r - (hMonth - 1) * 29.5)));
    return { year: hYear, month: hMonth, day: hDay, monthName: HIJRI_MONTHS[hMonth - 1] };
  }

  function hijriToGregorian(hYear, hMonth, hDay) {
    const hijriEpoch = 1948439;
    const days = Math.floor((hYear - 1) * 10631 / 30) + Math.floor((hMonth - 1) * 29.5) + hDay;
    const jd = hijriEpoch + days;
    const a = jd + 32075;
    const b = Math.floor((4 * a - 3) / 146097);
    const c = a - Math.floor(146097 * b / 4);
    const d = Math.floor((4 * c - 1) / 1461);
    const e = c - Math.floor(1461 * d / 4);
    const m = Math.floor((5 * e - 3) / 153);
    const gDay = e - Math.floor((153 * m + 3) / 5);
    const gMonth = m + 3 - 12 * Math.floor(m / 10);
    const gYear = 100 * b + d - 4800 + Math.floor(m / 10);
    return new Date(gYear, gMonth - 1, gDay);
  }

  function getHijriMonthDays(hYear, hMonth) {
    const isLeap = (hYear % 30) === 2 || (hYear % 30) === 5 || (hYear % 30) === 7 || (hYear % 30) === 10 ||
      (hYear % 30) === 13 || (hYear % 30) === 16 || (hYear % 30) === 18 || (hYear % 30) === 21 ||
      (hYear % 30) === 24 || (hYear % 30) === 26 || (hYear % 30) === 29;
    if (hMonth <= 7) return hMonth % 2 === 1 ? 30 : 29;
    return hMonth === 12 && isLeap ? 30 : (hMonth % 2 === 0 ? 30 : 29);
  }

  function getHijriMonthGrid(hYear, hMonth) {
    const firstDay = hijriToGregorian(hYear, hMonth, 1);
    const daysInMonth = getHijriMonthDays(hYear, hMonth);
    const startDow = firstDay.getDay(); // 0=Sun
    const today = new Date();
    const todayH = gregorianToHijri(today);
    const weeks = [];
    let day = 1;
    for (let w = 0; w < 6; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        if ((w === 0 && d < startDow) || day > daysInMonth) {
          week.push(null);
        } else {
          week.push({
            day: day,
            isToday: day === todayH.day && hMonth === todayH.month && hYear === todayH.year,
            isImportant: IMPORTANT_ISLAMIC_DATES.some(imp => imp.d === day && imp.m === hMonth),
            importantEvents: IMPORTANT_ISLAMIC_DATES.filter(imp => imp.d === day && imp.m === hMonth),
          });
          day++;
        }
      }
      weeks.push(week);
      if (day > daysInMonth) break;
    }
    return { weeks, year: hYear, month: hMonth, monthName: HIJRI_MONTHS[hMonth - 1], daysInMonth };
  }

  // ===================================================
  // 6. Rendering — Dashboard
  // ===================================================
  function renderDashboard() {
    const container = $('#prodDashboard');
    if (!container) return;
    const now = new Date();
    const h = gregorianToHijri(now);
    const todaySessions = state.sessions[todayKey()] || [];
    const todayFocusSeconds = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const completedTasks = state.tasks.filter(t => t.status === 'completed');
    const todayTasks = completedTasks.filter(t => t.completedAt && todayKey() === dayKeyFromTime(t.completedAt));

    const weekSessions = getWeekSessions();
    const weekSeconds = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const monthSessions = getMonthSessions();
    const monthSeconds = monthSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    const quranSeconds = todaySessions.filter(s => s.mode === 'quran').reduce((sum, s) => sum + (s.duration || 0), 0);
    const tasbeehSeconds = todaySessions.filter(s => s.mode === 'tasbeeh').reduce((sum, s) => sum + (s.duration || 0), 0);

    container.innerHTML = `
      <div class="dash-grid">
        <div class="dash-card dash-card-time">
          <div class="dash-time" id="dashClock">${formatTimeOfDay(now)}</div>
          <div class="dash-gregorian">${now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div class="dash-hijri">${h.day} ${h.monthName} ${h.year} هـ</div>
        </div>
        <div class="dash-card">
          <div class="dash-stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="dash-stat-value">${formatDurationShort(todayFocusSeconds)}</div>
          <div class="dash-stat-label">وقت التركيز اليوم</div>
        </div>
        <div class="dash-card">
          <div class="dash-stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div class="dash-stat-value">${fmtNum(todayTasks.length)}</div>
          <div class="dash-stat-label">مهام مكتملة اليوم</div>
        </div>
        <div class="dash-card">
          <div class="dash-stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </div>
          <div class="dash-stat-value">${formatDurationShort(quranSeconds)}</div>
          <div class="dash-stat-label">قراءة القرآن</div>
        </div>
        <div class="dash-card">
          <div class="dash-stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <div class="dash-stat-value">${formatDurationShort(tasbeehSeconds)}</div>
          <div class="dash-stat-label">تسبيح</div>
        </div>
        <div class="dash-card">
          <div class="dash-stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div class="dash-stat-value">${formatDurationShort(weekSeconds)}</div>
          <div class="dash-stat-label">هذا الأسبوع</div>
        </div>
        <div class="dash-card">
          <div class="dash-stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="dash-stat-value">${formatDurationShort(monthSeconds)}</div>
          <div class="dash-stat-label">هذا الشهر</div>
        </div>
      </div>
      <div class="dash-recent-sessions">
        <h3 class="dash-section-title">آخر الجلسات</h3>
        <div class="dash-session-list" id="dashSessionList"></div>
      </div>
    `;
    renderRecentSessions();
    updateClock();
  }

  function renderRecentSessions() {
    const list = $('#dashSessionList');
    if (!list) return;
    const allSessions = [];
    const keys = Object.keys(state.sessions).sort().reverse().slice(0, 7);
    for (const k of keys) {
      for (const s of state.sessions[k]) {
        allSessions.push({ ...s, date: k });
      }
    }
    const recent = allSessions.sort((a, b) => (b.startTime || 0) - (a.startTime || 0)).slice(0, 10);
    if (recent.length === 0) {
      list.innerHTML = '<div class="dash-empty">لا توجد جلسات بعد. ابدأ جلسة تركيز الآن!</div>';
      return;
    }
    list.innerHTML = recent.map(s => {
      const mode = TIMER_MODES.find(m => m.id === s.mode);
      return `<div class="dash-session-item">
        <span class="dash-session-mode">${mode ? mode.label : s.mode}</span>
        <span class="dash-session-duration">${formatDurationShort(s.duration)}</span>
        <span class="dash-session-date">${s.date}</span>
      </div>`;
    }).join('');
  }

  function getWeekSessions() {
    const wk = weekKey(new Date());
    const all = [];
    for (const k of Object.keys(state.sessions)) {
      if (weekKey(new Date(k)) === wk) {
        all.push(...state.sessions[k]);
      }
    }
    return all;
  }

  function getMonthSessions() {
    const mk = monthKey(new Date());
    const all = [];
    for (const k of Object.keys(state.sessions)) {
      if (monthKey(new Date(k)) === mk) {
        all.push(...state.sessions[k]);
      }
    }
    return all;
  }

  function formatTimeOfDay(date) {
    return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
  }

  function formatDurationShort(sec) {
    if (sec <= 0) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + ' س ' + m + ' د';
    return m + ' د';
  }

  function updateClock() {
    const el = $('#dashClock');
    if (el) el.textContent = formatTimeOfDay(new Date());
  }

  // ===================================================
  // 7. Rendering — Timer View
  // ===================================================
  let timerTickInterval = null;

  function renderTimerView() {
    const container = $('#prodTimer');
    if (!container) return;
    const t = state.timer;
    const mode = TIMER_MODES.find(m => m.id === t.mode);
    const total = getTimerDuration();
    const progress = getTimerProgress();
    const circumference = 2 * Math.PI * 120;
    const offset = circumference * (1 - progress);

    const isPomodoro = t.mode === 'pomodoro';

    let modeBtnsHtml = TIMER_MODES.map(m => {
      const icons = {
        clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
        'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
        book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
        quran: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="6" x2="12" y2="16"/><line x1="8" y1="10" x2="16" y2="10"/>',
        heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
        briefcase: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
        sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
      };
      const isActive = m.id === t.mode;
      return `<button class="tm-mode-btn${isActive ? ' active' : ''}" data-mode="${m.id}" title="${escapeHtml(m.desc)}">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[m.icon] || icons.clock}</svg>
        <span>${escapeHtml(m.label)}</span>
      </button>`;
    }).join('');

    let phaseHtml = '';
    if (isPomodoro) {
      phaseHtml = `<div class="tm-pomodoro-phases">
        <button class="tm-phase-btn${t.pomodoroPhase === 'focus' ? ' active' : ''}" data-phase="focus">تركيز</button>
        <button class="tm-phase-btn${t.pomodoroPhase === 'shortBreak' ? ' active' : ''}" data-phase="shortBreak">استراحة قصيرة</button>
        <button class="tm-phase-btn${t.pomodoroPhase === 'longBreak' ? ' active' : ''}" data-phase="longBreak">استراحة طويلة</button>
      </div>`;
    }

    container.innerHTML = `
      <div class="tm-modes">${modeBtnsHtml}</div>
      ${phaseHtml}
      <div class="tm-circle-wrap">
        <svg class="tm-circle-svg" viewBox="0 0 260 260" width="260" height="260">
          <circle class="tm-circle-track" cx="130" cy="130" r="120" fill="none" stroke="var(--border)" stroke-width="8"/>
          <circle class="tm-circle-progress" cx="130" cy="130" r="120" fill="none" stroke="url(#timerGradient)" stroke-width="8"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            stroke-linecap="round" transform="rotate(-90 130 130)"/>
        </svg>
        <div class="tm-circle-inner">
          <div class="tm-time-display" id="timerDisplay">${formatTime(t.seconds)}</div>
          <div class="tm-mode-label">${mode ? mode.label : ''}</div>
        </div>
      </div>
      <div class="tm-controls">
        ${!t.running && !t.paused ? '<button class="tm-btn tm-btn-primary" id="tmStartBtn">بدء</button>' : ''}
        ${t.running && !t.paused ? '<button class="tm-btn tm-btn-pause" id="tmPauseBtn">إيقاف مؤقت</button>' : ''}
        ${t.running && t.paused ? '<button class="tm-btn tm-btn-primary" id="tmResumeBtn">استمرار</button>' : ''}
        ${t.running || t.paused ? '<button class="tm-btn tm-btn-stop" id="tmStopBtn">إيقاف</button>' : ''}
        <button class="tm-btn tm-btn-reset" id="tmResetBtn">إعادة</button>
        <button class="tm-btn tm-btn-fullscreen" id="tmFullscreenBtn">${state.fullscreen ? 'تصغير' : 'ملء الشاشة'}</button>
      </div>
      <div class="tm-stats-bar">
        <span>إجمالي اليوم: ${formatDurationShort(getTodayTotalSeconds())}</span>
        ${isPomodoro ? '<span>الدورات: ' + fmtNum(t.pomodoroCycles) + '</span>' : ''}
      </div>
    `;

    wireTimerEvents();
  }

  function wireTimerEvents() {
    const startBtn = $('#tmStartBtn');
    const pauseBtn = $('#tmPauseBtn');
    const resumeBtn = $('#tmResumeBtn');
    const stopBtn = $('#tmStopBtn');
    const resetBtn = $('#tmResetBtn');
    const fsBtn = $('#tmFullscreenBtn');

    if (startBtn) startBtn.addEventListener('click', startTimer);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
    if (resumeBtn) resumeBtn.addEventListener('click', resumeTimer);
    if (stopBtn) stopBtn.addEventListener('click', () => { stopTimerInternal(); updateTimerDisplay(); saveState(); });
    if (resetBtn) resetBtn.addEventListener('click', resetTimer);
    if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen);

    $$('.tm-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setTimerMode(btn.dataset.mode));
    });
    $$('.tm-phase-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setPomodoroPhase(btn.dataset.phase);
      });
    });
  }

  function updateTimerDisplay() {
    const el = $('#timerDisplay');
    if (el) el.textContent = formatTime(state.timer.seconds);
    const total = getTimerDuration();
    const progress = getTimerProgress();
    const circumference = 2 * Math.PI * 120;
    const offset = circumference * (1 - progress);
    const progEl = document.querySelector('.tm-circle-progress');
    if (progEl) {
      progEl.setAttribute('stroke-dashoffset', offset);
    }
  }

  function getTodayTotalSeconds() {
    const today = state.sessions[todayKey()] || [];
    return today.reduce((sum, s) => sum + (s.duration || 0), 0);
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
      state.fullscreen = true;
    } else {
      document.exitFullscreen().catch(() => {});
      state.fullscreen = false;
    }
    renderTimerView();
  }

  // ===================================================
  // 8. Rendering — Timer Settings
  // ===================================================
  function renderTimerSettings() {
    const container = $('#prodTimerSettings');
    if (!container) return;
    const t = state.timer;
    container.innerHTML = `
      <div class="ts-group">
        <h3>إعدادات بومودورو</h3>
        <div class="ts-row">
          <label>مدة التركيز (دقائق)</label>
          <input type="number" class="ts-input" id="tsPomodoroFocus" value="${t.pomodoroFocus}" min="1" max="120">
        </div>
        <div class="ts-row">
          <label>الاستراحة القصيرة (دقائق)</label>
          <input type="number" class="ts-input" id="tsPomodoroShort" value="${t.pomodoroShortBreak}" min="1" max="30">
        </div>
        <div class="ts-row">
          <label>الاستراحة الطويلة (دقائق)</label>
          <input type="number" class="ts-input" id="tsPomodoroLong" value="${t.pomodoroLongBreak}" min="1" max="60">
        </div>
        <div class="ts-row">
          <label>تشغيل تلقائي للجلسة التالية</label>
          <button class="toggle-switch ts-toggle" id="tsAutoStart" role="switch" aria-checked="${t.autoStart}">
            <span class="toggle-thumb"></span>
          </button>
        </div>
        <div class="ts-row">
          <label>صوت التنبيه</label>
          <button class="toggle-switch ts-toggle" id="tsSound" role="switch" aria-checked="${t.soundEnabled}">
            <span class="toggle-thumb"></span>
          </button>
        </div>
        <button class="btn btn-primary" id="tsSaveBtn">حفظ الإعدادات</button>
      </div>
    `;
    $('#tsSaveBtn').addEventListener('click', () => {
      const focus = parseInt($('#tsPomodoroFocus').value) || 25;
      const short = parseInt($('#tsPomodoroShort').value) || 5;
      const lon = parseInt($('#tsPomodoroLong').value) || 15;
      state.timer.pomodoroFocus = Math.max(1, Math.min(120, focus));
      state.timer.pomodoroShortBreak = Math.max(1, Math.min(30, short));
      state.timer.pomodoroLongBreak = Math.max(1, Math.min(60, lon));
      state.timer.autoStart = $('#tsAutoStart').getAttribute('aria-checked') === 'true';
      state.timer.soundEnabled = $('#tsSound').getAttribute('aria-checked') === 'true';
      state.timer.seconds = getTimerDuration();
      saveState();
      updateTimerDisplay();
      renderTimerView();
      showToast('تم حفظ الإعدادات', 'success');
    });
    $$('.ts-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const checked = toggle.getAttribute('aria-checked') === 'true';
        toggle.setAttribute('aria-checked', !checked);
      });
    });
  }

  // ===================================================
  // 9. Rendering — Task Manager
  // ===================================================
  let taskListView = 'list'; // list, card, calendar
  let taskFilters = { category: 'الكل', priority: 'all', status: 'all', search: '' };
  let taskSortBy = 'order';

  function renderTaskManager() {
    const container = $('#prodTasks');
    if (!container) return;
    const tasks = sortTasks(getFilteredTasks(taskFilters), taskSortBy);
    const pendingCount = state.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
    const completedCount = state.tasks.filter(t => t.status === 'completed').length;

    container.innerHTML = `
      <div class="task-toolbar">
        <button class="btn btn-primary" id="taskAddBtn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>إضافة مهمة</span>
        </button>
        <div class="task-view-toggle">
          <button class="task-view-btn${taskListView === 'list' ? ' active' : ''}" data-view="list" title="عرض القائمة">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button class="task-view-btn${taskListView === 'card' ? ' active' : ''}" data-view="card" title="عرض البطاقات">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button class="task-view-btn${taskListView === 'calendar' ? ' active' : ''}" data-view="calendar" title="عرض التقويم">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </button>
        </div>
      </div>

      <div class="task-summary">
        <div class="task-summary-item">
          <span class="task-summary-value">${fmtNum(pendingCount)}</span>
          <span class="task-summary-label">قيد الانتظار</span>
        </div>
        <div class="task-summary-item">
          <span class="task-summary-value">${fmtNum(completedCount)}</span>
          <span class="task-summary-label">مكتملة</span>
        </div>
        <div class="task-summary-item">
          <span class="task-summary-value">${fmtNum(state.tasks.length)}</span>
          <span class="task-summary-label">المجموع</span>
        </div>
      </div>

      <div class="task-filters">
        <div class="task-filter-row">
          <select class="task-filter-select" id="taskFilterCategory">
            <option value="الكل">كل التصنيفات</option>
            ${TASK_CATEGORIES.map(c => `<option value="${c}"${taskFilters.category === c ? ' selected' : ''}>${c}</option>`).join('')}
          </select>
          <select class="task-filter-select" id="taskFilterPriority">
            <option value="all">كل الأولويات</option>
            ${TASK_PRIORITIES.map(p => `<option value="${p.id}"${taskFilters.priority === p.id ? ' selected' : ''}>${p.label}</option>`).join('')}
          </select>
          <select class="task-filter-select" id="taskFilterStatus">
            <option value="all">كل الحالات</option>
            <option value="pending"${taskFilters.status === 'pending' ? ' selected' : ''}>قيد الانتظار</option>
            <option value="in_progress"${taskFilters.status === 'in_progress' ? ' selected' : ''}>قيد التنفيذ</option>
            <option value="completed"${taskFilters.status === 'completed' ? ' selected' : ''}>مكتملة</option>
          </select>
          <select class="task-filter-select" id="taskSortBy">
            <option value="order"${taskSortBy === 'order' ? ' selected' : ''}>الترتيب الافتراضي</option>
            <option value="dueDate"${taskSortBy === 'dueDate' ? ' selected' : ''}>حسب التاريخ</option>
            <option value="priority"${taskSortBy === 'priority' ? ' selected' : ''}>حسب الأولوية</option>
            <option value="created"${taskSortBy === 'created' ? ' selected' : ''}>الأحدث أولاً</option>
          </select>
          <div class="task-search-wrap">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" class="task-search-input" id="taskSearchInput" placeholder="بحث في المهام..." value="${escapeHtml(taskFilters.search)}">
          </div>
        </div>
      </div>

      <div class="task-grid" id="taskGrid" data-view="${taskListView}">
        ${renderTaskItems(tasks)}
      </div>
    `;
    wireTaskEvents();
  }

  function renderTaskItems(tasks) {
    if (tasks.length === 0) {
      return `<div class="task-empty">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        <h3>لا توجد مهام</h3>
        <p>أضف مهمة جديدة للبدء</p>
      </div>`;
    }

    if (taskListView === 'calendar') {
      return renderTaskCalendarView(tasks);
    }

    return tasks.map(task => {
      const priority = TASK_PRIORITIES.find(p => p.id === task.priority) || TASK_PRIORITIES[1];
      const isCompleted = task.status === 'completed';
      return `<div class="task-item${isCompleted ? ' completed' : ''}" data-task-id="${task.id}" draggable="true">
        <div class="task-check" data-action="toggle">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${isCompleted ? '<polyline points="20 6 9 17 4 12"/>' : '<circle cx="12" cy="12" r="10"/>'}
          </svg>
        </div>
        <div class="task-priority-bar" style="background:${priority.color}"></div>
        <div class="task-content">
          <div class="task-title">${escapeHtml(task.title)}</div>
          ${task.description ? '<div class="task-desc">' + escapeHtml(task.description) + '</div>' : ''}
          <div class="task-meta">
            <span class="task-cat">${escapeHtml(task.category)}</span>
            <span class="task-priority" style="color:${priority.color}">${priority.label}</span>
            ${task.dueDate ? '<span class="task-date">' + escapeHtml(task.dueDate) + (task.dueTime ? ' ' + escapeHtml(task.dueTime) : '') + '</span>' : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="task-action-btn" data-action="edit" title="تعديل">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="task-action-btn" data-action="duplicate" title="نسخ">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="task-action-btn" data-action="archive" title="أرشفة">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
          </button>
          <button class="task-action-btn task-action-delete" data-action="delete" title="حذف">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');
  }

  function renderTaskCalendarView(tasks) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();

    // Group tasks by due date
    const tasksByDate = {};
    tasks.forEach(t => {
      if (t.dueDate) {
        if (!tasksByDate[t.dueDate]) tasksByDate[t.dueDate] = [];
        tasksByDate[t.dueDate].push(t);
      }
    });

    let days = [];
    for (let d = 0; d < firstDay; d++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      days.push({ day: d, isToday: d === today, tasks: tasksByDate[dateStr] || [] });
    }

    const weekDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    return `<div class="task-calendar">
      <div class="task-cal-header">
        <span>${now.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}</span>
      </div>
      <div class="task-cal-weekdays">${weekDays.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="task-cal-grid">
        ${days.map(d => {
          if (!d) return '<div class="task-cal-day empty"></div>';
          return `<div class="task-cal-day${d.isToday ? ' today' : ''}${d.tasks.length > 0 ? ' has-tasks' : ''}">
            <span class="task-cal-num">${d.day}</span>
            ${d.tasks.slice(0, 3).map(t => `<span class="task-cal-event" style="border-color:${(TASK_PRIORITIES.find(p => p.id === t.priority) || {}).color || '#8a958f'}">${escapeHtml(t.title.substring(0, 12))}</span>`).join('')}
            ${d.tasks.length > 3 ? '<span class="task-cal-more">+' + (d.tasks.length - 3) + '</span>' : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function wireTaskEvents() {
    $('#taskAddBtn').addEventListener('click', () => openTaskModal());

    $$('.task-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        taskListView = btn.dataset.view;
        renderTaskManager();
      });
    });

    $$('#taskFilterCategory, #taskFilterPriority, #taskFilterStatus, #taskSortBy').forEach(el => {
      el.addEventListener('change', () => {
        taskFilters.category = $('#taskFilterCategory').value;
        taskFilters.priority = $('#taskFilterPriority').value;
        taskFilters.status = $('#taskFilterStatus').value;
        taskSortBy = $('#taskSortBy').value;
        renderTaskManager();
      });
    });

    const searchInput = $('#taskSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        taskFilters.search = searchInput.value;
        clearTimeout(searchInput._debounce);
        searchInput._debounce = setTimeout(renderTaskManager, 300);
      });
    }

    // Click events on task items (event delegation)
    const grid = $('#taskGrid');
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const item = target.closest('[data-task-id]');
      const taskId = item ? parseInt(item.dataset.taskId) : null;
      if (!taskId) return;
      const action = target.dataset.action;
      switch (action) {
        case 'toggle':
          toggleTaskStatus(taskId);
          renderTaskManager();
          showToast('تم تغيير حالة المهمة', 'success');
          break;
        case 'edit':
          openTaskModal(taskId);
          break;
        case 'duplicate':
          duplicateTask(taskId);
          renderTaskManager();
          showToast('تم نسخ المهمة', 'success');
          break;
        case 'archive':
          archiveTask(taskId);
          renderTaskManager();
          showToast('تم أرشفة المهمة', 'info');
          break;
        case 'delete':
          if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
            deleteTask(taskId);
            renderTaskManager();
            showToast('تم حذف المهمة', 'warning');
          }
          break;
      }
    });

    // Drag and drop
    let dragItem = null;
    $$('.task-item[draggable]').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        dragItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        dragItem = null;
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (dragItem !== item) {
          const grid = $('#taskGrid');
          const items = [...grid.querySelectorAll('.task-item:not(.dragging)')];
          const idx = items.indexOf(item);
          const dragIdx = items.indexOf(dragItem);
          if (dragIdx < idx) {
            item.parentNode.insertBefore(dragItem, item.nextSibling);
          } else {
            item.parentNode.insertBefore(dragItem, item);
          }
          // Update order
          const allItems = grid.querySelectorAll('.task-item');
          allItems.forEach((el, i) => {
            const id = parseInt(el.dataset.taskId);
            const task = state.tasks.find(t => t.id === id);
            if (task) task.order = i;
          });
          saveState();
        }
      });
    });
  }

  // ===================================================
  // 10. Task Modal
  // ===================================================
  let editingTaskId = null;

  function openTaskModal(taskId) {
    editingTaskId = taskId || null;
    const task = taskId ? state.tasks.find(t => t.id === taskId) : null;
    const overlay = $('#taskModalOverlay');
    overlay.hidden = false;
    overlay.classList.add('active');

    const form = $('#taskForm');
    form.innerHTML = `
      <div class="task-form-header">
        <h3>${task ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</h3>
        <button class="icon-btn" id="taskFormClose" aria-label="إغلاق">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="task-form-body">
        <div class="tf-row">
          <label>عنوان المهمة</label>
          <div class="tf-title-wrap">
            <input type="text" class="tf-input" id="tfTitle" value="${task ? escapeHtml(task.title) : ''}" placeholder="أدخل عنوان المهمة" required>
            <button type="button" class="btn btn-xs btn-outline" id="kbToggleBtn" title="لوحة المفاتيح العربية">🖮</button>
          </div>
          <div class="arabic-keyboard" id="arabicKeyboard" hidden>
            <div class="kb-row">${['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح','ج','د'].map(c => `<button type="button" class="kb-key" data-char="${c}">${c}</button>`).join('')}</div>
            <div class="kb-row">${['ش','س','ي','ب','ل','ا','ت','ن','م','ك','ط'].map(c => `<button type="button" class="kb-key" data-char="${c}">${c}</button>`).join('')}</div>
            <div class="kb-row">${['ئ','ء','ؤ','ر','لا','ى','ة','و','ز','ظ'].map(c => `<button type="button" class="kb-key" data-char="${c}">${c}</button>`).join('')}</div>
            <div class="kb-row">${[' ','،','؟','.','!','-','(' ,')'].map(c => `<button type="button" class="kb-key kb-key-wide" data-char="${c}">${c === ' ' ? '⎵' : c}</button>`).join('')}</div>
          </div>
        </div>
        <div class="tf-row">
          <label>الوصف</label>
          <textarea class="tf-textarea" id="tfDescription" placeholder="وصف المهمة (اختياري)" rows="3">${task ? escapeHtml(task.description || '') : ''}</textarea>
        </div>
        <div class="tf-row-half">
          <div>
            <label>تاريخ الاستحقاق</label>
            <input type="date" class="tf-input" id="tfDueDate" value="${task ? escapeHtml(task.dueDate || '') : ''}">
          </div>
          <div>
            <label>الوقت</label>
            <input type="time" class="tf-input" id="tfDueTime" value="${task ? escapeHtml(task.dueTime || '') : ''}">
          </div>
        </div>
        <div class="tf-row-half">
          <div>
            <label>التصنيف</label>
            <select class="tf-input" id="tfCategory">
              ${TASK_CATEGORIES.map(c => `<option value="${c}"${task && task.category === c ? ' selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>الأولوية</label>
            <select class="tf-input" id="tfPriority">
              ${TASK_PRIORITIES.map(p => `<option value="${p.id}"${task && task.priority === p.id ? ' selected' : ''}>${p.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="tf-row">
          <label>ملاحظات</label>
          <textarea class="tf-textarea" id="tfNotes" placeholder="ملاحظات إضافية (اختياري)" rows="2">${task ? escapeHtml(task.notes || '') : ''}</textarea>
        </div>
      </div>
      <div class="task-form-footer">
        <button class="btn btn-secondary" id="taskFormCancel">إلغاء</button>
        <button class="btn btn-primary" id="taskFormSave">${task ? 'حفظ التعديلات' : 'إضافة المهمة'}</button>
      </div>
    `;

    $('#taskFormClose').addEventListener('click', closeTaskModal);
    $('#taskFormCancel').addEventListener('click', closeTaskModal);
    $('#taskFormSave').addEventListener('click', saveTaskForm);
    const kbToggle = $('#kbToggleBtn');
    const kbPanel = $('#arabicKeyboard');
    if (kbToggle && kbPanel) {
      kbToggle.addEventListener('click', () => { kbPanel.hidden = !kbPanel.hidden; });
      kbPanel.querySelectorAll('.kb-key').forEach(btn => {
        btn.addEventListener('click', () => {
          const inp = $('#tfTitle');
          if (!inp) return;
          const c = btn.dataset.char;
          const start = inp.selectionStart;
          const end = inp.selectionEnd;
          const val = inp.value;
          inp.value = val.substring(0, start) + c + val.substring(end);
          inp.focus();
          inp.selectionStart = inp.selectionEnd = start + c.length;
        });
      });
    }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeTaskModal(); });
  }

  function saveTaskForm() {
    const title = $('#tfTitle').value.trim();
    if (!title) { showToast('يرجى إدخال عنوان المهمة', 'warning'); return; }
    const data = {
      title,
      description: $('#tfDescription').value.trim(),
      dueDate: $('#tfDueDate').value,
      dueTime: $('#tfDueTime').value,
      category: $('#tfCategory').value,
      priority: $('#tfPriority').value,
      notes: $('#tfNotes').value.trim(),
    };
    if (editingTaskId) {
      updateTask(editingTaskId, data);
      showToast('تم تحديث المهمة', 'success');
    } else {
      createTask(data);
      showToast('تم إضافة المهمة', 'success');
    }
    closeTaskModal();
    renderTaskManager();
  }

  function closeTaskModal() {
    const overlay = $('#taskModalOverlay');
    overlay.hidden = true;
    overlay.classList.remove('active');
    editingTaskId = null;
  }

  // ===================================================
  // 11. Rendering — Hijri Calendar
  // ===================================================
  function renderHijriCalendar() {
    const container = $('#prodHijri');
    if (!container) return;
    const now = new Date();
    const todayH = gregorianToHijri(now);
    let hYear = state.calendarYear || todayH.year;
    let hMonth = state.calendarMonth || todayH.month;

    // Wrap months
    if (hMonth < 1) { hMonth = 12; hYear--; }
    if (hMonth > 12) { hMonth = 1; hYear++; }

    const grid = getHijriMonthGrid(hYear, hMonth);
    const weekDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    // Find important dates this month
    const monthEvents = IMPORTANT_ISLAMIC_DATES.filter(imp => imp.m === hMonth);

    container.innerHTML = `
      <div class="hijri-header">
        <button class="hijri-nav-btn" id="hijriPrev">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="hijri-header-text">
          <span class="hijri-month-year">${grid.monthName} ${grid.year} هـ</span>
          <span class="hijri-gregorian-ref">${hijriToGregorian(hYear, hMonth, 1).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}</span>
        </div>
        <button class="hijri-nav-btn" id="hijriNext">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div class="hijri-today-banner">
        <span>اليوم: ${todayH.day} ${todayH.monthName} ${todayH.year} هـ</span>
        <span>|</span>
        <span>${now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      ${monthEvents.length > 0 ? `<div class="hijri-events">
        ${monthEvents.map(ev => `<span class="hijri-event-badge">${ev.d} ${HIJRI_MONTHS[ev.m - 1]} — ${ev.name}</span>`).join('')}
      </div>` : ''}
      <div class="hijri-weekdays">${weekDays.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="hijri-grid">
        ${grid.weeks.map(week => week.map(cell => {
          if (!cell) return '<div class="hijri-cell empty"></div>';
          return `<div class="hijri-cell${cell.isToday ? ' today' : ''}${cell.isImportant ? ' important' : ''}">
            <span class="hijri-day">${cell.day}</span>
            ${cell.importantEvents ? cell.importantEvents.map(ev => `<span class="hijri-event-dot" title="${escapeHtml(ev.name)}"></span>`).join('') : ''}
          </div>`;
        }).join('')).join('')}
      </div>
    `;

    $('#hijriPrev').addEventListener('click', () => {
      state.calendarMonth = hMonth - 1;
      state.calendarYear = hYear;
      renderHijriCalendar();
    });
    $('#hijriNext').addEventListener('click', () => {
      state.calendarMonth = hMonth + 1;
      state.calendarYear = hYear;
      renderHijriCalendar();
    });
  }

  // ===================================================
  // 12. Rendering — Productivity View Routers
  // ===================================================
  function showProductivityView(view) {
    const panels = ['prodDashboard', 'prodTimer', 'prodTimerSettings', 'prodTasks', 'prodHijri'];
    panels.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const panel = el.closest('.prod-panel') || el;
        panel.hidden = id !== view;
        if (panel.classList) panel.classList.toggle('active', id === view);
      }
    });
    // Also show/hide the outer productivity content panels
    $$('.productivity-content > .prod-panel').forEach(p => {
      p.hidden = p.id !== view;
    });
  }

  function renderProductivitySection(section) {
    switch (section) {
      case 'dashboard':
        renderDashboard();
        showProductivityView('prodDashboard');
        break;
      case 'timer':
        renderTimerView();
        showProductivityView('prodTimer');
        break;
      case 'timerSettings':
        renderTimerSettings();
        showProductivityView('prodTimerSettings');
        break;
      case 'tasks':
        renderTaskManager();
        showProductivityView('prodTasks');
        break;
      case 'hijri':
        renderHijriCalendar();
        showProductivityView('prodHijri');
        break;
    }
  }

  // ===================================================
  // 13. Toast Notifications
  // ===================================================
  function showToast(message, type, duration) {
    type = type || 'success';
    duration = duration || 2400;
    const container = document.getElementById('toastContainer') || document.getElementById('prodToastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const iconMap = {
      success: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      warning: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      danger: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    toast.innerHTML = '<span class="toast-icon">' + (iconMap[type] || iconMap.success) + '</span><span>' + message + '</span>';
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('exit');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function dayKeyFromTime(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ===================================================
  // 14. Init
  // ===================================================
  function init() {
    loadState();

    // Ensure SVG defs for timer gradient
    if (!document.getElementById('prodSvgDefs')) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'prodSvgDefs';
      svg.style.position = 'absolute';
      svg.style.width = '0';
      svg.style.height = '0';
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = '<defs><linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#14b88a"/><stop offset="100%" stop-color="#0b7a5f"/></linearGradient></defs>';
      document.body.insertBefore(svg, document.body.firstChild);
    }

    // Set initial timer seconds
    state.timer.seconds = getTimerDuration();

    // Setup clock update interval
    setInterval(() => {
      updateClock();
      const dashEl = $('#dashClock');
      if (dashEl) dashEl.textContent = formatTimeOfDay(new Date());
    }, 10000);

    // Setup navigation in the productivity section
    const prodNavBtns = document.querySelectorAll('.prod-nav-btn');
    prodNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        prodNavBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderProductivitySection(btn.dataset.section);
      });
    });

    // Export API for external calls
    window.ProductivityApp = {
      init: init,
      render: renderProductivitySection,
      showDashboard: () => renderProductivitySection('dashboard'),
      showTimer: () => renderProductivitySection('timer'),
      showTasks: () => renderProductivitySection('tasks'),
      showHijri: () => renderProductivitySection('hijri'),
      setTimerMode: setTimerMode,
      startTimer: startTimer,
      stopTimer: stopTimerInternal,
      resetTimer: resetTimer,
      createTask: createTask,
      getTasks: () => state.tasks,
      getTodaySeconds: getTodayTotalSeconds,
      getSessions: () => state.sessions,
      navigateTo: renderProductivitySection,
      refreshDashboard: renderDashboard,
    };

    // Default to dashboard
    renderProductivitySection('dashboard');
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
