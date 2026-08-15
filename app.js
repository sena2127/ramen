/**
 * SmartKakeibo - カレンダー家計簿アプリケーション コアスクリプト
 */

// ==========================================
// 1. 定数・カテゴリ定義・初期設定
// ==========================================

const STORAGE_KEY_RECORDS = 'smartkakeibo_records_v3';
const STORAGE_KEY_THEME = 'smartkakeibo_theme_v3';

// 支出カテゴリマスター
const EXPENSE_CATEGORIES = [
  { id: 'food', name: '食費', icon: 'fa-utensils', color: '#f59e0b' },
  { id: 'daily', name: '日用品', icon: 'fa-basket-shopping', color: '#06b6d4' },
  { id: 'housing', name: '住居費', icon: 'fa-house', color: '#3b82f6' },
  { id: 'utilities', name: '水道光熱費', icon: 'fa-bolt', color: '#eab308' },
  { id: 'transport', name: '交通費', icon: 'fa-train-subway', color: '#6366f1' },
  { id: 'entertainment', name: '交際・外食', icon: 'fa-champagne-glasses', color: '#ec4899' },
  { id: 'hobby', name: '趣味・娯楽', icon: 'fa-gamepad', color: '#8b5cf6' },
  { id: 'health', name: '医療・健康', icon: 'fa-heart-pulse', color: '#ef4444' },
  { id: 'clothing', name: '衣服・美容', icon: 'fa-shirt', color: '#14b8a6' },
  { id: 'education', name: '教育・教養', icon: 'fa-book-open', color: '#0284c7' },
  { id: 'communication', name: '通信費', icon: 'fa-wifi', color: '#64748b' },
  { id: 'other_exp', name: 'その他支出', icon: 'fa-ellipsis', color: '#94a3b8' }
];

// 収入カテゴリマスター
const INCOME_CATEGORIES = [
  { id: 'salary', name: '給与収入', icon: 'fa-briefcase', color: '#10b981' },
  { id: 'bonus', name: '賞与・ボーナス', icon: 'fa-gift', color: '#059669' },
  { id: 'side_job', name: '副業・事業', icon: 'fa-laptop-code', color: '#14b8a6' },
  { id: 'investment', name: '投資・配当', icon: 'fa-arrow-trend-up', color: '#0284c7' },
  { id: 'other_inc', name: '臨時収入・他', icon: 'fa-coins', color: '#6366f1' }
];

// 支払方法マスター
const PAYMENT_METHODS = {
  'credit': { name: 'クレジットカード', icon: 'fa-credit-card' },
  'e-money': { name: '電子マネー/QR', icon: 'fa-mobile-screen-button' },
  'cash': { name: '現金', icon: 'fa-money-bill-wave' },
  'bank': { name: '銀行引落/振込', icon: 'fa-building-columns' },
  'other': { name: 'その他', icon: 'fa-tag' }
};

// ==========================================
// 2. アプリケーション状態 (State)
// ==========================================

const AppState = {
  currentMonth: getCurrentYearMonth(), // "YYYY-MM"
  selectedDate: getTodayDateString(),  // "YYYY-MM-DD"
  currentTab: 'calendar',
  records: [],
  activeEditingId: null,
  charts: {
    categoryDonut: null,
    monthlyTrend: null,
    paymentMethod: null
  },
  filters: {
    query: '',
    type: 'all',
    category: 'all',
    payment: 'all',
    sort: 'date-desc'
  }
};

// ==========================================
// 3. ユーティリティ関数
// ==========================================

function getCurrentYearMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString('ja-JP');
}

