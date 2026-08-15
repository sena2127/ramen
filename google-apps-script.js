/**
 * ==============================================================================
 * SmartKakeibo - Google スプレッドシート連携用 Google Apps Script (GAS)
 * ==============================================================================
 * 
 * 【使い方】
 * 1. Google スプレッドシートを新規作成（または開く）
 * 2. ツールバーの「拡張機能」>「Apps Script」を開く
 * 3. エディタにこのファイルの内容をすべて貼り付けて保存（Ctrl + S / Cmd + S）
 * 4. 実行関数で「setup」を選択して一度「実行」をクリック（アクセス権限を承認）
 * 5. 右上の「デプロイ」>「新しいデプロイ」を選択
 *    - 種類の選択（歯車）:「ウェブアプリ」
 *    - 次のユーザーとして実行:「自分」
 *    - アクセスできるユーザー:「全員 (Anyone)」
 * 6. 発行された「ウェブアプリ URL (https://script.google.com/macros/s/.../exec)」を
 *    家計簿アプリの設定画面に貼り付ければ連携完了です！
 * ==============================================================================
 */

// 設定定数
var SHEET_NAME = '家計簿データ';
var HEADERS = ['ID', '日付', '収支区分', 'カテゴリ', '金額', '支払方法', 'メモ', '固定費', '登録日時'];

/**
 * スプレッドシートを開いた時にカスタムメニューを追加
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 家計簿アプリ連携')
    .addItem('🛠️ シートの初期セットアップ / ヘッダー修復', 'setup')
    .addSeparator()
    .addItem('📈 データ件数・集計チェック', 'checkDataSummary')
    .addItem('💡 Webアプリ導入手順ガイド', 'showHelpDialog')
    .addToUi();
}

/**
 * 初期セットアップ（シート作成・ヘッダー装飾・列幅・書式設定）
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    // 最初のシートの名前を変更または新規作成
    if (ss.getSheets().length === 1 && ss.getActiveSheet().getLastRow() === 0) {
      sheet = ss.getActiveSheet();
      sheet.setName(SHEET_NAME);
    } else {
      sheet = ss.insertSheet(SHEET_NAME, 0);
    }
  }

  // 1行目を固定
  sheet.setFrozenRows(1);

  // ヘッダーがなければ追加
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else {
    // 1行目を上書き
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  // ヘッダー行のデザイン・装飾
  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setBackground('#0f9d58')
             .setFontColor('#ffffff')
             .setFontWeight('bold')
             .setHorizontalAlignment('center')
             .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 35);

  // 列のフォーマットと幅の調整
  // A: ID (文字列)
  sheet.getRange('A:A').setNumberFormat('@');
  sheet.setColumnWidth(1, 180);
  
  // B: 日付 (yyyy-MM-dd)
  sheet.getRange('B2:B').setNumberFormat('yyyy-MM-dd').setHorizontalAlignment('center');
  sheet.setColumnWidth(2, 110);
  
  // C: 収支区分
  sheet.getRange('C2:C').setHorizontalAlignment('center');
  sheet.setColumnWidth(3, 90);
  
  // D: カテゴリ
  sheet.setColumnWidth(4, 130);
  
  // E: 金額 (通貨表示)
  sheet.getRange('E2:E').setNumberFormat('#,##0').setHorizontalAlignment('right');
  sheet.setColumnWidth(5, 110);
  
  // F: 支払方法
  sheet.setColumnWidth(6, 130);
  
  // G: メモ
  sheet.setColumnWidth(7, 240);
  
  // H: 固定費
  sheet.getRange('H2:H').setHorizontalAlignment('center');
  sheet.setColumnWidth(8, 80);
  
  // I: 登録日時
  sheet.getRange('I2:I').setNumberFormat('yyyy-MM-dd HH:mm:ss');
  sheet.setColumnWidth(9, 160);

  // グリッド線の表示
  sheet.setShowGridLines(true);

  return 'セットアップが正常に完了しました！';
}

/**
 * POSTリクエスト処理 (Webアプリからの追加・更新・削除・一括同期)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'No payload found' });
    }

    var data = JSON.parse(e.postData.contents);
    var sheet = getTargetSheet();
    var action = data.action;

    // 1. 新規追加
    if (action === 'add') {
      var r = data.record;
      var newRow = [
        String(r.id),
        r.date,
        r.type === 'expense' ? '支出' : '収入',
        r.categoryName || r.category || '',
        Number(r.amount) || 0,
        r.paymentName || r.payment || '',
        r.note || '',
        r.isFixed ? '固定費' : '',
        r.createdAt || new Date().toISOString()
      ];
      sheet.appendRow(newRow);
      return createJsonResponse({ status: 'success', action: 'add', id: r.id });
    }

    // 2. 更新 (IDで該当行を探索)
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
        // 見つからなければ新規追加として記録
        sheet.appendRow([
          String(r.id),
          r.date,
          r.type === 'expense' ? '支出' : '収入',
          r.categoryName || r.category || '',
          Number(r.amount) || 0,
          r.paymentName || r.payment || '',
          r.note || '',
          r.isFixed ? '固定費' : '',
          r.createdAt || new Date().toISOString()
        ]);
      }
      return createJsonResponse({ status: 'success', action: 'edit', id: r.id });
    }

    // 3. 削除
    if (action === 'delete') {
      var rows = sheet.getDataRange().getValues();
      var targetId = String(data.id);
      var deleted = false;

      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === targetId) {
          sheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }
      return createJsonResponse({ status: 'success', action: 'delete', id: targetId, deleted: deleted });
    }

    // 4. 全データの一括上書き同期 (syncAll)
    if (action === 'syncAll') {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }

      var records = data.records || [];
      if (records.length > 0) {
        var rowsToAdd = records.map(function(r) {
          return [
            String(r.id),
            r.date,
            r.type === 'expense' ? '支出' : '収入',
            r.categoryName || r.category || '',
            Number(r.amount) || 0,
            r.paymentName || r.payment || '',
            r.note || '',
            r.isFixed ? '固定費' : '',
            r.createdAt || new Date().toISOString()
          ];
        });
        sheet.getRange(2, 1, rowsToAdd.length, HEADERS.length).setValues(rowsToAdd);
      }
      return createJsonResponse({ status: 'success', action: 'syncAll', count: records.length });
    }

    // 5. 接続テスト (ping)
    if (action === 'ping' || action === 'test') {
      return createJsonResponse({ status: 'success', message: 'SmartKakeibo GAS connected successfully!', timestamp: new Date().toISOString() });
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * GETリクエスト処理 (Webアプリへの全件データ返却または接続テスト)
 */
