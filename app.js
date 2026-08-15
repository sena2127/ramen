/**
 * SmartKakeibo - モダン家計簿アプリケーション コアスクリプト
 * 構造: データストア、UIコントローラー、グラフ描画、集計エンジン、インポート/エクスポート
 */

// ==========================================
// 1. 定数・カテゴリ定義・初期設定
// ==========================================

const STORAGE_KEY_RECORDS = 'smartkakeibo_records_v2';
const STORAGE_KEY_BUDGET = 'smartkakeibo_budget_v2';
const STORAGE_KEY_THEME = 'smartkakeibo_theme_v2';

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
  currentTab: 'dashboard',
  records: [],
  budgets: {}, // { "YYYY-MM": { total: 200000, categories: { food: 50000 } } }
  activeEditingId: null,
  charts: {
    dashboardCategory: null,
    monthlyTrend: null,
    dailySpending: null,
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

  // 全カテゴリから再検索
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
  }, 3200);
}

// ==========================================
// 4. データストア層 (LocalStorage)
// ==========================================

function loadStateFromStorage() {
  try {
    const rawRecords = localStorage.getItem(STORAGE_KEY_RECORDS);
    if (rawRecords) {
      AppState.records = JSON.parse(rawRecords);
    } else {
      // 初回訪問時はサンプルデータを生成
      AppState.records = generateSampleRecords();
      saveRecordsToStorage();
    }

    const rawBudgets = localStorage.getItem(STORAGE_KEY_BUDGET);
    if (rawBudgets) {
      AppState.budgets = JSON.parse(rawBudgets);
    } else {
      AppState.budgets = generateSampleBudgets();
      saveBudgetsToStorage();
    }
  } catch (e) {
    console.error('LocalStorage load error:', e);
    AppState.records = [];
    AppState.budgets = {};
  }
}

function saveRecordsToStorage() {
  localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(AppState.records));
}

function saveBudgetsToStorage() {
  localStorage.setItem(STORAGE_KEY_BUDGET, JSON.stringify(AppState.budgets));
}

function generateSampleRecords() {
  const currentYM = getCurrentYearMonth();
  const [curYear, curMonth] = currentYM.split('-').map(Number);

  const samples = [];
  const addDays = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // 過去2ヶ月 + 今月のデータを生成
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

    // 収入: 副業
    if (month % 2 === 0) {
      samples.push({
        id: 'sample_' + Math.random().toString(36).substr(2, 9),
        type: 'income',
        amount: 35000,
        category: 'side_job',
        date: addDays(year, month, 15),
        payment: 'bank',
        note: 'Web制作案件報酬',
        isFixed: false,
        createdAt: new Date().toISOString()
      });
    }

    // 支出: 家賃
    samples.push({
      id: 'sample_' + Math.random().toString(36).substr(2, 9),
      type: 'expense',
      amount: 75000,
      category: 'housing',
      date: addDays(year, month, 27),
      payment: 'bank',
      note: 'マンション家賃',
      isFixed: true,
      createdAt: new Date().toISOString()
    });

    // 支出: 水道光熱費
    samples.push({
      id: 'sample_' + Math.random().toString(36).substr(2, 9),
      type: 'expense',
      amount: 12400,
      category: 'utilities',
      date: addDays(year, month, 20),
      payment: 'credit',
      note: '電気・ガス・水道まとめ',
      isFixed: true,
      createdAt: new Date().toISOString()
    });

    // 支出: 通信費
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

    // 支出: 食費（複数日）
    const foodExpenses = [
      { d: 2, amt: 4800, note: 'スーパー週末まとめ買い', pay: 'credit' },
      { d: 5, amt: 1200, note: 'ランチ（定食）', pay: 'e-money' },
      { d: 8, amt: 3500, note: 'スーパー食材・飲料', pay: 'credit' },
      { d: 11, amt: 980, note: 'カフェ作業', pay: 'e-money' },
      { d: 14, amt: 5200, note: 'スーパーまとめ買い', pay: 'credit' },
      { d: 17, amt: 2400, note: 'デリバリー夕食', pay: 'e-money' },
      { d: 21, amt: 4100, note: '週末買い出し', pay: 'credit' },
      { d: 24, amt: 1500, note: 'ベーカリー＆カフェ', pay: 'cash' },
      { d: 28, amt: 6400, note: 'スーパー食材調達', pay: 'credit' }
    ];
    foodExpenses.forEach(item => {
      samples.push({
        id: 'sample_' + Math.random().toString(36).substr(2, 9),
        type: 'expense',
        amount: item.amt,
        category: 'food',
        date: addDays(year, month, item.d),
        payment: item.pay,
        note: item.note,
        isFixed: false,
        createdAt: new Date().toISOString()
      });
    });

    // 支出: 日用品
    samples.push({
      id: 'sample_' + Math.random().toString(36).substr(2, 9),
      type: 'expense',
      amount: 4200,
      category: 'daily',
      date: addDays(year, month, 6),
      payment: 'credit',
      note: '洗剤・ティッシュ・消耗品',
      isFixed: false,
      createdAt: new Date().toISOString()
    });

    // 支出: 交通費
    samples.push({
      id: 'sample_' + Math.random().toString(36).substr(2, 9),
      type: 'expense',
      amount: 5000,
      category: 'transport',
      date: addDays(year, month, 10),
      payment: 'e-money',
      note: '交通系ICチャージ',
      isFixed: false,
      createdAt: new Date().toISOString()
    });

    // 支出: 交際費
    samples.push({
      id: 'sample_' + Math.random().toString(36).substr(2, 9),
      type: 'expense',
      amount: 7500,
      category: 'entertainment',
      date: addDays(year, month, 12),
      payment: 'credit',
      note: '友人とのディナー',
      isFixed: false,
      createdAt: new Date().toISOString()
    });

    // 支出: 趣味・娯楽
    samples.push({
      id: 'sample_' + Math.random().toString(36).substr(2, 9),
      type: 'expense',
      amount: 3980,
      category: 'hobby',
      date: addDays(year, month, 16),
      payment: 'credit',
      note: '書籍＆映画鑑賞',
      isFixed: false,
      createdAt: new Date().toISOString()
    });
  }

  return samples;
}

