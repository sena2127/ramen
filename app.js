/**
 * SmartKakeibo - カレンダー家計簿 ＆ Googleスプレッドシート連携スクリプト
 */

// ==========================================
// 1. 定数・カテゴリ定義・初期設定
// ==========================================

const STORAGE_KEY_RECORDS = 'smartkakeibo_records_v4_clean';
const STORAGE_KEY_THEME = 'smartkakeibo_theme_v3';
const STORAGE_KEY_SHEETS_URL = 'smartkakeibo_sheets_url_v1';
const STORAGE_KEY_NMD = 'smartkakeibo_nmd_days_v1';

// Google Apps Script 用のコードテンプレート（ユーザーがスプレッドシートに貼るコード）
const GAS_SCRIPT_CODE = `// ==============================================================================
// SmartKakeibo - Google スプレッドシート連携用スクリプト
// ==============================================================================

var SHEET_NAME = '家計簿データ';
var HEADERS = ['ID', '日付', '収支区分', 'カテゴリ', '金額', '支払方法', 'メモ', '固定費', '登録日時'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 家計簿アプリ連携')
    .addItem('🛠️ シートの初期セットアップ', 'setup')
    .addItem('📈 データ件数・集計チェック', 'checkDataSummary')
    .addToUi();
}

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    if (ss.getSheets().length === 1 && ss.getActiveSheet().getLastRow() === 0) {
      sheet = ss.getActiveSheet();
      sheet.setName(SHEET_NAME);
    } else {
      sheet = ss.insertSheet(SHEET_NAME, 0);
    }
  }
  sheet.setFrozenRows(1);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setBackground('#0f9d58').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(1, 35);
  sheet.getRange('A:A').setNumberFormat('@');
  sheet.getRange('B2:B').setNumberFormat('yyyy-MM-dd').setHorizontalAlignment('center');
  sheet.getRange('C2:C').setHorizontalAlignment('center');
  sheet.getRange('E2:E').setNumberFormat('#,##0').setHorizontalAlignment('right');
  sheet.getRange('H2:H').setHorizontalAlignment('center');
  sheet.getRange('I2:I').setNumberFormat('yyyy-MM-dd HH:mm:ss');
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 110);
  sheet.setColumnWidth(4, 130);
  sheet.setColumnWidth(5, 110);
  sheet.setColumnWidth(6, 130);
  sheet.setColumnWidth(7, 240);
  return 'セットアップが完了しました！';
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'No payload' });
    }
    var data = JSON.parse(e.postData.contents);
    var sheet = getTargetSheet();
    var action = data.action;

    if (action === 'add') {
      var r = data.record;
      sheet.appendRow([
        String(r.id), r.date, r.type === 'expense' ? '支出' : '収入',
        r.categoryName || r.category || '', Number(r.amount) || 0,
        r.paymentName || r.payment || '', r.note || '',
        r.isFixed ? '固定費' : '', r.createdAt || new Date().toISOString()
      ]);
      return createJsonResponse({ status: 'success', action: 'add', id: r.id });
    }

    if (action === 'edit') {
      var rows = sheet.getDataRange().getValues();
      var r = data.record;
      var found = false;
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(r.id)) {
          var rowIdx = i + 1;
          sheet.getRange(rowIdx, 2).setValue(r.date);
          sheet.getRange(rowIdx, 3).setValue(r.type === 'expense' ? '支出' : '収入');
          sheet.getRange(rowIdx, 4).setValue(r.categoryName || r.category || '');
          sheet.getRange(rowIdx, 5).setValue(Number(r.amount) || 0);
          sheet.getRange(rowIdx, 6).setValue(r.paymentName || r.payment || '');
          sheet.getRange(rowIdx, 7).setValue(r.note || '');
          sheet.getRange(rowIdx, 8).setValue(r.isFixed ? '固定費' : '');
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.appendRow([
          String(r.id), r.date, r.type === 'expense' ? '支出' : '収入',
          r.categoryName || r.category || '', Number(r.amount) || 0,
          r.paymentName || r.payment || '', r.note || '',
          r.isFixed ? '固定費' : '', r.createdAt || new Date().toISOString()
        ]);
      }
      return createJsonResponse({ status: 'success', action: 'edit', id: r.id });
    }

    if (action === 'delete') {
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.id)) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return createJsonResponse({ status: 'success', action: 'delete', id: data.id });
    }

    if (action === 'syncAll') {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
      var records = data.records || [];
      if (records.length > 0) {
        var rowsToAdd = records.map(function(r) {
          return [
            String(r.id), r.date, r.type === 'expense' ? '支出' : '収入',
            r.categoryName || r.category || '', Number(r.amount) || 0,
            r.paymentName || r.payment || '', r.note || '',
            r.isFixed ? '固定費' : '', r.createdAt || new Date().toISOString()
          ];
        });
        sheet.getRange(2, 1, rowsToAdd.length, HEADERS.length).setValues(rowsToAdd);
      }
      return createJsonResponse({ status: 'success', action: 'syncAll', count: records.length });
    }

    if (action === 'ping' || action === 'test') {
      return createJsonResponse({ status: 'success', message: 'SmartKakeibo GAS connected!' });
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch(err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function doGet(e) {
  try {
    var sheet = getTargetSheet();
    var rows = sheet.getDataRange().getValues();
    var records = [];
    if (rows.length > 1) {
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (!row[0] && !row[1]) continue;
        var dateVal = row[1];
        var dateStr = (dateVal instanceof Date)
          ? Utilities.formatDate(dateVal, Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd')
          : String(dateVal).substring(0, 10);
        records.push({
          id: String(row[0] || ('tx_' + i)),
          date: dateStr,
          type: row[2] === '支出' ? 'expense' : 'income',
          category: String(row[3] || 'other_exp'),
          amount: Number(row[4]) || 0,
          payment: String(row[5] || 'cash'),
          note: String(row[6] || ''),
          isFixed: row[7] === '固定費',
          createdAt: row[8] ? String(row[8]) : ''
        });
      }
    }
    return createJsonResponse({ status: 'success', totalCount: records.length, records: records });
  } catch(err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_NAME) || ss.getActiveSheet();
  }
  return sheet;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function checkDataSummary() {
  var sheet = getTargetSheet();
  var rows = sheet.getDataRange().getValues();
  var expCount = 0, incCount = 0, expSum = 0, incSum = 0;
  for (var i = 1; i < rows.length; i++) {
    var type = rows[i][2];
    var amount = Number(rows[i][4]) || 0;
    if (type === '支出') { expCount++; expSum += amount; }
    else if (type === '収入') { incCount++; incSum += amount; }
  }
  SpreadsheetApp.getUi().alert('📊 集計結果', '行数: ' + (rows.length - 1) + '件\\n支出: ' + expCount + '件 (¥' + expSum.toLocaleString() + ')\\n収入: ' + incCount + '件 (¥' + incSum.toLocaleString() + ')\\n差額: ¥' + (incSum - expSum).toLocaleString(), SpreadsheetApp.getUi().ButtonSet.OK);
}`;

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
  'cash': { name: '現金', icon: 'fa-money-bill-wave' },
  'credit': { name: 'クレジットカード', icon: 'fa-credit-card' },
  'e-money': { name: '電子マネー/QR', icon: 'fa-mobile-screen-button' },
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
  records: [],                         // 空の状態でスタート（サンプルデータなし）
  nmdDays: [],                         // ノーマネーデー（やったね！達成日: ["YYYY-MM-DD", ...]）
  sheetsUrl: '',                       // Google Apps Script Webhook URL
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
  const found = pool.find(c => c.id === categoryId || c.name === categoryId);
  if (found) return found;

  const allPool = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const anyFound = allPool.find(c => c.id === categoryId || c.name === categoryId);
  if (anyFound) return anyFound;

  return { id: categoryId, name: categoryId || '未分類', icon: 'fa-circle-question', color: '#94a3b8' };
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
// 4. データストア層 (LocalStorage & Sheets)
// ==========================================

function loadStateFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
    if (raw) {
      AppState.records = JSON.parse(raw);
    } else {
      // 初期値は完全な空配列（サンプルデータなし）
      AppState.records = [];
      saveRecordsToStorage();
    }

    // ノーマネーデー (NMD) 達成日一覧ロード
    const rawNmd = localStorage.getItem(STORAGE_KEY_NMD);
    if (rawNmd) {
      try {
        AppState.nmdDays = JSON.parse(rawNmd) || [];
      } catch {
        AppState.nmdDays = [];
      }
    } else {
      AppState.nmdDays = [];
    }

    // スプレッドシート連携URLロード
    const savedUrl = localStorage.getItem(STORAGE_KEY_SHEETS_URL);
    if (savedUrl) {
      AppState.sheetsUrl = savedUrl;
    }
  } catch (e) {
    console.error('Storage error:', e);
    AppState.records = [];
    AppState.nmdDays = [];
  }
}

function saveRecordsToStorage() {
  localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(AppState.records));
}

function saveNmdDaysToStorage() {
  localStorage.setItem(STORAGE_KEY_NMD, JSON.stringify(AppState.nmdDays));
}

/**
 * やったね！達成時のファンファーレ効果音 (Web Audio API)
 */
function playCelebrationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // 明るいファンファーレ音階 (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const startTime = ctx.currentTime;
    
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime + index * 0.09);
      
      gain.gain.setValueAtTime(0.22, startTime + index * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + index * 0.09 + (index === 3 ? 0.45 : 0.22));
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime + index * 0.09);
      osc.stop(startTime + index * 0.09 + (index === 3 ? 0.5 : 0.25));
    });
  } catch (e) {
    // 音声再生がブロックされた場合は静かに無視
  }
}

