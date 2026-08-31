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
 *  codes   : 참여 코드   (로그인 대신 쓰는 코드. 비우면 아무 코드나 허용)
 *  config  : 기준일 등 운영 값
 *
 * [참여 코드]
 *  로그인을 두지 않기 위한 장치입니다. 이름·이메일·전화번호를 받지 않으므로
 *  아동 개인정보 수집에 해당하지 않습니다.
 *  codes 시트에 6자리 숫자를 미리 넣어 두고 방문교육·행사에서 나눠 주세요.
 *  이름표 칸에 '3학년 2반' 처럼 적으면 화면에 함께 표시됩니다.
 *  사용중지 칸에 true 를 넣으면 그 코드는 더 이상 받지 않습니다.
 *
 * ⚠️ 액세스 권한을 '모든 사용자'로 두면 주소를 아는 누구나 기록을 보낼 수
 *    있습니다. 대회·캠페인 기간에만 열거나, 아래 SECRET 을 채워
 *    쓰기 요청에 토큰을 요구하세요.
 */

var SECRET = ''; // 비워 두면 누구나 스탬프를 보낼 수 있습니다

/**
 * runs 시트의 '구간' 칸에 넣을 수 있는 값과, 그것이 속한 성곽입니다.
 * 지도는 코스 단위로 채워지므로 되도록 코스 id 로 받으세요.
 * 북한산성은 공식 순성길 구간이 없어 성곽 id 를 그대로 씁니다.
 */
var COURSE_WALL = {
  'baekak': 'hanyang',        // 백악구간
  'naksan': 'hanyang',        // 낙산구간
  'namsan': 'hanyang',        // 남산(목멱산)구간
  'inwang': 'hanyang',        // 인왕구간
  'tangchun-west': 'tangchun',// 탕춘대성 서성구간
  'tangchun-east': 'tangchun',// 탕춘대성 동측구간
  'bukhan': 'bukhan',         // 북한산성 (코스 구분 없음)
};

/* ---------- 최초 1회 실행 ---------- */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, 'runs', ['일시', '참여코드/닉네임', '구간', '거리km', '승인']);
  ensureSheet(ss, 'stamps', ['일시', '인증지점', '참여코드', '오차m']);
  // codes 를 비워 두면 아무 코드나 받습니다. 코드를 넣으면 등록된 것만 받습니다.
  ensureSheet(ss, 'codes', ['코드', '이름표(선택)', '발급일', '사용중지']);
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
  var byId = {};   // 구간 id 별 집계 (코스 또는 성곽)
  var people = {}; // 전체 순 인원
  var weekly = {};
  for (var i = 0; i < runs.length; i++) {
    var r = runs[i];
    if (String(r[4]).toLowerCase() !== 'true' && r[4] !== true && r[4] !== 'O') continue;
    var id = String(r[2] || '').trim();
    var km = Number(r[3]) || 0;
    var who = String(r[1] || '').trim();
    if (!id || km <= 0) continue;
    if (!COURSE_WALL[id]) continue; // 모르는 구간 id 는 건너뛴다 (오타로 집계가 틀어지지 않게)

    if (!byId[id]) byId[id] = { km: 0, who: {} };
    byId[id].km += km;
    if (who) byId[id].who[who] = 1;
    if (who) people[who] = 1;

    var wk = weekLabel(r[0]);
    weekly[wk] = (weekly[wk] || 0) + km;
  }

  // 코스별 / 성곽별을 따로 만든다.
  // 순 인원은 합산하면 중복이 생기므로 각 단위에서 따로 센다.
  var courses = [];
  var wallAgg = {};
  for (var id2 in byId) {
    var wall = COURSE_WALL[id2];
    if (id2 !== wall) {
      courses.push({
        id: id2,
        km: round1(byId[id2].km),
        runners: Object.keys(byId[id2].who).length,
      });
    }
    if (!wallAgg[wall]) wallAgg[wall] = { km: 0, who: {} };
    wallAgg[wall].km += byId[id2].km;
    for (var w2 in byId[id2].who) wallAgg[wall].who[w2] = 1;
  }
  var segments = [];
  for (var wid in wallAgg) {
    segments.push({
      id: wid,
      km: round1(wallAgg[wid].km),
      runners: Object.keys(wallAgg[wid].who).length,
    });
  }

  // 최근 인증 8건 (참여코드/닉네임만 노출)
  var recent = [];
  for (var j = runs.length - 1; j >= 0 && recent.length < 8; j--) {
    var q = runs[j];
    if (String(q[4]).toLowerCase() !== 'true' && q[4] !== true && q[4] !== 'O') continue;
    recent.push({ nick: String(q[1] || ''), segment: String(q[2] || ''), km: Number(q[3]) || 0 });
  }

  // 스탬프는 지점별 횟수만 (누가 찍었는지는 내보내지 않는다)
  var stampRows = rows(ss, 'stamps');
  var stampCounts = {};
  var stampCodes = {};
  for (var k = 0; k < stampRows.length; k++) {
    var cp = String(stampRows[k][1] || '').trim();
    if (cp) stampCounts[cp] = (stampCounts[cp] || 0) + 1;
    var cd = String(stampRows[k][2] || '').trim();
    if (cd) stampCodes[cd] = 1;
  }

  return {
    ok: true,
    updatedAt: cfg.updatedAt || new Date().toISOString().slice(0, 10),
    isLive: String(cfg.isLive) !== 'false',
    totalRunners: Object.keys(people).length,
    courses: courses,
    segments: segments,
    weekly: toWeeklyArray(weekly),
    recent: recent,
    stampCounts: stampCounts,
    stampCodeCount: Object.keys(stampCodes).length,
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
  if (body.action === 'checkCode') return json(lookupCode(String(body.code || '').trim()));
  if (body.action !== 'stamp') return json({ ok: false, error: 'unknown action' });

  var code = String(body.code || '').trim();
  var chk = lookupCode(code);
  if (!chk.ok) return json(chk);

  var cp = String(body.checkpoint || '').trim();
  if (!cp) return json({ ok: false, error: 'checkpoint required' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('stamps');
  if (!sh) return json({ ok: false, error: 'run setup() first' });

  // 닉네임은 선택. 좌표는 저장하지 않는다 (아동 위치정보를 남기지 않기 위해)
  sh.appendRow([new Date(), cp, code, Math.round(Number(body.accuracy) || 0)]);
  return json({ ok: true, checkpoint: cp });
}

/* ---------- 참여 코드 ---------- */
function lookupCode(code) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rows_ = rows(ss, 'codes');
  // 목록이 비어 있으면 준비 단계로 보고 통과시킨다
  if (!rows_.length) return { ok: true, name: '' };
  if (!code) return { ok: false, message: '참여 코드를 입력해 주세요.' };
  for (var i = 0; i < rows_.length; i++) {
    if (String(rows_[i][0]).trim() !== code) continue;
    var off = String(rows_[i][3]).toLowerCase();
    if (off === 'true' || rows_[i][3] === true) {
      return { ok: false, message: '사용이 중지된 코드입니다.' };
    }
    return { ok: true, name: String(rows_[i][1] || '').trim() };
  }
  return { ok: false, message: '등록되지 않은 코드입니다. 받으신 코드를 다시 확인해 주세요.' };
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