function generateSampleBudgets() {
  const currentYM = getCurrentYearMonth();
  return {
    [currentYM]: {
      total: 200000,
      categories: {
        food: 50000,
        housing: 75000,
        utilities: 15000,
        communication: 8000,
        daily: 10000,
        transport: 10000,
        entertainment: 15000,
        hobby: 12000,
        clothing: 10000
      }
    }
  };
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
  const dailyExpenses = {};

  records.forEach(r => {
    const amt = Number(r.amount) || 0;
    if (r.type === 'income') {
      totalIncome += amt;
      incomeCount++;
    } else {
      totalExpense += amt;
      expenseCount++;

      // カテゴリ別集計
      categoryExpenses[r.category] = (categoryExpenses[r.category] || 0) + amt;

      // 支払方法別集計
      const pay = r.payment || 'other';
      paymentBreakdown[pay] = (paymentBreakdown[pay] || 0) + amt;

      // 日別集計
      const day = r.date;
      dailyExpenses[day] = (dailyExpenses[day] || 0) + amt;
    }
  });

  const balance = totalIncome - totalExpense;
  const savingRate = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0;

  // 予算取得
  const budgetObj = AppState.budgets[yearMonth] || { total: 200000, categories: {} };
  const totalBudget = budgetObj.total || 0;
  const remainingBudget = totalBudget - totalExpense;
  const budgetUsagePercent = totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 100) : 0;

  return {
    yearMonth,
    records,
    totalIncome,
    totalExpense,
    balance,
    incomeCount,
    expenseCount,
    savingRate,
    totalBudget,
    remainingBudget,
    budgetUsagePercent,
    categoryExpenses,
    paymentBreakdown,
    dailyExpenses
  };
}

// ==========================================
// 6. UI レンダリング & 更新
// ==========================================

function renderAll() {
  updatePeriodHeader();
  renderDashboard();
  renderRecordsList();
  renderAnalytics();
  renderBudgetSection();
  renderSettingsCategoryList();
}

function updatePeriodHeader() {
  const [y, m] = AppState.currentMonth.split('-');
  const title = `${y}年 ${Number(m)}月`;
  
  const titleEl = document.getElementById('displayPeriodTitle');
  if (titleEl) titleEl.textContent = title;

  const mobileLabel = document.getElementById('mobileMonthLabel');
  if (mobileLabel) mobileLabel.textContent = `${Number(m)}月`;

  const globalPicker = document.getElementById('globalMonthPicker');
  if (globalPicker) globalPicker.value = AppState.currentMonth;

  // 残り日数バッジ
  const daysBadge = document.getElementById('displayPeriodDays');
  if (daysBadge) {
    const today = new Date();
    const curYM = getCurrentYearMonth();
    if (AppState.currentMonth === curYM) {
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const leftDays = lastDay - today.getDate() + 1;
      daysBadge.textContent = `あと ${leftDays} 日`;
    } else {
      daysBadge.textContent = `集計完了`;
    }
  }
}