/**
 * ノーマネーデー（やったね！）の切り替え登録・解除
 */
function toggleNoMoneyDay(dateStr = AppState.selectedDate) {
  const index = AppState.nmdDays.indexOf(dateStr);
  const [y, m, d] = dateStr.split('-');
  const formattedDate = `${Number(m)}月${Number(d)}日`;

  if (index >= 0) {
    // 解除
    AppState.nmdDays.splice(index, 1);
    saveNmdDaysToStorage();
    showToast(`${formattedDate} のノーマネーデー記録を解除しました`, 'info');
  } else {
    // 達成！
    // 支出があるか確認
    const hasExpense = AppState.records.some(r => r.date === dateStr && r.type === 'expense' && Number(r.amount) > 0);
    if (hasExpense) {
      showToast('支出が記録されている日はノーマネーデーに登録できません', 'error');
      return;
    }

    AppState.nmdDays.push(dateStr);
    saveNmdDaysToStorage();
    
    // 演出：紙吹雪 & サウンド & トースト
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
    playCelebrationSound();
    showToast(`🎉 やったね！${formattedDate} をノーマネーデーに記録しました！👏`, 'success');
  }

  renderCalendar();
  renderSelectedDayDetails();
  renderSummaryCards();
}

// ==========================================
// 5. Googleスプレッドシート・リアルタイム連携エンジン
// ==========================================