function getCategoryInfo(categoryId, type = 'expense') {
  const pool = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const found = pool.find(c => c.id === categoryId);
  if (found) return found;

  const allPool = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const anyFound = allPool.find(c => c.id === categoryId);
  if (anyFound) return anyFound;

  return { id: categoryId, name: '未分類', icon: 'fa-circle-question', color: '#94a3b8' };
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconHtml = '<i class="fa-solid fa-circle-info"></i>';
  if (type === 'success') iconHtml = '<i class="fa-solid fa-circle-check"></i>';
  if (type === 'error') iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';

  toast.innerHTML = `${iconHtml}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================================
// 4. データストア層 (LocalStorage)
// ==========================================

function loadStateFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
    if (raw) {
      AppState.records = JSON.parse(raw);
    } else {
      AppState.records = generateSampleRecords();
      saveRecordsToStorage();
    }
  } catch (e) {
    console.error('Storage error:', e);
    AppState.records = [];
  }
}

function saveRecordsToStorage() {
  localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(AppState.records));
}

function generateSampleRecords() {
  const currentYM = getCurrentYearMonth();
  const [curYear, curMonth] = currentYM.split('-').map(Number);
  const samples = [];
  const addDays = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  for (let offset = -2; offset <= 0; offset++) {
    let year = curYear;
    let month = curMonth + offset;
    if (month < 1) {
      month += 12;
      year -= 1;
    }

    // 収入: 給与
    samples.push({
      id: 'sample_' + Math.random().toString(36).substr(2, 9),
      type: 'income',
      amount: 320000,
      category: 'salary',
      date: addDays(year, month, 25),
      payment: 'bank',
      note: '月給手取り',
      isFixed: true,
      createdAt: new Date().toISOString()
    });

    if (month % 2 === 0) {
      samples.push({
        id: 'sample_' + Math.random().toString(36).substr(2, 9),
        type: 'income',
        amount: 35000,
        category: 'side_job',
        date: addDays(year, month, 15),
        payment: 'bank',
        note: '副業案件報酬',
        isFixed: false,
        createdAt: new Date().toISOString()
      });
    }

    // 固定支出
    samples.push({
      id: 'sample_' + Math.random().toString(36).substr(2, 9),
      type: 'expense',
      amount: 75000,
      category: 'housing',
      date: addDays(year, month, 27),
      payment: 'bank',
      note: '家賃',
      isFixed: true,
      createdAt: new Date().toISOString()
    });

    samples.push({
      id: 'sample_' + Math.random().toString(36).substr(2, 9),
      type: 'expense',
      amount: 12400,
      category: 'utilities',
      date: addDays(year, month, 20),
      payment: 'credit',
      note: '電気・ガス・水道代',
      isFixed: true,
      createdAt: new Date().toISOString()
    });

    samples.push({
      id: 'sample_' + Math.random().toString(36).substr(2, 9),
      type: 'expense',
      amount: 6800,
      category: 'communication',
      date: addDays(year, month, 18),
      payment: 'credit',
      note: 'スマホ・光回線料金',
      isFixed: true,
      createdAt: new Date().toISOString()
    });

    // 日常支出
    const dailyList = [
      { d: 2, amt: 4800, cat: 'food', note: 'スーパー週末まとめ買い', pay: 'credit' },
      { d: 5, amt: 1200, cat: 'food', note: 'ランチ定食', pay: 'e-money' },
      { d: 6, amt: 3400, cat: 'daily', note: '日用品・洗剤買い足し', pay: 'credit' },
      { d: 8, amt: 3500, cat: 'food', note: '食材調達', pay: 'credit' },
      { d: 10, amt: 5000, cat: 'transport', note: '交通系ICチャージ', pay: 'e-money' },
      { d: 11, amt: 980, cat: 'food', note: 'カフェ休憩', pay: 'e-money' },
      { d: 12, amt: 7500, cat: 'entertainment', note: '友人とのディナー', pay: 'credit' },
      { d: 14, amt: 5200, cat: 'food', note: 'スーパー食材まとめ買い', pay: 'credit' },
      { d: 16, amt: 3980, cat: 'hobby', note: '書籍＆映画', pay: 'credit' },
      { d: 17, amt: 2400, cat: 'food', note: 'デリバリー夕食', pay: 'e-money' },
      { d: 21, amt: 4100, cat: 'food', note: '週末買い出し', pay: 'credit' },
      { d: 24, amt: 1500, cat: 'food', note: 'ベーカリー＆カフェ', pay: 'cash' },
      { d: 28, amt: 6400, cat: 'food', note: 'スーパー食材', pay: 'credit' }
    ];

    dailyList.forEach(item => {
      samples.push({
        id: 'sample_' + Math.random().toString(36).substr(2, 9),
        type: 'expense',
        amount: item.amt,
        category: item.cat,
        date: addDays(year, month, item.d),
        payment: item.pay,
        note: item.note,
        isFixed: false,
        createdAt: new Date().toISOString()
      });
    });
  }

  return samples;
}

// ==========================================
// 5. 集計計算ロジック
// ==========================================

function getMonthRecords(yearMonth = AppState.currentMonth) {
  return AppState.records.filter(r => r.date && r.date.startsWith(yearMonth));
}

function calculateMonthSummary(yearMonth = AppState.currentMonth) {
  const records = getMonthRecords(yearMonth);
  let totalIncome = 0;
  let totalExpense = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  const categoryExpenses = {};
  const paymentBreakdown = {};
  const dailyData = {}; // { "YYYY-MM-DD": { expense: 0, income: 0, count: 0 } }

  records.forEach(r => {
    const amt = Number(r.amount) || 0;
    const d = r.date;
    if (!dailyData[d]) dailyData[d] = { expense: 0, income: 0, count: 0 };

    if (r.type === 'income') {
      totalIncome += amt;
      incomeCount++;
      dailyData[d].income += amt;
      dailyData[d].count++;
    } else {
      totalExpense += amt;
      expenseCount++;
      dailyData[d].expense += amt;
      dailyData[d].count++;

      categoryExpenses[r.category] = (categoryExpenses[r.category] || 0) + amt;
      const pay = r.payment || 'other';
      paymentBreakdown[pay] = (paymentBreakdown[pay] || 0) + amt;
    }
  });

  const balance = totalIncome - totalExpense;
  const savingRate = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0;

  return {
    yearMonth,
    records,
    totalIncome,
    totalExpense,
    balance,
    incomeCount,
    expenseCount,
    savingRate,
    categoryExpenses,
    paymentBreakdown,
    dailyData
  };
}

// ==========================================
// 6. UI レンダリング
// ==========================================

function renderAll() {
  updatePeriodHeader();
  renderSummaryCards();
  renderCalendar();
  renderSelectedDayDetails();
  renderRecordsList();
  renderAnalytics();
  renderSettingsCategoryList();
}

function updatePeriodHeader() {
  const [y, m] = AppState.currentMonth.split('-');
  const title = `${y}年 ${Number(m)}月`;

  document.getElementById('displayPeriodTitle').textContent = title;
  document.getElementById('mobileMonthLabel').textContent = `${Number(m)}月`;
  document.getElementById('globalMonthPicker').value = AppState.currentMonth;
}

function renderSummaryCards() {
  const summary = calculateMonthSummary(AppState.currentMonth);

  document.getElementById('summaryIncomeAmount').textContent = formatCurrency(summary.totalIncome);
  document.getElementById('summaryExpenseAmount').textContent = formatCurrency(summary.totalExpense);
  document.getElementById('summaryBalanceAmount').textContent = formatCurrency(summary.balance);

  document.getElementById('incomeCountBadge').textContent = `${summary.incomeCount} 件の収入`;

  const [y, m] = AppState.currentMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dailyAvg = Math.round(summary.totalExpense / daysInMonth);
  document.getElementById('expenseDailyAvg').textContent = `1日平均: ¥${formatCurrency(dailyAvg)}`;

  const savingRateEl = document.getElementById('summarySavingRate');
  savingRateEl.textContent = `貯蓄率: ${summary.savingRate}%`;
  savingRateEl.className = summary.balance >= 0 ? 'meta-badge status-positive' : 'meta-badge status-negative';
}

// ==========================================
// 7. カレンダー描画エンジン (Core)
// ==========================================

function renderCalendar() {
  const grid = document.getElementById('calendarDaysGrid');
  if (!grid) return;

  grid.innerHTML = '';

  const [year, month] = AppState.currentMonth.split('-').map(Number);
  const summary = calculateMonthSummary(AppState.currentMonth);
  const todayStr = getTodayDateString();

  // 当月1日の曜日 (0:日〜6:土)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  // 当月の日数
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  // 前月の日数
  const prevMonthTotalDays = new Date(year, month - 1, 0).getDate();

  // 1. 前月の余白セル
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    let prevM = month - 1;
    let prevY = year;
    if (prevM < 1) { prevM = 12; prevY -= 1; }
    const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayOfWeek = (firstDayOfWeek - 1 - i + 7) % 7;

    const cell = createCalendarCell({
      dayNum,
      dateStr,
      dayOfWeek,
      isOtherMonth: true,
      summary
    });
    grid.appendChild(cell);
  }

  // 2. 当月の日付セル
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === AppState.selectedDate;

    const cell = createCalendarCell({
      dayNum: d,
      dateStr,
      dayOfWeek,
      isToday,
      isSelected,
      isOtherMonth: false,
      summary
    });
    grid.appendChild(cell);
  }

  // 3. 翌月の余白セル (合計マス数が7の倍数になるよう調整)
  const currentTotalCells = firstDayOfWeek + totalDaysInMonth;
  const nextMonthCells = (7 - (currentTotalCells % 7)) % 7;

  for (let d = 1; d <= nextMonthCells; d++) {
    let nextM = month + 1;
    let nextY = year;
    if (nextM > 12) { nextM = 1; nextY += 1; }
    const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = (currentTotalCells + d - 1) % 7;

    const cell = createCalendarCell({
      dayNum: d,
      dateStr,
      dayOfWeek,
      isOtherMonth: true,
      summary
    });
    grid.appendChild(cell);
  }
}

function createCalendarCell({ dayNum, dateStr, dayOfWeek, isToday, isSelected, isOtherMonth, summary }) {
  const cell = document.createElement('div');
  cell.className = 'cal-day-cell';
  if (dayOfWeek === 0) cell.classList.add('sun');
  if (dayOfWeek === 6) cell.classList.add('sat');
  if (isOtherMonth) cell.classList.add('other-month');
  if (isToday) cell.classList.add('today');
  if (isSelected) cell.classList.add('selected');
  cell.dataset.date = dateStr;

  const dayData = summary.dailyData[dateStr] || { expense: 0, income: 0, count: 0 };

  let amountsHtml = '';
  if (dayData.income > 0) {
    amountsHtml += `<span class="cal-amt-row cal-amt-income">+¥${formatCurrency(dayData.income)}</span>`;
  }
  if (dayData.expense > 0) {
    amountsHtml += `<span class="cal-amt-row cal-amt-expense">-¥${formatCurrency(dayData.expense)}</span>`;
  }

  cell.innerHTML = `
    <div class="cal-day-header">
      <span class="cal-day-num">${dayNum}</span>
      ${dayData.count > 0 ? `<span class="cal-day-badge-count">${dayData.count}件</span>` : ''}
    </div>
    <div class="cal-day-amounts">
      ${amountsHtml}
    </div>
  `;

  cell.addEventListener('click', () => {
    selectCalendarDate(dateStr);
  });

  return cell;
}

function selectCalendarDate(dateStr) {
  AppState.selectedDate = dateStr;

  // カレンダーマスの選択クラスを更新
  document.querySelectorAll('.cal-day-cell').forEach(c => {
    if (c.dataset.date === dateStr) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });

  renderSelectedDayDetails();
}

function renderSelectedDayDetails() {
  const label = document.getElementById('selectedDateLabel');
  const summaryEl = document.getElementById('selectedDateSummary');
  const list = document.getElementById('selectedDateTxList');
  const empty = document.getElementById('selectedDateEmptyState');
  if (!label || !list || !empty) return;

  const dateObj = new Date(AppState.selectedDate);
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
  label.textContent = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日 (${dayOfWeek})`;

  const dayRecords = AppState.records.filter(r => r.date === AppState.selectedDate);
  let expSum = 0;
  let incSum = 0;

  dayRecords.forEach(r => {
    if (r.type === 'income') incSum += Number(r.amount);
    else expSum += Number(r.amount);
  });

  summaryEl.innerHTML = `支出 <strong style="color:var(--expense-main);">¥${formatCurrency(expSum)}</strong> / 収入 <strong style="color:var(--income-main);">¥${formatCurrency(incSum)}</strong>`;

  list.innerHTML = '';
  if (dayRecords.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'flex';
  } else {
    list.style.display = 'flex';
    empty.style.display = 'none';
    dayRecords.forEach(r => {
      list.appendChild(createTransactionElement(r));
    });
  }
}