// --- Dashboard Tab Rendering ---
function renderDashboard() {
  const summary = calculateMonthSummary(AppState.currentMonth);

  // Cards
  document.getElementById('summaryIncomeAmount').textContent = formatCurrency(summary.totalIncome);
  document.getElementById('summaryExpenseAmount').textContent = formatCurrency(summary.totalExpense);
  document.getElementById('summaryBalanceAmount').textContent = formatCurrency(summary.balance);
  document.getElementById('summaryBudgetRemaining').textContent = formatCurrency(summary.remainingBudget);

  document.getElementById('incomeCountBadge').textContent = `${summary.incomeCount} 件の収入`;

  // 日平均
  const daysInMonth = new Date(AppState.currentMonth.split('-')[0], AppState.currentMonth.split('-')[1], 0).getDate();
  const dailyAvg = Math.round(summary.totalExpense / daysInMonth);
  document.getElementById('expenseDailyAvg').textContent = `1日平均: ¥${formatCurrency(dailyAvg)}`;

  // 貯蓄率バッジ
  const savingRateEl = document.getElementById('summarySavingRate');
  savingRateEl.textContent = `貯蓄率: ${summary.savingRate}%`;
  if (summary.balance >= 0) {
    savingRateEl.className = 'meta-badge status-positive';
  } else {
    savingRateEl.className = 'meta-badge status-negative';
  }

  // 予算バー
  const progressBar = document.getElementById('summaryBudgetProgressBar');
  const percentClamped = Math.min(summary.budgetUsagePercent, 100);
  progressBar.style.width = `${percentClamped}%`;
  
  if (summary.budgetUsagePercent > 100) {
    progressBar.className = 'progress-bar-fill danger';
  } else if (summary.budgetUsagePercent > 80) {
    progressBar.className = 'progress-bar-fill warning';
  } else {
    progressBar.className = 'progress-bar-fill';
  }

  document.getElementById('budgetPercentLabel').textContent = `使用率: ${summary.budgetUsagePercent}%`;
  document.getElementById('budgetTotalLabel').textContent = `予算: ¥${formatCurrency(summary.totalBudget)}`;

  // ドーナツチャート描画
  renderCategoryDonutChart(summary);

  // 最近の取引リスト (直近5件)
  renderRecentTransactionsList(summary.records);
}