function updateSheetsStatusUI() {
  const isConnected = !!AppState.sheetsUrl;

  const sidebarStatus = document.getElementById('sidebarSheetsStatusLabel');
  const statusDot = document.getElementById('sheetsStatusDot');
  const headerStatus = document.getElementById('headerSheetsStatusText');
  const headerPill = document.getElementById('headerSheetsPill');
  const settingsBadge = document.getElementById('settingsSheetsBadge');
  const urlInput = document.getElementById('sheetsWebAppUrlInput');

  if (urlInput && !urlInput.value && AppState.sheetsUrl) {
    urlInput.value = AppState.sheetsUrl;
  }

  if (isConnected) {
    if (sidebarStatus) sidebarStatus.textContent = 'シート連携中';
    if (statusDot) statusDot.className = 'sheets-status-dot connected';
    if (headerStatus) headerStatus.textContent = '🟢 シート連携中';
    if (headerPill) headerPill.className = 'btn-sheets-pill connected';
    if (settingsBadge) {
      settingsBadge.textContent = '連携中';
      settingsBadge.className = 'sheets-badge connected';
    }
  } else {
    if (sidebarStatus) sidebarStatus.textContent = 'シート未連携';
    if (statusDot) statusDot.className = 'sheets-status-dot';
    if (headerStatus) headerStatus.textContent = 'シート未連携';
    if (headerPill) headerPill.className = 'btn-sheets-pill';
    if (settingsBadge) {
      settingsBadge.textContent = '未接続';
      settingsBadge.className = 'sheets-badge';
    }
  }
}

function saveSheetsUrl(url) {
  const cleanUrl = url.trim();
  AppState.sheetsUrl = cleanUrl;
  localStorage.setItem(STORAGE_KEY_SHEETS_URL, cleanUrl);
  updateSheetsStatusUI();

  if (cleanUrl) {
    showToast('スプレッドシート連携URLを保存しました！', 'success');
  } else {
    showToast('スプレッドシート連携を解除しました', 'info');
  }
}

/**
 * スプレッドシートへリアルタイム送信 (add, edit, delete, syncAll)
 */
async function syncToSpreadsheet(action, payload) {
  if (!AppState.sheetsUrl) return;

  try {
    let bodyData = { action };

    if (action === 'add' || action === 'edit') {
      const cat = getCategoryInfo(payload.category, payload.type);
      const pay = PAYMENT_METHODS[payload.payment]?.name || payload.payment;
      bodyData.record = {
        ...payload,
        categoryName: cat.name,
        paymentName: pay
      };
    } else if (action === 'delete') {
      bodyData.id = payload.id;
    } else if (action === 'syncAll') {
      bodyData.records = AppState.records.map(r => {
        const cat = getCategoryInfo(r.category, r.type);
        const pay = PAYMENT_METHODS[r.payment]?.name || r.payment;
        return {
          ...r,
          categoryName: cat.name,
          paymentName: pay
        };
      });
    }

    // Google Apps Script の Web App に送信
    await fetch(AppState.sheetsUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData)
    });

    console.log(`Sheets synced: [${action}]`);
  } catch (err) {
    console.error('Sheets sync error:', err);
  }
}

/**
 * スプレッドシートから全件再読み込み
 */
async function loadFromSpreadsheet() {
  if (!AppState.sheetsUrl) {
    showToast('先にスプレッドシートのURLを設定してください', 'error');
    return;
  }

  showToast('スプレッドシートからデータを取得中...', 'info');

  try {
    const res = await fetch(AppState.sheetsUrl);
    const data = await res.json();

    if (data && data.status === 'success' && Array.isArray(data.records)) {
      AppState.records = data.records;
      saveRecordsToStorage();
      showToast(`スプレッドシートから ${data.records.length} 件のデータを読み込みました！`, 'success');
      renderAll();
    } else {
      showToast('スプレッドシートからのデータ取得に失敗しました', 'error');
    }
  } catch (err) {
    console.error('Fetch from sheets error:', err);
    showToast('スプレッドシートにアクセスできませんでした。URLと公開設定（全員）を確認してください。', 'error');
  }
}

/**
 * 全データをスプレッドシートへ強制同期
 */
async function syncAllToSpreadsheet() {
  if (!AppState.sheetsUrl) {
    showToast('先にスプレッドシートのURLを設定してください', 'error');
    return;
  }

  showToast('スプレッドシートへ全データを送信中...', 'info');
  await syncToSpreadsheet('syncAll', {});
  showToast(`スプレッドシートに ${AppState.records.length} 件のデータを同期しました！`, 'success');
}