// ==========================================
// 8. 収支明細一覧 (Records Tab)
// ==========================================

function renderRecordsList() {
  const container = document.getElementById('recordsGroupedList');
  const emptyState = document.getElementById('recordsEmptyState');
  if (!container || !emptyState) return;

  let filtered = getMonthRecords(AppState.currentMonth);

  const query = AppState.filters.query.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(r => {
      const cat = getCategoryInfo(r.category, r.type);
      return (r.note || '').toLowerCase().includes(query) || cat.name.toLowerCase().includes(query);
    });
  }

  if (AppState.filters.type !== 'all') {
    filtered = filtered.filter(r => r.type === AppState.filters.type);
  }

  if (AppState.filters.category !== 'all') {
    filtered = filtered.filter(r => r.category === AppState.filters.category);
  }

  if (AppState.filters.payment !== 'all') {
    filtered = filtered.filter(r => r.payment === AppState.filters.payment);
  }

  filtered.sort((a, b) => {
    switch (AppState.filters.sort) {
      case 'date-asc': return new Date(a.date) - new Date(b.date);
      case 'amount-desc': return Number(b.amount) - Number(a.amount);
      case 'amount-asc': return Number(a.amount) - Number(b.amount);
      default: return new Date(b.date) - new Date(a.date);
    }
  });

  let fIncome = 0;
  let fExpense = 0;
  filtered.forEach(r => {
    if (r.type === 'income') fIncome += Number(r.amount);
    else fExpense += Number(r.amount);
  });

  document.getElementById('filterResultCount').textContent = `${filtered.length} 件を表示中`;
  document.getElementById('filterSumIncome').textContent = `¥${formatCurrency(fIncome)}`;
  document.getElementById('filterSumExpense').textContent = `¥${formatCurrency(fExpense)}`;
  document.getElementById('filterSumBalance').textContent = `¥${formatCurrency(fIncome - fExpense)}`;

  container.innerHTML = '';

  if (filtered.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  container.style.display = 'flex';
  emptyState.style.display = 'none';

  const groups = {};
  filtered.forEach(r => {
    const d = r.date;
    if (!groups[d]) groups[d] = [];
    groups[d].push(r);
  });

  const groupDates = Object.keys(groups);
  if (AppState.filters.sort === 'date-asc') {
    groupDates.sort((a, b) => new Date(a) - new Date(b));
  } else {
    groupDates.sort((a, b) => new Date(b) - new Date(a));
  }

  groupDates.forEach(dateStr => {
    const dateRecords = groups[dateStr];
    let groupExpenseSum = 0;
    let groupIncomeSum = 0;
    dateRecords.forEach(r => {
      if (r.type === 'income') groupIncomeSum += Number(r.amount);
      else groupExpenseSum += Number(r.amount);
    });

    const dateObj = new Date(dateStr);
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
    const formattedDate = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日 (${dayOfWeek})`;

    const groupCard = document.createElement('div');
    groupCard.className = 'date-group-card';

    const header = document.createElement('div');
    header.className = 'date-group-header';

    let subtotalHtml = '';
    if (groupExpenseSum > 0) subtotalHtml += `<span style="color:var(--expense-main);">支出 ¥${formatCurrency(groupExpenseSum)}</span>`;
    if (groupIncomeSum > 0) {
      if (subtotalHtml) subtotalHtml += ' / ';
      subtotalHtml += `<span style="color:var(--income-main);">収入 ¥${formatCurrency(groupIncomeSum)}</span>`;
    }

    header.innerHTML = `
      <div class="date-group-title">
        <span>${formattedDate}</span>
        <span class="date-day-badge">${dateRecords.length}件</span>
      </div>
      <div class="date-group-subtotal">${subtotalHtml}</div>
    `;

    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'date-group-items';

    dateRecords.forEach(r => {
      itemsWrap.appendChild(createTransactionElement(r));
    });

    groupCard.appendChild(header);
    groupCard.appendChild(itemsWrap);
    container.appendChild(groupCard);
  });
}

function createTransactionElement(record) {
  const cat = getCategoryInfo(record.category, record.type);
  const payMethod = PAYMENT_METHODS[record.payment] || { name: 'その他', icon: 'fa-tag' };
  const isExp = record.type === 'expense';

  const item = document.createElement('div');
  item.className = 'tx-item';
  item.dataset.id = record.id;

  item.innerHTML = `
    <div class="tx-left">
      <div class="tx-icon-wrap" style="background-color: ${cat.color};">
        <i class="fa-solid ${cat.icon}"></i>
      </div>
      <div class="tx-details">
        <span class="tx-title">${record.note || cat.name}</span>
        <div class="tx-submeta">
          <span>${cat.name}</span>
          <span>•</span>
          <span><i class="fa-solid ${payMethod.icon}"></i> ${payMethod.name}</span>
          ${record.isFixed ? '<span class="tx-fixed-tag">固定費</span>' : ''}
        </div>
      </div>
    </div>
    <div class="tx-right">
      <span class="tx-amount ${isExp ? 'expense' : 'income'}">
        ${isExp ? '-' : '+'}¥${formatCurrency(record.amount)}
      </span>
      <div class="tx-actions">
        <button class="btn-tx-action edit" title="編集"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-tx-action delete" title="削除"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    </div>
  `;

  item.querySelector('.btn-tx-action.edit').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditTransactionModal(record.id);
  });

  item.querySelector('.btn-tx-action.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTransaction(record.id);
  });

  return item;
}

// ==========================================
// 9. 統計 & グラフ (Analytics Tab)
// ==========================================

function renderAnalytics() {
  renderCategoryDonutChart();
  renderPaymentMethodChart();
  renderMonthlyTrendChart();
}

function renderCategoryDonutChart() {
  const ctx = document.getElementById('categoryDonutChart');
  if (!ctx) return;

  const summary = calculateMonthSummary(AppState.currentMonth);
  const sorted = Object.entries(summary.categoryExpenses).sort((a, b) => b[1] - a[1]);

  const labels = [];
  const data = [];
  const colors = [];

  sorted.forEach(([catId, amount]) => {
    const cat = getCategoryInfo(catId, 'expense');
    labels.push(cat.name);
    data.push(amount);
    colors.push(cat.color);
  });

  if (data.length === 0) {
    labels.push('支出なし');
    data.push(1);
    colors.push('#cbd5e1');
  }

  if (AppState.charts.categoryDonut) {
    AppState.charts.categoryDonut.destroy();
  }

  AppState.charts.categoryDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: document.body.getAttribute('data-theme') === 'dark' ? '#1e293b' : '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } }
      }
    }
  });

  // ランキングリスト
  const ranking = document.getElementById('topCategoriesList');
  if (ranking) {
    ranking.innerHTML = '';
    const top4 = sorted.slice(0, 4);
    top4.forEach(([catId, amt]) => {
      const cat = getCategoryInfo(catId, 'expense');
      const pct = summary.totalExpense > 0 ? Math.round((amt / summary.totalExpense) * 100) : 0;
      const item = document.createElement('div');
      item.className = 'cat-rank-item';
      item.innerHTML = `
        <div class="cat-icon-badge" style="background-color: ${cat.color};">
          <i class="fa-solid ${cat.icon}"></i>
        </div>
        <div class="cat-rank-info">
          <div class="cat-rank-title-row">
            <span>${cat.name}</span>
            <span>¥${formatCurrency(amt)}</span>
          </div>
          <div class="cat-rank-bar-wrap">
            <div class="cat-rank-bar-fill" style="width: ${pct}%; background-color: ${cat.color};"></div>
          </div>
        </div>
        <span class="cat-rank-percent">${pct}%</span>
      `;
      ranking.appendChild(item);
    });
  }
}

function renderPaymentMethodChart() {
  const ctx = document.getElementById('paymentMethodChart');
  if (!ctx) return;

  const summary = calculateMonthSummary(AppState.currentMonth);
  const entries = Object.entries(summary.paymentBreakdown);

  const labels = [];
  const data = [];
  const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#94a3b8'];

  entries.forEach(([key, amt]) => {
    const pay = PAYMENT_METHODS[key] || { name: 'その他' };
    labels.push(pay.name);
    data.push(amt);
  });

  if (data.length === 0) {
    labels.push('データなし');
    data.push(1);
  }

  if (AppState.charts.paymentMethod) {
    AppState.charts.paymentMethod.destroy();
  }

  AppState.charts.paymentMethod = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: document.body.getAttribute('data-theme') === 'dark' ? '#1e293b' : '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } }
      }
    }
  });
}

function renderMonthlyTrendChart() {
  const ctx = document.getElementById('monthlyTrendChart');
  if (!ctx) return;

  const [curY, curM] = AppState.currentMonth.split('-').map(Number);
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let y = curY;
    let m = curM - i;
    while (m < 1) { m += 12; y -= 1; }
    months.push(`${y}-${String(m).padStart(2, '0')}`);
  }

  const labels = months.map(ym => {
    const parts = ym.split('-');
    return `${parts[0].slice(2)}年${Number(parts[1])}月`;
  });

  const incomeData = [];
  const expenseData = [];

  months.forEach(ym => {
    const sum = calculateMonthSummary(ym);
    incomeData.push(sum.totalIncome);
    expenseData.push(sum.totalExpense);
  });

  if (AppState.charts.monthlyTrend) {
    AppState.charts.monthlyTrend.destroy();
  }

  AppState.charts.monthlyTrend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: '収入', data: incomeData, backgroundColor: '#10b981', borderRadius: 6, maxBarThickness: 32 },
        { label: '支出', data: expenseData, backgroundColor: '#f43f5e', borderRadius: 6, maxBarThickness: 32 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: value => '¥' + (value >= 10000 ? (value / 10000) + '万' : value) }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

// ==========================================
// 10. 取引モーダル制御 & CRUD
// ==========================================

function openAddTransactionModal(presetDate = null) {
  AppState.activeEditingId = null;
  document.getElementById('transactionModalTitle').textContent = '収支を記録';
  document.getElementById('txIdInput').value = '';
  document.getElementById('txAmountInput').value = '';
  document.getElementById('txNoteInput').value = '';
  document.getElementById('txIsFixedCheckbox').checked = false;

  const targetDate = typeof presetDate === 'string' && presetDate ? presetDate : (AppState.selectedDate || getTodayDateString());
  document.getElementById('txDateInput').value = targetDate;

  setTransactionType('expense');
  renderCategoryPicker('expense', EXPENSE_CATEGORIES[0].id);

  showModal('transactionModal');
  setTimeout(() => document.getElementById('txAmountInput').focus(), 100);
}

function openEditTransactionModal(id) {
  const record = AppState.records.find(r => r.id === id);
  if (!record) return;

  AppState.activeEditingId = id;
  document.getElementById('transactionModalTitle').textContent = '記録を編集';
  document.getElementById('txIdInput').value = record.id;
  document.getElementById('txAmountInput').value = record.amount;
  document.getElementById('txDateInput').value = record.date;
  document.getElementById('txPaymentSelect').value = record.payment || 'credit';
  document.getElementById('txNoteInput').value = record.note || '';
  document.getElementById('txIsFixedCheckbox').checked = !!record.isFixed;

  setTransactionType(record.type);
  renderCategoryPicker(record.type, record.category);

  showModal('transactionModal');
}

function setTransactionType(type) {
  const expenseLabel = document.getElementById('typeExpenseLabel');
  const incomeLabel = document.getElementById('typeIncomeLabel');
  const expRadio = document.getElementById('typeExpenseRadio');
  const incRadio = document.getElementById('typeIncomeRadio');

  if (type === 'income') {
    incRadio.checked = true;
    incomeLabel.classList.add('active-income');
    expenseLabel.classList.remove('active-expense');
    renderCategoryPicker('income');
  } else {
    expRadio.checked = true;
    expenseLabel.classList.add('active-expense');
    incomeLabel.classList.remove('active-income');
    renderCategoryPicker('expense');
  }
}

function renderCategoryPicker(type, selectedId = null) {
  const grid = document.getElementById('categoryPickerGrid');
  const hiddenInput = document.getElementById('txCategoryInput');
  if (!grid || !hiddenInput) return;

  grid.innerHTML = '';
  const pool = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const defaultSelected = selectedId || pool[0].id;
  hiddenInput.value = defaultSelected;

  pool.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cat-pick-btn ${cat.id === defaultSelected ? 'selected' : ''}`;
    btn.dataset.id = cat.id;
    btn.innerHTML = `
      <i class="fa-solid ${cat.icon}" style="color: ${cat.color};"></i>
      <span>${cat.name}</span>
    `;

    btn.addEventListener('click', () => {
      grid.querySelectorAll('.cat-pick-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      hiddenInput.value = cat.id;
    });

    grid.appendChild(btn);
  });
}

function handleTransactionFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('txIdInput').value;
  const type = document.querySelector('input[name="txType"]:checked').value;
  const amount = Number(document.getElementById('txAmountInput').value);
  const category = document.getElementById('txCategoryInput').value;
  const date = document.getElementById('txDateInput').value;
  const payment = document.getElementById('txPaymentSelect').value;
  const note = document.getElementById('txNoteInput').value.trim();
  const isFixed = document.getElementById('txIsFixedCheckbox').checked;

  if (!amount || amount <= 0) {
    showToast('有効な金額を入力してください', 'error');
    return;
  }

  if (!date) {
    showToast('日付を入力してください', 'error');
    return;
  }

  if (id) {
    const index = AppState.records.findIndex(r => r.id === id);
    if (index !== -1) {
      AppState.records[index] = {
        ...AppState.records[index],
        type,
        amount,
        category,
        date,
        payment,
        note,
        isFixed,
        updatedAt: new Date().toISOString()
      };
      showToast('記録を更新しました', 'success');
    }
  } else {
    const newRecord = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type,
      amount,
      category,
      date,
      payment,
      note,
      isFixed,
      createdAt: new Date().toISOString()
    };
    AppState.records.push(newRecord);
    showToast('収支を追加しました！', 'success');
  }

  AppState.selectedDate = date;
  const txYM = date.substring(0, 7);
  if (txYM !== AppState.currentMonth) {
    AppState.currentMonth = txYM;
  }

  saveRecordsToStorage();
  closeModal('transactionModal');
  renderAll();
}