function renderCategoryDonutChart(summary) {
  const ctx = document.getElementById('dashboardCategoryChart');
  if (!ctx) return;

  const centerTotalEl = document.getElementById('chartCenterTotal');
  if (centerTotalEl) centerTotalEl.textContent = `¥${formatCurrency(summary.totalExpense)}`;

  const sortedCatEntries = Object.entries(summary.categoryExpenses)
    .sort((a, b) => b[1] - a[1]);

  const labels = [];
  const data = [];
  const colors = [];

  sortedCatEntries.forEach(([catId, amount]) => {
    const cat = getCategoryInfo(catId, 'expense');
    labels.push(cat.name);
    data.push(amount);
    colors.push(cat.color);
  });

  // チャートが空の場合のプレースホルダー
  if (data.length === 0) {
    labels.push('支出なし');
    data.push(1);
    colors.push('#cbd5e1');
  }

  if (AppState.charts.dashboardCategory) {
    AppState.charts.dashboardCategory.destroy();
  }

  AppState.charts.dashboardCategory = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: document.body.getAttribute('data-theme') === 'dark' ? '#1e293b' : '#ffffff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              if (summary.totalExpense === 0) return '支出がありません';
              const val = context.raw;
              const pct = Math.round((val / summary.totalExpense) * 100);
              return ` ${context.label}: ¥${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  // トップカテゴリランキングリスト
  const rankingContainer = document.getElementById('topCategoriesList');
  if (rankingContainer) {
    rankingContainer.innerHTML = '';
    const top3 = sortedCatEntries.slice(0, 4);

    if (top3.length === 0) {
      rankingContainer.innerHTML = '<p style="text-align:center;font-size:0.85rem;color:var(--text-muted);padding:10px;">今月の支出データはまだありません</p>';
    } else {
      top3.forEach(([catId, amount]) => {
        const cat = getCategoryInfo(catId, 'expense');
        const pct = summary.totalExpense > 0 ? Math.round((amount / summary.totalExpense) * 100) : 0;
        
        const item = document.createElement('div');
        item.className = 'cat-rank-item';
        item.innerHTML = `
          <div class="cat-icon-badge" style="background-color: ${cat.color};">
            <i class="fa-solid ${cat.icon}"></i>
          </div>
          <div class="cat-rank-info">
            <div class="cat-rank-title-row">
              <span>${cat.name}</span>
              <span>¥${formatCurrency(amount)}</span>
            </div>
            <div class="cat-rank-bar-wrap">
              <div class="cat-rank-bar-fill" style="width: ${pct}%; background-color: ${cat.color};"></div>
            </div>
          </div>
          <span class="cat-rank-percent">${pct}%</span>
        `;
        rankingContainer.appendChild(item);
      });
    }
  }
}

function renderRecentTransactionsList(monthRecords) {
  const container = document.getElementById('recentTransactionsList');
  const emptyState = document.getElementById('recentEmptyState');
  if (!container || !emptyState) return;

  const sorted = [...monthRecords].sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt?.localeCompare(a.createdAt || '') || 0);
  const recent = sorted.slice(0, 5);

  container.innerHTML = '';
  if (recent.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'block';
  } else {
    container.style.display = 'flex';
    emptyState.style.display = 'none';

    recent.forEach(r => {
      container.appendChild(createTransactionElement(r));
    });
  }
}

// --- Records Tab Rendering ---
function renderRecordsList() {
  const container = document.getElementById('recordsGroupedList');
  const emptyState = document.getElementById('recordsEmptyState');
  if (!container || !emptyState) return;

  // フィルタ適用
  let filtered = getMonthRecords(AppState.currentMonth);

  // 検索クエリ
  const query = AppState.filters.query.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(r => {
      const cat = getCategoryInfo(r.category, r.type);
      const noteMatch = (r.note || '').toLowerCase().includes(query);
      const catMatch = cat.name.toLowerCase().includes(query);
      return noteMatch || catMatch;
    });
  }

  // 収支種別
  if (AppState.filters.type !== 'all') {
    filtered = filtered.filter(r => r.type === AppState.filters.type);
  }

  // カテゴリ
  if (AppState.filters.category !== 'all') {
    filtered = filtered.filter(r => r.category === AppState.filters.category);
  }

  // 支払方法
  if (AppState.filters.payment !== 'all') {
    filtered = filtered.filter(r => r.payment === AppState.filters.payment);
  }

  // ソート
  filtered.sort((a, b) => {
    switch (AppState.filters.sort) {
      case 'date-asc':
        return new Date(a.date) - new Date(b.date);
      case 'amount-desc':
        return Number(b.amount) - Number(a.amount);
      case 'amount-asc':
        return Number(a.amount) - Number(b.amount);
      case 'date-desc':
      default:
        return new Date(b.date) - new Date(a.date);
    }
  });

  // フィルタ合計値の計算と更新
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

  // 日付でグループ化
  const groups = {};
  filtered.forEach(r => {
    const d = r.date;
    if (!groups[d]) groups[d] = [];
    groups[d].push(r);
  });

  // 日付順でグループを描画
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

  const dateSub = record.date ? record.date.substring(5) : '';

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
        <button class="btn-tx-action edit" data-id="${record.id}" title="編集">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-tx-action delete" data-id="${record.id}" title="削除">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `;

  // イベント設定
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

// --- Analytics Tab Rendering ---
function renderAnalytics() {
  renderMonthlyTrendChart();
  renderDailySpendingChart();
  renderPaymentMethodChart();
}

function renderMonthlyTrendChart() {
  const ctx = document.getElementById('monthlyTrendChart');
  if (!ctx) return;

  // 過去6ヶ月分のキーを算出
  const [curY, curM] = AppState.currentMonth.split('-').map(Number);
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let y = curY;
    let m = curM - i;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
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
        {
          label: '収入',
          data: incomeData,
          backgroundColor: '#10b981',
          borderRadius: 6,
          maxBarThickness: 32
        },
        {
          label: '支出',
          data: expenseData,
          backgroundColor: '#f43f5e',
          borderRadius: 6,
          maxBarThickness: 32
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => ` ${context.dataset.label}: ¥${formatCurrency(context.raw)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: document.body.getAttribute('data-theme') === 'dark' ? '#334155' : '#f1f5f9'
          },
          ticks: {
            callback: value => '¥' + (value >= 10000 ? (value / 10000) + '万' : value)
          }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderDailySpendingChart() {
  const ctx = document.getElementById('dailySpendingChart');
  if (!ctx) return;

  const [y, m] = AppState.currentMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  const labels = [];
  const data = [];

  const summary = calculateMonthSummary(AppState.currentMonth);

  for (let d = 1; d <= daysInMonth; d++) {
    labels.push(`${d}日`);
    const dateKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    data.push(summary.dailyExpenses[dateKey] || 0);
  }

  if (AppState.charts.dailySpending) {
    AppState.charts.dailySpending.destroy();
  }

  AppState.charts.dailySpending = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '日別支出',
        data: data,
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#f43f5e',
        pointRadius: 2,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => ` 支出: ¥${formatCurrency(context.raw)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: document.body.getAttribute('data-theme') === 'dark' ? '#334155' : '#f1f5f9'
          },
          ticks: {
            callback: value => '¥' + formatCurrency(value)
          }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
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
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            font: { size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: context => ` ${context.label}: ¥${formatCurrency(context.raw)}`
          }
        }
      }
    }
  });
}