// ==========================================
// 6. 集計計算ロジック
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
  const dailyData = {};

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
// 7. UI レンダリング
// ==========================================

function renderAll() {
  updatePeriodHeader();
  updateSheetsStatusUI();
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

  // ノーマネーデー (NMD) 達成日数の計算＆表示
  const nmdThisMonth = AppState.nmdDays.filter(d => d.startsWith(AppState.currentMonth)).length;
  const nmdBadge = document.getElementById('summaryNmdBadge');
  if (nmdBadge) {
    nmdBadge.innerHTML = `<i class="fa-solid fa-award"></i> 達成: <strong>${nmdThisMonth}日</strong>`;
  }
}

// ==========================================
// 8. カレンダー描画エンジン (週計カラム対応)
// ==========================================

function renderCalendar() {
  const grid = document.getElementById('calendarDaysGrid');
  if (!grid) return;

  grid.innerHTML = '';

  const [year, month] = AppState.currentMonth.split('-').map(Number);
  const summary = calculateMonthSummary(AppState.currentMonth);
  const todayStr = getTodayDateString();

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const prevMonthTotalDays = new Date(year, month - 1, 0).getDate();

  const allDayItems = [];

  // 1. 前月余白
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    let prevM = month - 1;
    let prevY = year;
    if (prevM < 1) { prevM = 12; prevY -= 1; }
    const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayOfWeek = (firstDayOfWeek - 1 - i + 7) % 7;

    allDayItems.push({
      dayNum,
      dateStr,
      dayOfWeek,
      isOtherMonth: true,
      isToday: false,
      isSelected: dateStr === AppState.selectedDate
    });
  }

  // 2. 当月
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === AppState.selectedDate;

    allDayItems.push({
      dayNum: d,
      dateStr,
      dayOfWeek,
      isToday,
      isSelected,
      isOtherMonth: false
    });
  }

  // 3. 翌月余白
  const currentTotalCells = allDayItems.length;
  const nextMonthCells = (7 - (currentTotalCells % 7)) % 7;

  for (let d = 1; d <= nextMonthCells; d++) {
    let nextM = month + 1;
    let nextY = year;
    if (nextM > 12) { nextM = 1; nextY += 1; }
    const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = (currentTotalCells + d - 1) % 7;

    allDayItems.push({
      dayNum: d,
      dateStr,
      dayOfWeek,
      isOtherMonth: true,
      isToday: false,
      isSelected: dateStr === AppState.selectedDate
    });
  }

  // 4. 7日ごとに週計セル（行ごとの収支）を挟んで配置
  const totalWeeks = allDayItems.length / 7;

  for (let w = 0; w < totalWeeks; w++) {
    const weekDays = allDayItems.slice(w * 7, (w + 1) * 7);
    let weekExpense = 0;
    let weekIncome = 0;
    const weekDates = weekDays.map(item => item.dateStr);

    weekDays.forEach(item => {
      const cell = createCalendarCell({
        ...item,
        summary
      });
      grid.appendChild(cell);

      const dayData = summary.dailyData[item.dateStr] || { expense: 0, income: 0 };
      weekExpense += dayData.expense;
      weekIncome += dayData.income;
    });

    const weekTotalCell = createWeekTotalCell({
      weekIndex: w + 1,
      weekExpense,
      weekIncome,
      weekDates
    });
    grid.appendChild(weekTotalCell);
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

  const isNmdAchieved = AppState.nmdDays.includes(dateStr);
  if (isNmdAchieved) {
    cell.classList.add('is-nmd');
  }

  const dayData = summary.dailyData[dateStr] || { expense: 0, income: 0, count: 0 };

  let amountsHtml = '';
  if (dayData.income > 0) {
    amountsHtml += `<span class="cal-amt-row cal-amt-income">+¥${formatCurrency(dayData.income)}</span>`;
  }
  if (dayData.expense > 0) {
    amountsHtml += `<span class="cal-amt-row cal-amt-expense">-¥${formatCurrency(dayData.expense)}</span>`;
  }

  // ノーマネーデーのスタンプバッジ
  let nmdStampHtml = '';
  if (isNmdAchieved && dayData.expense === 0) {
    nmdStampHtml = `<div class="cal-nmd-stamp"><i class="fa-solid fa-award"></i> やったね!</div>`;
  }

  cell.innerHTML = `
    <div class="cal-day-header">
      <span class="cal-day-num">${dayNum}</span>
      ${dayData.count > 0 ? `<span class="cal-day-badge-count">${dayData.count}件</span>` : ''}
    </div>
    <div class="cal-day-amounts">
      ${nmdStampHtml}
      ${amountsHtml}
    </div>
  `;

  cell.addEventListener('click', () => {
    selectCalendarDate(dateStr);
  });

  return cell;
}

