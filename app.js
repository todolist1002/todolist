/**
 * TaskFlow - Smart To-Do List & Productivity Dashboard
 * Application Logic & Supabase Database Integration
 */

(function () {
  'use strict';

  // ==========================================
  // 1. SUPABASE CLIENT & ENVIRONMENT VARIABLES
  // ==========================================

  // Read environment variables (supports window globals and dynamic Vite env)
  let SUPABASE_URL = '';
  let SUPABASE_ANON_KEY = '';

  // 1. Try reading from window globals or Vercel injected config
  if (typeof window !== 'undefined') {
    SUPABASE_URL = window.VITE_SUPABASE_URL || window.ENV?.VITE_SUPABASE_URL || '';
    SUPABASE_ANON_KEY = window.VITE_SUPABASE_ANON_KEY || window.ENV?.VITE_SUPABASE_ANON_KEY || '';
  }

  // 2. Try reading from bundler import.meta.env dynamically
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    try {
      const getEnv = new Function('try { return import.meta.env; } catch(e) { return null; }');
      const env = getEnv();
      if (env) {
        if (!SUPABASE_URL) SUPABASE_URL = env.VITE_SUPABASE_URL || '';
        if (!SUPABASE_ANON_KEY) SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';
      }
    } catch (e) {}
  }

  let supabaseClient = null;

  if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Supabase Client Initialized Successfully!');
    } catch (err) {
      console.warn('⚠️ Supabase init error:', err);
    }
  } else {
    console.log('ℹ️ Supabase environment variables missing. Falling back to LocalStorage.');
  }

  // ==========================================
  // 2. INITIAL STATE & DEFAULT CONFIGURATION
  // ==========================================
  
  const DEFAULT_CATEGORIES = [
    { id: 'work', name: '업무', icon: '💼', color: '#6366f1' },
    { id: 'personal', name: '개인', icon: '🏠', color: '#ec4899' },
    { id: 'study', name: '공부', icon: '📚', color: '#10b981' },
    { id: 'health', name: '건강', icon: '🏋️', color: '#f59e0b' },
    { id: 'other', name: '기타', icon: '💡', color: '#8b5cf6' }
  ];

  const SAMPLE_TASKS = [
    {
      id: 'task-1',
      title: 'TaskFlow 프로젝트 PRD 작성 및 검토',
      description: '요구사항에 맞춘 기능 및 화면 구조 정의서 작성완료',
      category: 'work',
      priority: 'high',
      dueDate: getTodayDateString(),
      dueTime: '18:00',
      completed: true,
      starred: true,
      subtasks: [
        { id: 'sub-1', title: '무엇을 만드는가 정리', completed: true },
        { id: 'sub-2', title: '누가 쓰는가 정의', completed: true },
        { id: 'sub-3', title: '화면 구조 3개 뷰 설계', completed: true }
      ],
      createdAt: Date.now() - 86400000
    },
    {
      id: 'task-2',
      title: 'TaskFlow UI/UX 반응형 웹 구현하기',
      description: '다크모드 글래스모피즘 스타일링 및 대시보드 통계 차트 작업',
      category: 'study',
      priority: 'high',
      dueDate: getTodayDateString(),
      dueTime: '20:00',
      completed: false,
      starred: true,
      subtasks: [
        { id: 'sub-4', title: 'index.html 구조 잡기', completed: true },
        { id: 'sub-5', title: 'styles.css 테마 스타일 추가', completed: true },
        { id: 'sub-6', title: 'Supabase 연동 완료', completed: true }
      ],
      createdAt: Date.now() - 3600000
    },
    {
      id: 'task-3',
      title: '주말 러닝 5km 운동하기',
      description: '체력 증진을 위한 저녁 공원 가벼운 러닝',
      category: 'health',
      priority: 'medium',
      dueDate: getTomorrowDateString(),
      dueTime: '19:30',
      completed: false,
      starred: false,
      subtasks: [],
      createdAt: Date.now()
    }
  ];

  let state = {
    tasks: [],
    categories: [],
    currentView: 'dashboard-view',
    currentFilter: 'all',
    currentCategory: 'all',
    currentSort: 'dueDate',
    searchQuery: '',
    theme: 'dark',
    settings: {
      sound: true,
      overdueHighlight: true
    },
    editingTaskId: null,
    tempSubtasks: []
  };

  // Helper Date String Formatter
  function getTodayDateString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  function getTomorrowDateString() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  // ==========================================
  // 3. DATA PERSISTENCE (SUPABASE + LOCALSTORAGE)
  // ==========================================

  async function loadStateFromStorage() {
    try {
      const storedCategories = localStorage.getItem('taskflow_categories');
      const storedSettings = localStorage.getItem('taskflow_settings');
      const storedTheme = localStorage.getItem('taskflow_theme');

      state.categories = storedCategories ? JSON.parse(storedCategories) : DEFAULT_CATEGORIES;
      if (storedSettings) state.settings = { ...state.settings, ...JSON.parse(storedSettings) };
      if (storedTheme) state.theme = storedTheme;

      // Supabase Table Fetch
      if (supabaseClient) {
        const { data, error } = await supabaseClient.from('todos').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          state.tasks = data.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description || '',
            category: row.category || 'work',
            priority: row.priority || 'medium',
            dueDate: row.due_date || '',
            dueTime: row.due_time || '',
            completed: !!row.completed,
            starred: !!row.starred,
            subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
            createdAt: row.created_at ? Number(row.created_at) : Date.now()
          }));
          console.log(`📡 Fetched ${state.tasks.length} tasks from Supabase 'todos' table.`);
          return;
        } else if (error) {
          console.warn('⚠️ Supabase fetch error (falling back to LocalStorage):', error.message);
        }
      }

      // LocalStorage Fallback
      const storedTasks = localStorage.getItem('taskflow_tasks');
      state.tasks = storedTasks ? JSON.parse(storedTasks) : SAMPLE_TASKS;
    } catch (e) {
      console.error('Failed to load state:', e);
      state.categories = DEFAULT_CATEGORIES;
      state.tasks = SAMPLE_TASKS;
    }
  }

  async function saveTaskToDB(task) {
    // 1. LocalStorage Backup
    try {
      localStorage.setItem('taskflow_tasks', JSON.stringify(state.tasks));
      localStorage.setItem('taskflow_categories', JSON.stringify(state.categories));
      localStorage.setItem('taskflow_settings', JSON.stringify(state.settings));
      localStorage.setItem('taskflow_theme', state.theme);
    } catch (e) {}

    // 2. Supabase DB Upsert
    if (supabaseClient && task) {
      try {
        const { error } = await supabaseClient.from('todos').upsert([{
          id: task.id,
          title: task.title,
          description: task.description || '',
          category: task.category || 'work',
          priority: task.priority || 'medium',
          due_date: task.dueDate || '',
          due_time: task.dueTime || '',
          completed: task.completed,
          starred: task.starred,
          subtasks: task.subtasks || [],
          created_at: task.createdAt || Date.now()
        }]);

        if (error) {
          console.error('❌ Supabase save error:', error.message);
        }
      } catch (err) {
        console.error('❌ Supabase save exception:', err);
      }
    }
  }

  async function deleteTaskFromDB(taskId) {
    try {
      localStorage.setItem('taskflow_tasks', JSON.stringify(state.tasks));
    } catch (e) {}

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('todos').delete().eq('id', taskId);
        if (error) console.error('❌ Supabase delete error:', error.message);
      } catch (err) {
        console.error('❌ Supabase delete exception:', err);
      }
    }
  }

  function saveStateToStorage() {
    try {
      localStorage.setItem('taskflow_tasks', JSON.stringify(state.tasks));
      localStorage.setItem('taskflow_categories', JSON.stringify(state.categories));
      localStorage.setItem('taskflow_settings', JSON.stringify(state.settings));
      localStorage.setItem('taskflow_theme', state.theme);
    } catch (e) {}
  }

  // ==========================================
  // 4. SOUND SYNTHESIZER (WEB AUDIO API)
  // ==========================================

  function playCompletionSound() {
    if (!state.settings.sound) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (err) {}
  }

  // ==========================================
  // 5. UI RENDERERS & VIEW MANAGERS
  // ==========================================

  function applyTheme() {
    const htmlEl = document.documentElement;
    if (state.theme === 'light') {
      htmlEl.classList.remove('dark');
      htmlEl.classList.add('light');
    } else {
      htmlEl.classList.remove('light');
      htmlEl.classList.add('dark');
    }
  }

  function switchView(viewId) {
    state.currentView = viewId;
    
    document.querySelectorAll('.nav-tab').forEach(tab => {
      if (tab.getAttribute('data-view') === viewId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    document.querySelectorAll('.view-section').forEach(sec => {
      if (sec.id === viewId) {
        sec.classList.remove('hidden-view');
        sec.classList.add('active-view');
      } else {
        sec.classList.add('hidden-view');
        sec.classList.remove('active-view');
      }
    });

    if (viewId === 'analytics-view') {
      renderAnalyticsView();
    } else if (viewId === 'settings-view') {
      renderSettingsView();
    }
  }

  function renderCategoryOptions() {
    const filterSelect = document.getElementById('categoryFilter');
    const modalSelect = document.getElementById('modalTaskCategory');

    if (!filterSelect || !modalSelect) return;

    const filterVal = filterSelect.value || 'all';

    filterSelect.innerHTML = '<option value="all">모든 카테고리</option>';
    modalSelect.innerHTML = '';

    state.categories.forEach(cat => {
      const filterOpt = document.createElement('option');
      filterOpt.value = cat.id;
      filterOpt.textContent = `${cat.icon} ${cat.name}`;
      filterSelect.appendChild(filterOpt);

      const modalOpt = document.createElement('option');
      modalOpt.value = cat.id;
      modalOpt.textContent = `${cat.icon} ${cat.name}`;
      modalSelect.appendChild(modalOpt);
    });

    filterSelect.value = filterVal;
  }

  function renderDashboard() {
    renderStatsSummary();
    renderFilteredTaskList();
  }

  function renderStatsSummary() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const todayStr = getTodayDateString();
    const todayCount = state.tasks.filter(t => t.dueDate === todayStr && !t.completed).length;

    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statCompleted').textContent = completed;
    document.getElementById('statToday').textContent = todayCount;

    document.getElementById('progressText').textContent = `${percent}%`;
    document.getElementById('progressFill').style.width = `${percent}%`;
  }

  function getFilteredAndSortedTasks() {
    let result = [...state.tasks];

    if (state.searchQuery.trim() !== '') {
      const q = state.searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        (t.description && t.description.toLowerCase().includes(q))
      );
    }

    const todayStr = getTodayDateString();
    if (state.currentFilter === 'pending') {
      result = result.filter(t => !t.completed);
    } else if (state.currentFilter === 'completed') {
      result = result.filter(t => t.completed);
    } else if (state.currentFilter === 'today') {
      result = result.filter(t => t.dueDate === todayStr);
    } else if (state.currentFilter === 'starred') {
      result = result.filter(t => t.starred);
    }

    if (state.currentCategory !== 'all') {
      result = result.filter(t => t.category === state.currentCategory);
    }

    result.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      if (state.currentSort === 'priority') {
        const priorityScore = { high: 3, medium: 2, low: 1 };
        return priorityScore[b.priority] - priorityScore[a.priority];
      } else if (state.currentSort === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      } else if (state.currentSort === 'newest') {
        return b.createdAt - a.createdAt;
      } else if (state.currentSort === 'alphabetical') {
        return a.title.localeCompare(b.title, 'ko');
      }
      return 0;
    });

    return result;
  }

  function renderFilteredTaskList() {
    const listContainer = document.getElementById('taskList');
    const emptyState = document.getElementById('emptyState');
    const filteredTasks = getFilteredAndSortedTasks();

    if (filteredTasks.length === 0) {
      listContainer.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    listContainer.innerHTML = '';

    filteredTasks.forEach(task => {
      const cardEl = createTaskCardElement(task);
      listContainer.appendChild(cardEl);
    });
  }

  function createTaskCardElement(task) {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority} ${task.completed ? 'completed' : ''}`;
    card.setAttribute('data-id', task.id);

    const cat = state.categories.find(c => c.id === task.category) || { name: '기타', icon: '💡', color: '#8b5cf6' };

    let dueBadgeHtml = '';
    if (task.dueDate) {
      const todayStr = getTodayDateString();
      let dueClass = 'badge-due';
      let dueText = task.dueDate;

      if (task.dueDate === todayStr) {
        dueClass += ' due-today';
        dueText = `오늘 마감 ${task.dueTime ? task.dueTime : ''}`;
      } else if (task.dueDate < todayStr && !task.completed) {
        dueClass += ' due-overdue';
        dueText = `마감 초과 (${task.dueDate})`;
      } else {
        dueText = `${task.dueDate} ${task.dueTime ? task.dueTime : ''}`;
      }

      dueBadgeHtml = `<span class="badge ${dueClass}"><i class="fa-regular fa-clock"></i> ${dueText}</span>`;
    }

    const priorityMap = { high: '🔥 높음', medium: '⚡ 보통', low: '🌱 낮음' };

    let subtasksHtml = '';
    if (task.subtasks && task.subtasks.length > 0) {
      const completedSub = task.subtasks.filter(s => s.completed).length;
      subtasksHtml = `
        <div class="task-subtasks-box">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
            체크리스트 (${completedSub}/${task.subtasks.length})
          </div>
          ${task.subtasks.map(s => `
            <div class="subtask-item ${s.completed ? 'completed' : ''}">
              <input type="checkbox" class="subtask-checkbox" data-taskid="${task.id}" data-subid="${s.id}" ${s.completed ? 'checked' : ''}>
              <span>${escapeHtml(s.title)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="task-main-row">
        <label class="task-checkbox-wrapper">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
          <i class="fa-solid fa-check checkbox-check-icon"></i>
        </label>

        <div class="task-content">
          <div class="task-header-row">
            <span class="task-title">${escapeHtml(task.title)}</span>
          </div>

          ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}

          <div class="task-badges-row">
            <span class="badge badge-category" style="border-left: 3px solid ${cat.color};">
              ${cat.icon} ${cat.name}
            </span>
            <span class="badge badge-priority-${task.priority}">
              ${priorityMap[task.priority]}
            </span>
            ${dueBadgeHtml}
          </div>

          ${subtasksHtml}
        </div>

        <div class="task-actions">
          <button class="action-icon-btn action-star ${task.starred ? 'starred' : ''}" title="중요 표시 토글">
            <i class="${task.starred ? 'fa-solid' : 'fa-regular'} fa-star"></i>
          </button>
          <button class="action-icon-btn action-edit" title="수정">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="action-icon-btn action-duplicate" title="복사">
            <i class="fa-regular fa-copy"></i>
          </button>
          <button class="action-icon-btn action-delete" title="삭제">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;

    const checkbox = card.querySelector('.task-checkbox');
    checkbox.addEventListener('change', () => toggleTaskComplete(task.id));

    const starBtn = card.querySelector('.action-star');
    starBtn.addEventListener('click', () => toggleTaskStarred(task.id));

    const editBtn = card.querySelector('.action-edit');
    editBtn.addEventListener('click', () => openTaskEditModal(task.id));

    const dupBtn = card.querySelector('.action-duplicate');
    dupBtn.addEventListener('click', () => duplicateTask(task.id));

    const delBtn = card.querySelector('.action-delete');
    delBtn.addEventListener('click', () => deleteTask(task.id));

    card.querySelectorAll('.subtask-checkbox').forEach(sb => {
      sb.addEventListener('change', (e) => {
        const taskId = e.target.getAttribute('data-taskid');
        const subId = e.target.getAttribute('data-subid');
        toggleSubtaskComplete(taskId, subId);
      });
    });

    return card;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }

  // ==========================================
  // 6. TASK ACTIONS (ADD, EDIT, DELETE, TOGGLE)
  // ==========================================

  async function addQuickTask(title) {
    if (!title.trim()) return;

    const newTask = {
      id: 'task-' + Date.now(),
      title: title.trim(),
      description: '',
      category: 'work',
      priority: 'medium',
      dueDate: getTodayDateString(),
      dueTime: '',
      completed: false,
      starred: false,
      subtasks: [],
      createdAt: Date.now()
    };

    state.tasks.unshift(newTask);
    renderDashboard();
    await saveTaskToDB(newTask);
    showToast('새 할 일이 저장되었습니다!');
  }

  async function toggleTaskComplete(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      if (task.completed) playCompletionSound();
      renderDashboard();
      await saveTaskToDB(task);
    }
  }

  async function toggleTaskStarred(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
      task.starred = !task.starred;
      renderDashboard();
      await saveTaskToDB(task);
    }
  }

  async function toggleSubtaskComplete(taskId, subId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task && task.subtasks) {
      const sub = task.subtasks.find(s => s.id === subId);
      if (sub) {
        sub.completed = !sub.completed;
        renderDashboard();
        await saveTaskToDB(task);
      }
    }
  }

  async function deleteTask(taskId) {
    if (confirm('이 할 일을 삭제하시겠습니까?')) {
      state.tasks = state.tasks.filter(t => t.id !== taskId);
      renderDashboard();
      await deleteTaskFromDB(taskId);
      showToast('할 일이 삭제되었습니다.');
    }
  }

  async function duplicateTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
      const dup = {
        ...JSON.parse(JSON.stringify(task)),
        id: 'task-' + Date.now(),
        title: `${task.title} (복사본)`,
        completed: false,
        createdAt: Date.now()
      };
      state.tasks.unshift(dup);
      renderDashboard();
      await saveTaskToDB(dup);
      showToast('할 일이 복사되었습니다.');
    }
  }

  async function clearCompletedTasks() {
    const completedTasks = state.tasks.filter(t => t.completed);
    if (completedTasks.length === 0) {
      showToast('완료된 할 일이 없습니다.');
      return;
    }
    if (confirm(`완료된 할 일 ${completedTasks.length}개를 모두 정리하시겠습니까?`)) {
      for (const t of completedTasks) {
        await deleteTaskFromDB(t.id);
      }
      state.tasks = state.tasks.filter(t => !t.completed);
      renderDashboard();
      showToast('완료된 항목이 정리되었습니다.');
    }
  }

  // ==========================================
  // 7. MODAL MANAGEMENT (TASK EDIT / ADD)
  // ==========================================

  function openTaskCreateModal() {
    state.editingTaskId = null;
    state.tempSubtasks = [];

    document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-plus-circle"></i> 새 할 일 작성';
    document.getElementById('modalTaskId').value = '';
    document.getElementById('modalTaskTitle').value = '';
    document.getElementById('modalTaskDescription').value = '';
    document.getElementById('modalTaskCategory').value = state.categories[0]?.id || 'work';
    document.getElementById('modalTaskPriority').value = 'medium';
    document.getElementById('modalTaskDueDate').value = getTodayDateString();
    document.getElementById('modalTaskDueTime').value = '';
    document.getElementById('modalTaskStarred').checked = false;

    renderSubtasksInModal();
    document.getElementById('taskModal').classList.remove('hidden');
    document.getElementById('modalTaskTitle').focus();
  }

  function openTaskEditModal(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    state.editingTaskId = taskId;
    state.tempSubtasks = JSON.parse(JSON.stringify(task.subtasks || []));

    document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> 할 일 수정';
    document.getElementById('modalTaskId').value = task.id;
    document.getElementById('modalTaskTitle').value = task.title;
    document.getElementById('modalTaskDescription').value = task.description || '';
    document.getElementById('modalTaskCategory').value = task.category || 'work';
    document.getElementById('modalTaskPriority').value = task.priority || 'medium';
    document.getElementById('modalTaskDueDate').value = task.dueDate || '';
    document.getElementById('modalTaskDueTime').value = task.dueTime || '';
    document.getElementById('modalTaskStarred').checked = !!task.starred;

    renderSubtasksInModal();
    document.getElementById('taskModal').classList.remove('hidden');
  }

  function closeTaskModal() {
    document.getElementById('taskModal').classList.add('hidden');
  }

  function renderSubtasksInModal() {
    const container = document.getElementById('subtasksContainer');
    container.innerHTML = '';

    state.tempSubtasks.forEach((sub, idx) => {
      const item = document.createElement('div');
      item.className = 'subtask-modal-item';
      item.innerHTML = `
        <span>${escapeHtml(sub.title)}</span>
        <button type="button" class="action-icon-btn action-delete" onclick="removeTempSubtask(${idx})">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;
      container.appendChild(item);
    });
  }

  window.removeTempSubtask = function(index) {
    state.tempSubtasks.splice(index, 1);
    renderSubtasksInModal();
  };

  function addTempSubtask() {
    const input = document.getElementById('newSubtaskInput');
    const val = input.value.trim();
    if (val) {
      state.tempSubtasks.push({
        id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        title: val,
        completed: false
      });
      input.value = '';
      renderSubtasksInModal();
    }
  }

  async function saveTaskModalForm(e) {
    e.preventDefault();
    const title = document.getElementById('modalTaskTitle').value.trim();
    if (!title) return;

    const desc = document.getElementById('modalTaskDescription').value.trim();
    const cat = document.getElementById('modalTaskCategory').value;
    const prio = document.getElementById('modalTaskPriority').value;
    const dueDate = document.getElementById('modalTaskDueDate').value;
    const dueTime = document.getElementById('modalTaskDueTime').value;
    const starred = document.getElementById('modalTaskStarred').checked;

    let targetTask = null;

    if (state.editingTaskId) {
      targetTask = state.tasks.find(t => t.id === state.editingTaskId);
      if (targetTask) {
        targetTask.title = title;
        targetTask.description = desc;
        targetTask.category = cat;
        targetTask.priority = prio;
        targetTask.dueDate = dueDate;
        targetTask.dueTime = dueTime;
        targetTask.starred = starred;
        targetTask.subtasks = state.tempSubtasks;
      }
      showToast('할 일이 수정되었습니다.');
    } else {
      targetTask = {
        id: 'task-' + Date.now(),
        title,
        description: desc,
        category: cat,
        priority: prio,
        dueDate,
        dueTime,
        completed: false,
        starred,
        subtasks: state.tempSubtasks,
        createdAt: Date.now()
      };
      state.tasks.unshift(targetTask);
      showToast('새 할 일이 저장되었습니다.');
    }

    closeTaskModal();
    renderDashboard();
    await saveTaskToDB(targetTask);
  }

  // ==========================================
  // 8. VIEW 2: ANALYTICS & STATS LOGIC
  // ==========================================

  function renderAnalyticsView() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('analyticsPercent').textContent = `${percent}%`;
    document.getElementById('analyticsCompleted').textContent = completed;
    document.getElementById('analyticsPending').textContent = pending;

    const donutCircle = document.getElementById('donutProgress');
    const circumference = 2 * Math.PI * 70;
    const offset = circumference - (percent / 100) * circumference;
    donutCircle.style.strokeDashoffset = offset;

    const high = state.tasks.filter(t => t.priority === 'high').length;
    const med = state.tasks.filter(t => t.priority === 'medium').length;
    const low = state.tasks.filter(t => t.priority === 'low').length;

    document.getElementById('pCountHigh').textContent = `${high}개`;
    document.getElementById('pCountMedium').textContent = `${med}개`;
    document.getElementById('pCountLow').textContent = `${low}개`;

    const catBarsContainer = document.getElementById('categoryBars');
    catBarsContainer.innerHTML = '';

    state.categories.forEach(cat => {
      const catTasks = state.tasks.filter(t => t.category === cat.id);
      const catCompleted = catTasks.filter(t => t.completed).length;
      const catPercent = catTasks.length > 0 ? Math.round((catCompleted / catTasks.length) * 100) : 0;

      const item = document.createElement('div');
      item.className = 'cat-bar-item';
      item.innerHTML = `
        <div class="cat-bar-header">
          <span>${cat.icon} ${cat.name} (${catCompleted}/${catTasks.length})</span>
          <span>${catPercent}%</span>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width: ${catPercent}%; background: ${cat.color};"></div>
        </div>
      `;
      catBarsContainer.appendChild(item);
    });

    const streak = completed > 0 ? Math.min(completed, 7) : 0;
    document.getElementById('streakDays').textContent = streak;

    if (streak >= 3) document.getElementById('badge3d').classList.add('active');
    else document.getElementById('badge3d').classList.remove('active');

    if (streak >= 7) document.getElementById('badge7d').classList.add('active');
    else document.getElementById('badge7d').classList.remove('active');
  }

  // ==========================================
  // 9. VIEW 3: SETTINGS & CATEGORY MANAGER
  // ==========================================

  function renderSettingsView() {
    renderCategoryManagerList();
    document.getElementById('soundToggle').checked = state.settings.sound;
    document.getElementById('overdueHighlightToggle').checked = state.settings.overdueHighlight;
  }

  function renderCategoryManagerList() {
    const list = document.getElementById('categoryManagerList');
    if (!list) return;
    list.innerHTML = '';

    state.categories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'cat-mgr-item';
      item.innerHTML = `
        <div class="cat-mgr-left">
          <span class="cat-color-dot" style="background: ${cat.color};"></span>
          <span>${cat.icon} ${cat.name}</span>
        </div>
        ${state.categories.length > 1 ? `
          <button class="action-icon-btn action-delete" onclick="deleteCategory('${cat.id}')" title="삭제">
            <i class="fa-solid fa-trash"></i>
          </button>
        ` : ''}
      `;
      list.appendChild(item);
    });
  }

  window.deleteCategory = function(catId) {
    if (confirm('이 카테고리를 삭제하시겠습니까? 관련된 할 일은 기타로 변경됩니다.')) {
      state.categories = state.categories.filter(c => c.id !== catId);
      state.tasks.forEach(t => {
        if (t.category === catId) t.category = 'other';
      });
      saveStateToStorage();
      renderCategoryOptions();
      renderSettingsView();
      showToast('카테고리가 삭제되었습니다.');
    }
  };

  function openAddCategoryModal() {
    document.getElementById('newCatName').value = '';
    document.getElementById('newCatIcon').value = '📌';
    document.getElementById('categoryModal').classList.remove('hidden');
  }

  function closeCategoryModal() {
    document.getElementById('categoryModal').classList.add('hidden');
  }

  function saveCategoryForm(e) {
    e.preventDefault();
    const name = document.getElementById('newCatName').value.trim();
    const icon = document.getElementById('newCatIcon').value.trim() || '📌';
    const colorEl = document.querySelector('input[name="catColor"]:checked');
    const color = colorEl ? colorEl.value : '#6366f1';

    if (!name) return;

    const newCat = {
      id: 'cat-' + Date.now(),
      name,
      icon,
      color
    };

    state.categories.push(newCat);
    saveStateToStorage();
    renderCategoryOptions();
    closeCategoryModal();
    renderSettingsView();
    showToast('새 카테고리가 추가되었습니다!');
  }

  function exportData() {
    const data = {
      tasks: state.tasks,
      categories: state.categories,
      exportedAt: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TaskFlow_Backup_${getTodayDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('데이터가 파일로 백업되었습니다.');
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (evt) {
      try {
        const imported = JSON.parse(evt.target.result);
        if (imported.tasks && Array.isArray(imported.tasks)) {
          state.tasks = imported.tasks;
          for (const t of state.tasks) {
            await saveTaskToDB(t);
          }
        }
        if (imported.categories && Array.isArray(imported.categories)) {
          state.categories = imported.categories;
        }
        saveStateToStorage();
        renderCategoryOptions();
        renderDashboard();
        showToast('데이터가 정상적으로 불러와졌습니다!');
      } catch (err) {
        alert('올바르지 않은 JSON 파일입니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function resetAllData() {
    if (confirm('경고: 모든 할 일 및 데이터가 삭제됩니다. 계속하시겠습니까?')) {
      if (supabaseClient) {
        for (const t of state.tasks) {
          await deleteTaskFromDB(t.id);
        }
      }
      state.tasks = [];
      state.categories = DEFAULT_CATEGORIES;
      saveStateToStorage();
      renderCategoryOptions();
      renderDashboard();
      showToast('전체 데이터가 초기화되었습니다.');
    }
  }

  async function loadSampleData() {
    state.tasks = SAMPLE_TASKS;
    state.categories = DEFAULT_CATEGORIES;
    saveStateToStorage();
    if (supabaseClient) {
      for (const t of SAMPLE_TASKS) {
        await saveTaskToDB(t);
      }
    }
    renderCategoryOptions();
    renderDashboard();
    showToast('샘플 데이터가 로드되었습니다.');
  }

  function showToast(msg) {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = msg;
    toast.classList.remove('hidden');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }

  // ==========================================
  // 10. EVENT LISTENERS SETUP
  // ==========================================

  function initEventListeners() {
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      saveStateToStorage();
    });

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const viewId = tab.getAttribute('data-view');
        switchView(viewId);
      });
    });

    document.getElementById('quickTaskForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('quickTaskTitle');
      addQuickTask(input.value);
      input.value = '';
    });

    document.getElementById('openDetailModalBtn').addEventListener('click', openTaskCreateModal);
    document.getElementById('closeTaskModalBtn').addEventListener('click', closeTaskModal);
    document.getElementById('cancelTaskModalBtn').addEventListener('click', closeTaskModal);
    document.getElementById('taskDetailForm').addEventListener('submit', saveTaskModalForm);

    document.getElementById('addSubtaskBtn').addEventListener('click', addTempSubtask);
    document.getElementById('newSubtaskInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTempSubtask();
      }
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentFilter = btn.getAttribute('data-filter');
        renderFilteredTaskList();
      });
    });

    document.getElementById('categoryFilter').addEventListener('change', (e) => {
      state.currentCategory = e.target.value;
      renderFilteredTaskList();
    });

    document.getElementById('sortSelect').addEventListener('change', (e) => {
      state.currentSort = e.target.value;
      renderFilteredTaskList();
    });

    document.getElementById('clearCompletedBtn').addEventListener('click', clearCompletedTasks);

    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderFilteredTaskList();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInput.focus();
      }
    });

    document.getElementById('addCategoryBtn').addEventListener('click', openAddCategoryModal);
    document.getElementById('closeCategoryModalBtn').addEventListener('click', closeCategoryModal);
    document.getElementById('cancelCategoryModalBtn').addEventListener('click', closeCategoryModal);
    document.getElementById('categoryForm').addEventListener('submit', saveCategoryForm);

    document.getElementById('soundToggle').addEventListener('change', (e) => {
      state.settings.sound = e.target.checked;
      saveStateToStorage();
    });

    document.getElementById('overdueHighlightToggle').addEventListener('change', (e) => {
      state.settings.overdueHighlight = e.target.checked;
      saveStateToStorage();
    });

    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('importFileInput').addEventListener('change', importData);
    document.getElementById('resetDataBtn').addEventListener('click', resetAllData);
    document.getElementById('loadSampleDataBtn').addEventListener('click', loadSampleData);
  }

  // ==========================================
  // 11. APP INITIALIZATION
  // ==========================================

  async function initApp() {
    await loadStateFromStorage();
    applyTheme();
    renderCategoryOptions();
    initEventListeners();
    renderDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