function deleteTransaction(id) {
  if (!confirm('この記録を削除してもよろしいですか？')) return;

  AppState.records = AppState.records.filter(r => r.id !== id);
  saveRecordsToStorage();
  showToast('記録を削除しました', 'info');
  renderAll();
}

// ==========================================
// 11. レポートモーダル
// ==========================================

function openMonthlyReportModal() {
  const summary = calculateMonthSummary(AppState.currentMonth);
  const [y, m] = AppState.currentMonth.split('-');
  document.getElementById('reportModalTitle').textContent = `${y}年 ${Number(m)}月の家計簿レポート`;

  let grade = 'A';
  let title = '順調な家計管理です！';
  let advice = '';

  if (summary.totalExpense === 0 && summary.totalIncome === 0) {
    grade = '-';
    title = 'データがありません';
    advice = 'カレンダーから収支を記録すると、詳細な分析が表示されます。';
  } else if (summary.balance < 0) {
    grade = 'D';
    title = '赤字です！支出の見直しが必要です';
    advice = `今月は支出が収入を ¥${formatCurrency(Math.abs(summary.balance))} 上回っています。食費や交際費などの変動費を見直してみましょう。`;
  } else if (summary.savingRate >= 30) {
    grade = 'S';
    title = '素晴らしい貯蓄率です！';
    advice = `収入の${summary.savingRate}%を貯蓄に回せています！この調子で堅実な資産形成を継続しましょう。`;
    if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  } else {
    grade = 'A';
    title = '理想的な黒字バランスです！';
    advice = `黒字額 ¥${formatCurrency(summary.balance)} (貯蓄率${summary.savingRate}%) を維持できています。`;
  }

  const sortedCats = Object.entries(summary.categoryExpenses).sort((a, b) => b[1] - a[1]);
  let topCatText = 'なし';
  if (sortedCats.length > 0) {
    const topCat = getCategoryInfo(sortedCats[0][0], 'expense');
    topCatText = `${topCat.name} (¥${formatCurrency(sortedCats[0][1])})`;
  }

  document.getElementById('reportModalBody').innerHTML = `
    <div class="report-grade-banner">
      <div class="report-grade-badge">${grade}</div>
      <div class="report-grade-commentary">
        <h4>${title}</h4>
        <p>収支差額: <strong>¥${formatCurrency(summary.balance)}</strong> / 貯蓄率: <strong>${summary.savingRate}%</strong></p>
      </div>
    </div>
    <div class="report-stats-grid">
      <div class="report-stat-box">
        <span class="report-stat-label">総収入</span>
        <div class="report-stat-val" style="color:var(--income-main);">¥${formatCurrency(summary.totalIncome)}</div>
      </div>
      <div class="report-stat-box">
        <span class="report-stat-label">総支出</span>
        <div class="report-stat-val" style="color:var(--expense-main);">¥${formatCurrency(summary.totalExpense)}</div>
      </div>
      <div class="report-stat-box">
        <span class="report-stat-label">最大支出項目</span>
        <div class="report-stat-val" style="font-size:1rem; margin-top:4px;">${topCatText}</div>
      </div>
    </div>
    <div class="report-advice-box">
      <strong>💡 アドバイス:</strong><br>${advice}
    </div>
  `;

  showModal('monthlyReportModal');
}