function createWeekTotalCell({ weekIndex, weekExpense, weekIncome, weekDates }) {
  const cell = document.createElement('div');
  cell.className = 'cal-week-total-cell';

  const balance = weekIncome - weekExpense;
  const isNetPositive = balance >= 0;

  let incHtml = '';
  if (weekIncome > 0) {
    incHtml = `<div class="cal-week-val cal-week-inc">+¥${formatCurrency(weekIncome)}</div>`;
  }

  cell.innerHTML = `
    <div class="cal-week-total-header">
      <span class="cal-week-badge">第${weekIndex}週</span>
    </div>
    <div class="cal-week-amounts">
      <span class="cal-week-label">週支出</span>
      <div class="cal-week-val cal-week-exp">-¥${formatCurrency(weekExpense)}</div>
      ${incHtml}
      <div class="cal-week-net" style="color: ${isNetPositive ? 'var(--income-main)' : 'var(--expense-main)'};">
        ${isNetPositive ? '+' : ''}¥${formatCurrency(balance)}
      </div>
    </div>
  `;

  cell.addEventListener('click', () => {
    selectWeekTotal(weekIndex, weekDates, weekExpense, weekIncome);
  });

  return cell;
}

function selectCalendarDate(dateStr) {
  AppState.selectedDate = dateStr;

  document.querySelectorAll('.cal-day-cell').forEach(c => {
    if (c.dataset.date === dateStr) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });

  renderSelectedDayDetails();
}

function selectWeekTotal(weekIndex, weekDates, weekExpense, weekIncome) {
  document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));

  const label = document.getElementById('selectedDateLabel');
  const summaryEl = document.getElementById('selectedDateSummary');
  const list = document.getElementById('selectedDateTxList');
  const empty = document.getElementById('selectedDateEmptyState');
  const nmdBox = document.getElementById('nmdActionBox');
  if (nmdBox) nmdBox.innerHTML = '';

  if (!label || !list || !empty) return;

  label.textContent = `第${weekIndex}週のまとめ`;
  summaryEl.innerHTML = `週支出 <strong style="color:var(--expense-main);">¥${formatCurrency(weekExpense)}</strong> / 週収入 <strong style="color:var(--income-main);">¥${formatCurrency(weekIncome)}</strong>`;

  const weekRecords = AppState.records.filter(r => weekDates.includes(r.date));

  list.innerHTML = '';
  if (weekRecords.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'flex';
  } else {
    list.style.display = 'flex';
    empty.style.display = 'none';
    weekRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
    weekRecords.forEach(r => {
      list.appendChild(createTransactionElement(r));
    });
  }
}