function doGet(e) {
  try {
    var sheet = getTargetSheet();
    var rows = sheet.getDataRange().getValues();
    var records = [];

    if (rows.length > 1) {
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (!row[0] && !row[1]) continue; // 空行スキップ

        // 日付の正規化 (Dateオブジェクトの場合は yyyy-MM-dd 形式に変換)
        var dateVal = row[1];
        var dateStr = '';
        if (dateVal instanceof Date) {
          dateStr = Utilities.formatDate(dateVal, Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd');
        } else {
          dateStr = String(dateVal).substring(0, 10);
        }

        records.push({
          id: String(row[0] || ('tx_imported_' + i)),
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

    return createJsonResponse({
      status: 'success',
      totalCount: records.length,
      records: records,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * 対象シートを取得（存在しなければ初期化）
 */
function getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_NAME) || ss.getActiveSheet();
  }
  return sheet;
}

/**
 * JSONレスポンスの生成ヘルパー
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * スプレッドシートメニュー用: データ集計ダイアログ
 */
function checkDataSummary() {
  var sheet = getTargetSheet();
  var rows = sheet.getDataRange().getValues();
  var expenseCount = 0, incomeCount = 0;
  var totalExpense = 0, totalIncome = 0;

  for (var i = 1; i < rows.length; i++) {
    var type = rows[i][2];
    var amount = Number(rows[i][4]) || 0;
    if (type === '支出') {
      expenseCount++;
      totalExpense += amount;
    } else if (type === '収入') {
      incomeCount++;
      totalIncome += amount;
    }
  }

  var ui = SpreadsheetApp.getUi();
  var msg = '【記録データ集計】\n' +
            '・総行数: ' + (rows.length - 1) + ' 件\n' +
            '・支出: ' + expenseCount + ' 件 (¥' + totalExpense.toLocaleString() + ')\n' +
            '・収入: ' + incomeCount + ' 件 (¥' + totalIncome.toLocaleString() + ')\n' +
            '・差額: ¥' + (totalIncome - totalExpense).toLocaleString();
  ui.alert('📊 集計結果', msg, ui.ButtonSet.OK);
}

/**
 * スプレッドシートメニュー用: ガイドダイアログ
 */
function showHelpDialog() {
  var ui = SpreadsheetApp.getUi();
  var msg = '【デプロイ手順】\n' +
            '1. 右上の「デプロイ」ボタン >「新しいデプロイ」をクリック\n' +
            '2. 歯車アイコンから「ウェブアプリ」を選択\n' +
            '3. 次のユーザーとして実行:「自分」\n' +
            '4. アクセスできるユーザー:「全員」に設定して「デプロイ」をクリック\n' +
            '5. 発行されたURLを家計簿アプリの設定画面に貼り付けてください。';
  ui.alert('💡 Webアプリ公開ガイド', msg, ui.ButtonSet.OK);
}

/**
 * Apps Script エディタ上での手動テスト用関数
 */
function testSetup() {
  var result = setup();
  Logger.log(result);
}