// ==========================================
// 12. データ連携 (CSV & JSON)
// ==========================================

function exportDataAsCSV() {
  if (AppState.records.length === 0) {
    showToast('エクスポートするデータがありません', 'error');
    return;
  }

  const headers = ['ID', '日付', '収支区分', 'カテゴリ', '金額', '支払方法', 'メモ', '固定費フラグ', '作成日時'];
  const rows = AppState.records.map(r => {
    const cat = getCategoryInfo(r.category, r.type);
    const pay = PAYMENT_METHODS[r.payment]?.name || r.payment || '';
    return [
      `"${r.id}"`, `"${r.date}"`, `"${r.type === 'expense' ? '支出' : '収入'}"`,
      `"${cat.name}"`, r.amount, `"${pay}"`,
      `"${(r.note || '').replace(/"/g, '""')}"`,
      `"${r.isFixed ? '固定費' : '変動費'}"`, `"${r.createdAt || ''}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `kakeibo_${getCurrentYearMonth()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('CSVを出力しました', 'success');
}

function exportDataAsJSON() {
  const data = { version: '3.0', exportDate: new Date().toISOString(), records: AppState.records };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `kakeibo_backup_${getCurrentYearMonth()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('バックアップJSONを出力しました', 'success');
}

function importDataFromJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && Array.isArray(data.records)) {
        AppState.records = data.records;
        saveRecordsToStorage();
        showToast(`${data.records.length} 件のデータを復元しました！`, 'success');
        renderAll();
      } else {
        showToast('無効なJSON形式です', 'error');
      }
    } catch (err) {
      showToast('JSONの読み込みに失敗しました', 'error');
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (!confirm('本当に全データを初期化しますか？')) return;
  AppState.records = [];
  saveRecordsToStorage();
  showToast('全データをリセットしました', 'info');
  renderAll();
}

function loadSampleData() {
  AppState.records = [...AppState.records, ...generateSampleRecords()];
  saveRecordsToStorage();
  showToast('サンプルデータを追加しました！', 'success');
  renderAll();
}

function renderSettingsCategoryList() {
  const container = document.getElementById('categoriesManageList');
  if (!container) return;
  container.innerHTML = '';
  const allCats = [
    ...EXPENSE_CATEGORIES.map(c => ({ ...c, typeLabel: '支出' })),
    ...INCOME_CATEGORIES.map(c => ({ ...c, typeLabel: '収入' }))
  ];
  allCats.forEach(cat => {
    const chip = document.createElement('div');
    chip.className = 'category-chip-item';
    chip.innerHTML = `
      <span style="color: ${cat.color};"><i class="fa-solid ${cat.icon}"></i></span>
      <span>${cat.name}</span>
      <span style="font-size:0.7rem; color:var(--text-light); margin-left:auto;">(${cat.typeLabel})</span>
    `;
    container.appendChild(chip);
  });
}

// ==========================================
// 13. モーダル・タブ・テーマ制御
// ==========================================

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function switchTab(tabId) {
  AppState.currentTab = tabId;

  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(btn => {
    if (btn.dataset.tab === tabId) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
  document.getElementById(`pane-${tabId}`)?.classList.add('active');

  if (tabId === 'calendar') {
    renderCalendar();
    renderSelectedDayDetails();
  } else if (tabId === 'records') {
    renderRecordsList();
  } else if (tabId === 'analytics') {
    setTimeout(renderAnalytics, 50);
  }
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEY_THEME, next);

  const themeText = document.querySelector('.theme-text');
  if (themeText) themeText.textContent = next === 'dark' ? 'ライトモード' : 'ダークモード';
  renderAll();
}

function changeMonth(delta) {
  const [y, m] = AppState.currentMonth.split('-').map(Number);
  let newY = y;
  let newM = m + delta;
  if (newM > 12) { newM = 1; newY += 1; }
  else if (newM < 1) { newM = 12; newY -= 1; }

  AppState.currentMonth = `${newY}-${String(newM).padStart(2, '0')}`;
  AppState.selectedDate = `${AppState.currentMonth}-01`;
  renderAll();
}

// ==========================================
// 14. 初期化 & イベント登録
// ==========================================

function initCategoryFilterDropdown() {
  const select = document.getElementById('recordCategoryFilter');
  if (!select) return;

  select.innerHTML = '<option value="all">すべてのカテゴリ</option>';

  const optGroupExp = document.createElement('optgroup');
  optGroupExp.label = '【支出】';
  EXPENSE_CATEGORIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    optGroupExp.appendChild(opt);
  });
  select.appendChild(optGroupExp);

  const optGroupInc = document.createElement('optgroup');
  optGroupInc.label = '【収入】';
  INCOME_CATEGORIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    optGroupInc.appendChild(opt);
  });
  select.appendChild(optGroupInc);
}

function setupEventListeners() {
  // ナビゲーション
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab) switchTab(tab);
    });
  });

  // テーマ切替
  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);

  // 月ナビゲーション
  document.getElementById('prevMonthBtn')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonthBtn')?.addEventListener('click', () => changeMonth(1));
  document.getElementById('mobilePrevMonthBtn')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('mobileNextMonthBtn')?.addEventListener('click', () => changeMonth(1));

  document.getElementById('globalMonthPicker')?.addEventListener('change', (e) => {
    if (e.target.value) {
      AppState.currentMonth = e.target.value;
      AppState.selectedDate = `${AppState.currentMonth}-01`;
      renderAll();
    }
  });

  document.getElementById('goToTodayBtn')?.addEventListener('click', () => {
    AppState.currentMonth = getCurrentYearMonth();
    AppState.selectedDate = getTodayDateString();
    renderAll();
  });

  // 選択日への追加ボタン
  document.getElementById('addTxForSelectedDateBtn')?.addEventListener('click', () => {
    openAddTransactionModal(AppState.selectedDate);
  });
  document.getElementById('addFirstTxForDayBtn')?.addEventListener('click', () => {
    openAddTransactionModal(AppState.selectedDate);
  });

  // 取引モーダル
  document.getElementById('openAddModalBtn')?.addEventListener('click', () => openAddTransactionModal());
  document.getElementById('mobileAddFabBtn')?.addEventListener('click', () => openAddTransactionModal());
  document.getElementById('closeTransactionModalBtn')?.addEventListener('click', () => closeModal('transactionModal'));
  document.getElementById('cancelTransactionModalBtn')?.addEventListener('click', () => closeModal('transactionModal'));
  document.getElementById('transactionForm')?.addEventListener('submit', handleTransactionFormSubmit);

  document.getElementById('typeExpenseRadio')?.addEventListener('change', () => setTransactionType('expense'));
  document.getElementById('typeIncomeRadio')?.addEventListener('change', () => setTransactionType('income'));

  // 金額クイック加算
  document.querySelectorAll('.quick-amounts-bar .btn-chip[data-add]').forEach(chip => {
    chip.addEventListener('click', () => {
      const addVal = Number(chip.dataset.add);
      const input = document.getElementById('txAmountInput');
      input.value = (Number(input.value) || 0) + addVal;
    });
  });
  document.getElementById('clearAmountChip')?.addEventListener('click', () => {
    document.getElementById('txAmountInput').value = '';
  });

  // レポート
  document.getElementById('openMonthlyReportBtn')?.addEventListener('click', openMonthlyReportModal);
  document.getElementById('closeReportModalBtn')?.addEventListener('click', () => closeModal('monthlyReportModal'));
  document.getElementById('closeReportFooterBtn')?.addEventListener('click', () => closeModal('monthlyReportModal'));

  // フィルタ & 検索
  const searchInput = document.getElementById('recordSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  searchInput?.addEventListener('input', (e) => {
    AppState.filters.query = e.target.value;
    if (clearSearchBtn) clearSearchBtn.style.display = e.target.value ? 'block' : 'none';
    renderRecordsList();
  });

  clearSearchBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    AppState.filters.query = '';
    clearSearchBtn.style.display = 'none';
    renderRecordsList();
  });

  document.getElementById('recordTypeFilter')?.addEventListener('change', (e) => {
    AppState.filters.type = e.target.value;
    renderRecordsList();
  });
  document.getElementById('recordCategoryFilter')?.addEventListener('change', (e) => {
    AppState.filters.category = e.target.value;
    renderRecordsList();
  });
  document.getElementById('recordPaymentFilter')?.addEventListener('change', (e) => {
    AppState.filters.payment = e.target.value;
    renderRecordsList();
  });
  document.getElementById('recordSortFilter')?.addEventListener('change', (e) => {
    AppState.filters.sort = e.target.value;
    renderRecordsList();
  });

  // データ入出力
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportDataAsCSV);
  document.getElementById('exportJsonBtn')?.addEventListener('click', exportDataAsJSON);
  document.getElementById('importJsonFileInput')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      importDataFromJSON(e.target.files[0]);
      e.target.value = '';
    }
  });
  document.getElementById('loadSampleDataBtn')?.addEventListener('click', loadSampleData);
  document.getElementById('resetAllDataBtn')?.addEventListener('click', resetAllData);

  // モーダル背景クリック
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop.id);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.show').forEach(m => closeModal(m.id));
    }
  });
}

function initApp() {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  const themeText = document.querySelector('.theme-text');
  if (themeText) themeText.textContent = savedTheme === 'dark' ? 'ライトモード' : 'ダークモード';

  loadStateFromStorage();
  initCategoryFilterDropdown();
  setupEventListeners();
  renderAll();
}

document.addEventListener('DOMContentLoaded', initApp);