function renderSelectedDayDetails() {
  const label = document.getElementById('selectedDateLabel');
  const summaryEl = document.getElementById('selectedDateSummary');
  const list = document.getElementById('selectedDateTxList');
  const empty = document.getElementById('selectedDateEmptyState');
  const nmdBox = document.getElementById('nmdActionBox');
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

  // ノーマネーデー（やったね！）アクションボックスの描画
  if (nmdBox) {
    const isNmdAchieved = AppState.nmdDays.includes(AppState.selectedDate);

    if (expSum === 0) {
      if (isNmdAchieved) {
        nmdBox.innerHTML = `
          <div class="nmd-card nmd-achieved">
            <div class="nmd-achieved-top">
              <div class="nmd-achieved-badge">
                <i class="fa-solid fa-award"></i>
                <span>やったね！ノーマネーデー達成中</span>
              </div>
              <button class="btn-nmd-cancel" id="toggleNmdBtn" title="達成の記録を解除する">
                <i class="fa-solid fa-rotate-left"></i> 解除
              </button>
            </div>
            <p class="nmd-achieved-desc">🎉 素晴らしい！この日はお金を使わずに過ごせました👏</p>
          </div>
        `;
      } else {
        nmdBox.innerHTML = `
          <div class="nmd-card nmd-ready">
            <div class="nmd-ready-header">
              <span class="nmd-ready-icon">🎉</span>
              <div>
                <div class="nmd-ready-title">支出ゼロのノーマネーデー！</div>
                <div class="nmd-ready-desc">お金を使わなかった日を記録してモチベーションを高めよう</div>
              </div>
            </div>
            <button class="btn-nmd-trigger" id="toggleNmdBtn">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
              <span>やったね！を記録する</span>
            </button>
          </div>
        `;
      }

      const toggleBtn = document.getElementById('toggleNmdBtn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          toggleNoMoneyDay(AppState.selectedDate);
        });
      }
    } else {
      // 支出がある日はアクションボックスをクリア
      nmdBox.innerHTML = '';
    }
  }

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
// 9. 収支明細一覧 (Records Tab)
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
// 10. 統計 & グラフ (Analytics Tab)
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
// 11. 取引モーダル制御 & CRUD (リアルタイム連携)
// ==========================================