// --- Budget Tab Rendering ---
function renderBudgetSection() {
  const summary = calculateMonthSummary(AppState.currentMonth);
  const currentBudget = AppState.budgets[AppState.currentMonth] || { total: 200000, categories: {} };

  document.getElementById('budgetHeroTotal').textContent = `¥${formatCurrency(currentBudget.total)}`;
  document.getElementById('budgetHeroUsed').textContent = `¥${formatCurrency(summary.totalExpense)}`;
  document.getElementById('budgetHeroLeft').textContent = `¥${formatCurrency(summary.remainingBudget)}`;

  const fill = document.getElementById('budgetHeroProgressFill');
  const clamped = Math.min(summary.budgetUsagePercent, 100);
  fill.style.width = `${clamped}%`;

  if (summary.budgetUsagePercent > 100) {
    fill.style.backgroundColor = 'var(--expense-main)';
  } else if (summary.budgetUsagePercent > 80) {
    fill.style.backgroundColor = 'var(--warning-main)';
  } else {
    fill.style.backgroundColor = 'var(--primary-500)';
  }

  document.getElementById('budgetHeroPercent').textContent = `${summary.budgetUsagePercent}% 消化`;

  // カテゴリ別予算カードグリッド
  const grid = document.getElementById('categoryBudgetsGrid');
  if (!grid) return;

  grid.innerHTML = '';
  const catBudgets = currentBudget.categories || {};

  EXPENSE_CATEGORIES.forEach(cat => {
    const limit = Number(catBudgets[cat.id]) || 0;
    const spent = Number(summary.categoryExpenses[cat.id]) || 0;
    const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const isOver = limit > 0 && spent > limit;

    const card = document.createElement('div');
    card.className = 'category-budget-card';
    card.innerHTML = `
      <div class="cat-budget-top">
        <div class="cat-budget-identity">
          <div class="cat-budget-icon" style="background-color: ${cat.color};">
            <i class="fa-solid ${cat.icon}"></i>
          </div>
          <span class="cat-budget-name">${cat.name}</span>
        </div>
        <span class="cat-budget-stat-badge ${isOver ? 'over' : (limit > 0 ? 'ok' : '')}">
          ${limit > 0 ? (isOver ? `¥${formatCurrency(spent - limit)} 超過` : `残り ¥${formatCurrency(limit - spent)}`) : '予算未設定'}
        </span>
      </div>
      <div class="cat-budget-figures">
        <span class="cat-spent-figure" style="color: ${isOver ? 'var(--expense-main)' : 'inherit'};">
          ¥${formatCurrency(spent)}
        </span>
        <span class="cat-limit-figure">/ 予算 ${limit > 0 ? `¥${formatCurrency(limit)}` : '未設定'}</span>
      </div>
      <div class="progress-bar-track" style="height: 6px;">
        <div class="progress-bar-fill ${isOver ? 'danger' : ''}" style="width: ${limit > 0 ? Math.min(percent, 100) : 0}%; background-color: ${isOver ? 'var(--expense-main)' : cat.color};"></div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// --- Settings Tab Rendering ---
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
// 7. 取引モーダル制御 & CRUD
// ==========================================

function openAddTransactionModal() {
  AppState.activeEditingId = null;
  document.getElementById('transactionModalTitle').textContent = '収支を記録';
  document.getElementById('txIdInput').value = '';
  document.getElementById('txAmountInput').value = '';
  document.getElementById('txNoteInput').value = '';
  document.getElementById('txIsFixedCheckbox').checked = false;
  document.getElementById('txDateInput').value = getTodayDateString();

  // デフォルトは支出
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
    // 編集
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
    // 新規作成
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
    showToast('新しい記録を追加しました！', 'success');
  }

  saveRecordsToStorage();
  closeModal('transactionModal');

  // 入力された日付の年月が現在表示中と異なる場合は、自動でその月に切り替え
  const txYM = date.substring(0, 7);
  if (txYM !== AppState.currentMonth) {
    AppState.currentMonth = txYM;
  }

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
// 8. 予算モーダル制御
// ==========================================

function openTotalBudgetModal() {
  const currentBudget = AppState.budgets[AppState.currentMonth] || { total: 200000, categories: {} };
  const [y, m] = AppState.currentMonth.split('-');
  document.getElementById('budgetModalMonthName').textContent = `${Number(m)}月`;
  document.getElementById('totalBudgetInput').value = currentBudget.total || 200000;
  showModal('totalBudgetModal');
}

function handleTotalBudgetSubmit(e) {
  e.preventDefault();
  const newTotal = Number(document.getElementById('totalBudgetInput').value);
  if (isNaN(newTotal) || newTotal < 0) {
    showToast('有効な予算額を入力してください', 'error');
    return;
  }

  if (!AppState.budgets[AppState.currentMonth]) {
    AppState.budgets[AppState.currentMonth] = { total: newTotal, categories: {} };
  } else {
    AppState.budgets[AppState.currentMonth].total = newTotal;
  }

  saveBudgetsToStorage();
  closeModal('totalBudgetModal');
  showToast('月間総予算を更新しました', 'success');
  renderAll();
}

function openCategoryBudgetModal() {
  const currentBudget = AppState.budgets[AppState.currentMonth] || { total: 200000, categories: {} };
  const catBudgets = currentBudget.categories || {};
  const container = document.getElementById('categoryBudgetInputsList');
  if (!container) return;

  container.innerHTML = '';

  EXPENSE_CATEGORIES.forEach(cat => {
    const curVal = catBudgets[cat.id] || '';
    const row = document.createElement('div');
    row.className = 'cat-budget-input-row';
    row.innerHTML = `
      <div class="cat-budget-row-label">
        <span style="color: ${cat.color};"><i class="fa-solid ${cat.icon}"></i></span>
        <span>${cat.name}</span>
      </div>
      <div class="cat-budget-row-input-wrap">
        <input type="number" class="form-input form-input-sm" name="cat_budget_${cat.id}" data-id="${cat.id}" value="${curVal}" placeholder="0" min="0" step="1000">
      </div>
    `;
    container.appendChild(row);
  });

  showModal('categoryBudgetModal');
}

function handleCategoryBudgetSubmit(e) {
  e.preventDefault();

  if (!AppState.budgets[AppState.currentMonth]) {
    AppState.budgets[AppState.currentMonth] = { total: 200000, categories: {} };
  }

  const inputs = document.querySelectorAll('#categoryBudgetInputsList input');
  const newCatBudgets = {};

  inputs.forEach(input => {
    const catId = input.dataset.id;
    const val = Number(input.value);
    if (val > 0) {
      newCatBudgets[catId] = val;
    }
  });

  AppState.budgets[AppState.currentMonth].categories = newCatBudgets;
  saveBudgetsToStorage();
  closeModal('categoryBudgetModal');
  showToast('カテゴリ別予算を保存しました', 'success');
  renderAll();
}

// ==========================================
// 9. 今月の振り返りレポートモーダル
// ==========================================

function openMonthlyReportModal() {
  const summary = calculateMonthSummary(AppState.currentMonth);
  const [y, m] = AppState.currentMonth.split('-');
  
  document.getElementById('reportModalTitle').textContent = `${y}年 ${Number(m)}月の家計簿レポート`;

  // 評価スコア判定 (A+, A, B, C, D)
  let grade = 'A';
  let title = '順調な家計管理です！';
  let advice = '';

  if (summary.totalExpense === 0 && summary.totalIncome === 0) {
    grade = '-';
    title = 'データがありません';
    advice = '収支の記録を入力すると、ここに詳細な分析とアドバイスが表示されます。';
  } else if (summary.balance < 0) {
    grade = 'D';
    title = '赤字です！支出の見直しが必要です';
    advice = `今月は支出が収入を ¥${formatCurrency(Math.abs(summary.balance))} 上回っています。特に食費や交際費などの変動費を見直し、無理のない範囲で節約を検討しましょう。`;
  } else if (summary.budgetUsagePercent > 100) {
    grade = 'C';
    title = '予算オーバーに注意';
    advice = `総予算を ¥${formatCurrency(summary.totalExpense - summary.totalBudget)} 超過しています。カテゴリ別予算を確認して、使いすぎている項目を特定しましょう。`;
  } else if (summary.savingRate >= 30) {
    grade = 'S';
    title = '素晴らしすぎる貯蓄率です！';
    advice = `収入の${summary.savingRate}%を貯蓄・投資に回せています！この調子で堅実な資産形成を継続しましょう。`;
    // Confetti演出
    if (typeof confetti === 'function') {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
  } else if (summary.savingRate >= 15) {
    grade = 'A';
    title = '理想的な黒字バランスです！';
    advice = `黒字額 ¥${formatCurrency(summary.balance)} (貯蓄率${summary.savingRate}%) を維持できています。予算管理がしっかり機能しています。`;
  } else {
    grade = 'B';
    title = '黒字をキープできています';
    advice = `プラス収支で着地できています。固定費の定期的な見直しでさらに貯蓄率を高められます。`;
  }

  // 最大支出カテゴリの算出
  const sortedCats = Object.entries(summary.categoryExpenses).sort((a, b) => b[1] - a[1]);
  let topCatText = 'なし';
  if (sortedCats.length > 0) {
    const topCat = getCategoryInfo(sortedCats[0][0], 'expense');
    topCatText = `${topCat.name} (¥${formatCurrency(sortedCats[0][1])})`;
  }

  const container = document.getElementById('reportModalBody');
  container.innerHTML = `
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
        <div class="report-stat-val" style="font-size:1rem; margin-top:6px;">${topCatText}</div>
      </div>
    </div>

    <div class="report-advice-box">
      <strong>💡 アドバイス:</strong><br>
      ${advice}
    </div>
  `;

  showModal('monthlyReportModal');
}

// ==========================================
// 10. データ連携 (CSV & JSON)
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
      `"${r.id}"`,
      `"${r.date}"`,
      `"${r.type === 'expense' ? '支出' : '収入'}"`,
      `"${cat.name}"`,
      r.amount,
      `"${pay}"`,
      `"${(r.note || '').replace(/"/g, '""')}"`,
      `"${r.isFixed ? '固定費' : '変動費'}"`,
      `"${r.createdAt || ''}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `kakeibo_export_${getCurrentYearMonth()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('CSVファイルをダウンロードしました', 'success');
}

function exportDataAsJSON() {
  const fullData = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    records: AppState.records,
    budgets: AppState.budgets
  };

  const jsonStr = JSON.stringify(fullData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `kakeibo_backup_${getCurrentYearMonth()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('完全バックアップJSONを出力しました', 'success');
}

function importDataFromJSON(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && Array.isArray(data.records)) {
        AppState.records = data.records;
        if (data.budgets) {
          AppState.budgets = data.budgets;
        }
        saveRecordsToStorage();
        saveBudgetsToStorage();
        showToast(`バックアップから ${data.records.length} 件のデータを復元しました！`, 'success');
        renderAll();
      } else {
        showToast('無効なJSONファイルフォーマットです', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('JSONファイルの読み込みに失敗しました', 'error');
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (!confirm('本当に全てのデータを初期化しますか？\n※この操作は取り消せません。必要に応じて事前にバックアップを取得してください。')) {
    return;
  }

  AppState.records = [];
  AppState.budgets = {};
  saveRecordsToStorage();
  saveBudgetsToStorage();
  showToast('全データをリセットしました', 'info');
  renderAll();
}

function loadSampleData() {
  if (AppState.records.length > 0) {
    if (!confirm('サンプルデータを投入しますか？現在のデータに追加されます。')) return;
  }

  const samples = generateSampleRecords();
  AppState.records = [...AppState.records, ...samples];
  AppState.budgets = { ...AppState.budgets, ...generateSampleBudgets() };
  saveRecordsToStorage();
  saveBudgetsToStorage();
  showToast('サンプルデータを追加しました！', 'success');
  renderAll();
}

// ==========================================
// 11. モーダル・タブ・テーマ制御ヘルパー
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

  // デスクトップ＆モバイルのナビボタンのアクティブ更新
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // タブペインのアクティブ更新
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  const targetPane = document.getElementById(`pane-${tabId}`);
  if (targetPane) {
    targetPane.classList.add('active');
  }

  // タブごとの再描画
  if (tabId === 'analytics') {
    setTimeout(renderAnalytics, 50);
  } else if (tabId === 'records') {
    renderRecordsList();
  } else if (tabId === 'budget') {
    renderBudgetSection();
  } else if (tabId === 'dashboard') {
    renderDashboard();
  }
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEY_THEME, next);

  const themeText = document.querySelector('.theme-text');
  if (themeText) {
    themeText.textContent = next === 'dark' ? 'ライトモード' : 'ダークモード';
  }

  // チャート再描画（境界線色など）
  renderAll();
}

function changeMonth(delta) {
  const [y, m] = AppState.currentMonth.split('-').map(Number);
  let newY = y;
  let newM = m + delta;
  if (newM > 12) {
    newM = 1;
    newY += 1;
  } else if (newM < 1) {
    newM = 12;
    newY -= 1;
  }

  AppState.currentMonth = `${newY}-${String(newM).padStart(2, '0')}`;
  renderAll();
}

// ==========================================
// 12. イベントリスナー登録・アプリ初期化
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

  // 「すべて見る」ボタン
  document.getElementById('viewAllRecordsBtn')?.addEventListener('click', () => {
    switchTab('records');
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
      renderAll();
    }
  });

  // 取引モーダル
  document.getElementById('openAddModalBtn')?.addEventListener('click', openAddTransactionModal);
  document.getElementById('mobileAddFabBtn')?.addEventListener('click', openAddTransactionModal);
  document.getElementById('closeTransactionModalBtn')?.addEventListener('click', () => closeModal('transactionModal'));
  document.getElementById('cancelTransactionModalBtn')?.addEventListener('click', () => closeModal('transactionModal'));
  document.getElementById('transactionForm')?.addEventListener('submit', handleTransactionFormSubmit);

  // 収支種別ラジオ切替
  document.getElementById('typeExpenseRadio')?.addEventListener('change', () => setTransactionType('expense'));
  document.getElementById('typeIncomeRadio')?.addEventListener('change', () => setTransactionType('income'));

  // 金額クイック加算チップ
  document.querySelectorAll('.quick-amounts-bar .btn-chip[data-add]').forEach(chip => {
    chip.addEventListener('click', () => {
      const addVal = Number(chip.dataset.add);
      const input = document.getElementById('txAmountInput');
      const current = Number(input.value) || 0;
      input.value = current + addVal;
    });
  });

  document.getElementById('clearAmountChip')?.addEventListener('click', () => {
    document.getElementById('txAmountInput').value = '';
  });

  // 予算モーダル
  document.getElementById('openTotalBudgetModalBtn')?.addEventListener('click', openTotalBudgetModal);
  document.getElementById('closeTotalBudgetModalBtn')?.addEventListener('click', () => closeModal('totalBudgetModal'));
  document.getElementById('cancelTotalBudgetModalBtn')?.addEventListener('click', () => closeModal('totalBudgetModal'));
  document.getElementById('totalBudgetForm')?.addEventListener('submit', handleTotalBudgetSubmit);

  document.getElementById('openCategoryBudgetSetupBtn')?.addEventListener('click', openCategoryBudgetModal);
  document.getElementById('closeCategoryBudgetModalBtn')?.addEventListener('click', () => closeModal('categoryBudgetModal'));
  document.getElementById('cancelCategoryBudgetModalBtn')?.addEventListener('click', () => closeModal('categoryBudgetModal'));
  document.getElementById('categoryBudgetForm')?.addEventListener('submit', handleCategoryBudgetSubmit);

  // 振り返りレポート
  document.getElementById('openMonthlyReportBtn')?.addEventListener('click', openMonthlyReportModal);
  document.getElementById('closeReportModalBtn')?.addEventListener('click', () => closeModal('monthlyReportModal'));
  document.getElementById('closeReportFooterBtn')?.addEventListener('click', () => closeModal('monthlyReportModal'));

  // フィルタ & 検索
  const searchInput = document.getElementById('recordSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  searchInput?.addEventListener('input', (e) => {
    AppState.filters.query = e.target.value;
    if (clearSearchBtn) {
      clearSearchBtn.style.display = e.target.value ? 'block' : 'none';
    }
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

  // 設定タブのデータ入出力
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

  // モーダル背景クリックで閉じる
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('show');
        backdrop.setAttribute('aria-hidden', 'true');
      }
    });
  });

  // ESCキーでモーダル閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.show').forEach(modal => {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
      });
    }
  });
}

function initApp() {
  // テーマ初期化
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  const themeText = document.querySelector('.theme-text');
  if (themeText) {
    themeText.textContent = savedTheme === 'dark' ? 'ライトモード' : 'ダークモード';
  }

  // データロード
  loadStateFromStorage();

  // カテゴリドロップダウン初期化
  initCategoryFilterDropdown();

  // イベント登録
  setupEventListeners();

  // 初回全画面レンダリング
  renderAll();
}

// DOM読み込み完了時に起動
document.addEventListener('DOMContentLoaded', initApp);
