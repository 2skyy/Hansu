/**
 * 한수런런 백엔드 (Google Apps Script)
 * ---------------------------------------------------------------------
 * 스프레드시트 하나로 러닝 인증과 스탬프를 받아 집계해 돌려줍니다.
 * 서버를 따로 빌리지 않아도 되고, 운영자는 시트에서 눈으로 검수합니다.
 *
 * [설치]
 *  1. 구글 드라이브에서 스프레드시트를 새로 만듭니다.
 *  2. 확장 프로그램 > Apps Script 를 열고 이 파일 내용을 붙여넣습니다.
 *  3. 아래 setup() 을 한 번 실행하면 시트 3개가 자동으로 만들어집니다.
 *  4. 배포 > 새 배포 > 유형: 웹 앱
 *       - 실행 사용자: 나
 *       - 액세스 권한: 모든 사용자
 *  5. 나온 /exec 주소를 data.js 의 api.url 에 넣고 enabled 를 true 로.
 *
 * [시트 구성]
 *  runs    : 러닝 인증   (승인된 행만 집계)
 *  stamps  : 스탬프 인증 (지오펜스 통과 기록)
 *  config  : 기준일 등 운영 값
 *
 * ⚠️ 액세스 권한을 '모든 사용자'로 두면 주소를 아는 누구나 기록을 보낼 수
 *    있습니다. 대회·캠페인 기간에만 열거나, 아래 SECRET 을 채워
 *    쓰기 요청에 토큰을 요구하세요.
 */

var SECRET = ''; // 비워 두면 누구나 스탬프를 보낼 수 있습니다

/* ---------- 최초 1회 실행 ---------- */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, 'runs', ['일시', '닉네임', '구간', '거리km', '승인']);
  ensureSheet(ss, 'stamps', ['일시', '인증지점', '닉네임', '오차m']);
  var cfg = ensureSheet(ss, 'config', ['키', '값']);
  if (cfg.getLastRow() < 2) {
    cfg.appendRow(['updatedAt', new Date().toISOString().slice(0, 10)]);
    cfg.appendRow(['isLive', 'true']);
  }
}

function ensureSheet(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ---------- 읽기: 집계된 현황 ---------- */
function doGet() {
  return json(buildPayload());
}

function buildPayload() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = readConfig(ss);

  // runs: 승인된 행만 센다
  var runs = rows(ss, 'runs');
  var bySeg = {};
  var people = {};
  var weekly = {};
  for (var i = 0; i < runs.length; i++) {
    var r = runs[i];
    if (String(r[4]).toLowerCase() !== 'true' && r[4] !== true && r[4] !== 'O') continue;
    var seg = String(r[2] || '').trim();
    var km = Number(r[3]) || 0;
    var nick = String(r[1] || '').trim();
    if (!seg || km <= 0) continue;

    if (!bySeg[seg]) bySeg[seg] = { km: 0, people: {} };
    bySeg[seg].km += km;
    if (nick) bySeg[seg].people[nick] = 1;
    if (nick) people[nick] = 1;

    var wk = weekLabel(r[0]);
    weekly[wk] = (weekly[wk] || 0) + km;
  }

  var segments = [];
  for (var id in bySeg) {
    segments.push({
      id: id,
      km: round1(bySeg[id].km),
      runners: Object.keys(bySeg[id].people).length,
    });
  }

  // 최근 인증 8건 (닉네임만 노출)
  var recent = [];
  for (var j = runs.length - 1; j >= 0 && recent.length < 8; j--) {
    var q = runs[j];
    if (String(q[4]).toLowerCase() !== 'true' && q[4] !== true && q[4] !== 'O') continue;
    recent.push({ nick: String(q[1] || ''), segment: String(q[2] || ''), km: Number(q[3]) || 0 });
  }

  // 스탬프는 지점별 횟수만 (누가 찍었는지는 내보내지 않는다)
  var stampRows = rows(ss, 'stamps');
  var stampCounts = {};
  for (var k = 0; k < stampRows.length; k++) {
    var cp = String(stampRows[k][1] || '').trim();
    if (cp) stampCounts[cp] = (stampCounts[cp] || 0) + 1;
  }

  return {
    ok: true,
    updatedAt: cfg.updatedAt || new Date().toISOString().slice(0, 10),
    isLive: String(cfg.isLive) !== 'false',
    totalRunners: Object.keys(people).length,
    segments: segments,
    weekly: toWeeklyArray(weekly),
    recent: recent,
    stampCounts: stampCounts,
  };
}

/* ---------- 쓰기: 스탬프 인증 ---------- */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'bad json' });
  }
  if (SECRET && body.secret !== SECRET) return json({ ok: false, error: 'unauthorized' });
  if (body.action !== 'stamp') return json({ ok: false, error: 'unknown action' });

  var cp = String(body.checkpoint || '').trim();
  if (!cp) return json({ ok: false, error: 'checkpoint required' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('stamps');
  if (!sh) return json({ ok: false, error: 'run setup() first' });

  // 닉네임은 선택. 좌표는 저장하지 않는다 (아동 위치정보를 남기지 않기 위해)
  sh.appendRow([
    new Date(),
    cp,
    String(body.nick || '').slice(0, 20),
    Math.round(Number(body.accuracy) || 0),
  ]);
  return json({ ok: true, checkpoint: cp });
}

/* ---------- 유틸 ---------- */
function rows(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

function readConfig(ss) {
  var out = {};
  var r = rows(ss, 'config');
  for (var i = 0; i < r.length; i++) out[String(r[i][0])] = r[i][1];
  return out;
}

function weekLabel(d) {
  var date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '기타';
  var onejan = new Date(date.getFullYear(), 0, 1);
  var week = Math.ceil(((date - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return date.getFullYear() + '-' + week;
}

function toWeeklyArray(map) {
  var keys = Object.keys(map).sort();
  var out = [];
  for (var i = 0; i < keys.length; i++) {
    out.push({ label: i + 1 + '주', km: round1(map[keys[i]]) });
  }
  if (out.length) out[out.length - 1].partial = true;
  return out;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