function openAddTransactionModal(presetDate = null) {
  AppState.activeEditingId = null;
  document.getElementById('transactionModalTitle').textContent = '収支を記録';
  document.getElementById('txIdInput').value = '';
  document.getElementById('txAmountInput').value = '';
  document.getElementById('txPaymentSelect').value = 'cash';
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
  document.getElementById('txPaymentSelect').value = record.payment || 'cash';
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
      const updatedRecord = {
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
      AppState.records[index] = updatedRecord;
      showToast('記録を更新しました', 'success');

      // スプレッドシートへリアルタイム同期
      syncToSpreadsheet('edit', updatedRecord);
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
    showToast('収支を追加しました！', 'success');

    // スプレッドシートへリアルタイム同期
    syncToSpreadsheet('add', newRecord);
  }

  if (type === 'expense' && amount > 0) {
    if (AppState.nmdDays.includes(date)) {
      AppState.nmdDays = AppState.nmdDays.filter(d => d !== date);
      saveNmdDaysToStorage();
    }
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

  // スプレッドシートへリアルタイム同期
  syncToSpreadsheet('delete', { id });

  renderAll();
}

// ==========================================
// 12. レポート ＆ データ出力
// ==========================================

function openMonthlyReportModal() {
  const summary = calculateMonthSummary(AppState.currentMonth);
  const [y, m] = AppState.currentMonth.split('-');
  document.getElementById('reportModalTitle').textContent = `${y}年 ${Number(m)}月の家計簿レポート`;

  const nmdThisMonth = AppState.nmdDays.filter(d => d.startsWith(AppState.currentMonth)).length;

  let grade = 'A';
  let title = '順調な家計管理です！';
  let advice = '';

  if (summary.totalExpense === 0 && summary.totalIncome === 0 && nmdThisMonth === 0) {
    grade = '-';
    title = 'データがありません';
    advice = 'カレンダーから収支を記録したり、お金を使わなかった日に「やったね！」を記録すると、詳細な分析が表示されます。';
  } else if (summary.balance < 0) {
    grade = 'D';
    title = '赤字です！支出の見直しが必要です';
    advice = `今月は支出が収入を ¥${formatCurrency(Math.abs(summary.balance))} 上回っています。食費や交際費などの変動費を見直してみましょう。`;
  } else if (summary.savingRate >= 30 || nmdThisMonth >= 10) {
    grade = 'S';
    title = '素晴らしい家計管理です！';
    advice = `ノーマネーデー（やったね！）を ${nmdThisMonth} 日達成し、堅実な資産形成ができています！この調子で継続しましょう。👏`;
    if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  } else {
    grade = 'A';
    title = '理想的な黒字バランスです！';
    advice = `黒字額 ¥${formatCurrency(summary.balance)} (貯蓄率${summary.savingRate}%) / ノーマネーデー ${nmdThisMonth}日 達成を維持できています。`;
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
        <span class="report-stat-label">ノーマネーデー</span>
        <div class="report-stat-val" style="color:#f59e0b; font-weight:800;"><i class="fa-solid fa-award"></i> ${nmdThisMonth} 日達成</div>
      </div>
      <div class="report-stat-box">
        <span class="report-stat-label">最大支出項目</span>
        <div class="report-stat-val" style="font-size:0.95rem; margin-top:4px;">${topCatText}</div>
      </div>
    </div>
    <div class="report-advice-box">
      <strong>💡 アドバイス:</strong><br>${advice}
    </div>
  `;

  showModal('monthlyReportModal');
}

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
  const data = {
    version: '4.1',
    exportDate: new Date().toISOString(),
    records: AppState.records,
    nmdDays: AppState.nmdDays
  };
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
      if (data && (Array.isArray(data.records) || Array.isArray(data.nmdDays))) {
        if (Array.isArray(data.records)) {
          AppState.records = data.records;
          saveRecordsToStorage();
        }
        if (Array.isArray(data.nmdDays)) {
          AppState.nmdDays = data.nmdDays;
          saveNmdDaysToStorage();
        }
        showToast(`データを正常に復元しました！`, 'success');
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
  if (!confirm('本当に全データを初期化しますか？\n保存されているすべての収支データおよびノーマネーデー記録が消去されます。')) return;
  AppState.records = [];
  AppState.nmdDays = [];
  saveRecordsToStorage();
  saveNmdDaysToStorage();
  showToast('全データをリセットしました。新しい家計簿を開始できます！', 'info');
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

function openSheetsGuideModal() {
  const textarea = document.getElementById('gasCodeTextarea');
  if (textarea) {
    textarea.value = GAS_SCRIPT_CODE;
  }
  showModal('sheetsGuideModal');
}

function copyGasCode() {
  const textarea = document.getElementById('gasCodeTextarea');
  if (!textarea) return;
  textarea.select();
  navigator.clipboard.writeText(textarea.value).then(() => {
    showToast('Apps Script コードをクリップボードにコピーしました！', 'success');
  }).catch(() => {
    showToast('コピーに失敗しました。テキストエリアから手動でコピーしてください', 'error');
  });
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

  // スプレッドシート連携
  document.getElementById('openSheetsSetupBtn')?.addEventListener('click', () => switchTab('settings'));
  document.getElementById('headerSheetsPill')?.addEventListener('click', () => switchTab('settings'));
  document.getElementById('openSheetsGuideModalBtn')?.addEventListener('click', openSheetsGuideModal);
  document.getElementById('closeSheetsGuideModalBtn')?.addEventListener('click', () => closeModal('sheetsGuideModal'));
  document.getElementById('closeSheetsGuideFooterBtn')?.addEventListener('click', () => closeModal('sheetsGuideModal'));
  document.getElementById('copyGasCodeBtn')?.addEventListener('click', copyGasCode);

  document.getElementById('saveSheetsUrlBtn')?.addEventListener('click', () => {
    const input = document.getElementById('sheetsWebAppUrlInput');
    if (input) saveSheetsUrl(input.value);
  });

  document.getElementById('syncAllToSheetsBtn')?.addEventListener('click', syncAllToSpreadsheet);
  document.getElementById('fetchFromSheetsBtn')?.addEventListener('click', loadFromSpreadsheet);

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
