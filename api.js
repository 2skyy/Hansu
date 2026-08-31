/* =====================================================================
   한수런런 · 백엔드 연결
   ---------------------------------------------------------------------
   data.js 의 api.enabled 가 true 이고 url 이 있으면 서버에서 실제 수치를
   받아 더미 값을 덮어쓰고 화면을 다시 그립니다.
   연결이 안 되면 아무 일도 일어나지 않고 더미 데이터로 계속 동작합니다.

   서버 코드: backend/apps-script.gs
   ===================================================================== */
window.HansuApi = (function () {
  const D = window.HANSU_DATA || {};
  const cfg = D.api || {};
  const url = String(cfg.url || '').trim();
  const enabled = Boolean(cfg.enabled && url);

  /* 서버가 준 값만 골라 덮어쓴다.
     코스·인증지점·교육 문구 같은 고정 콘텐츠는 건드리지 않는다. */
  function merge(live) {
    if (!live || live.ok === false) return false;

    if (typeof live.totalRunners === 'number') D.totalRunners = live.totalRunners;
    if (live.updatedAt) D.updatedAt = live.updatedAt;
    if (typeof live.isLive === 'boolean') D.isLive = live.isLive;

    if (Array.isArray(live.segments)) {
      const byId = Object.fromEntries(D.segments.map((s) => [s.id, s]));
      live.segments.forEach((row) => {
        const seg = byId[row.id];
        if (!seg) return; // 모르는 구간 id 는 무시 (오타로 화면이 깨지지 않게)
        if (typeof row.km === 'number') seg.km = row.km;
        if (typeof row.runners === 'number') seg.runners = row.runners;
      });
    }
    if (Array.isArray(live.weekly) && live.weekly.length) D.weekly = live.weekly;
    if (Array.isArray(live.recent)) D.recent = live.recent;
    if (live.stampCounts) D.stampCounts = live.stampCounts;
    return true;
  }

  async function load() {
    if (!enabled) return false;
    try {
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const live = await res.json();
      if (!merge(live)) throw new Error(live && live.error ? live.error : 'bad payload');
      if (window.HansuRecord) window.HansuRecord.refresh();
      return true;
    } catch (e) {
      // 서버가 죽어도 사이트는 더미 데이터로 계속 보여야 한다
      console.warn('[한수런런] 실데이터를 불러오지 못해 샘플 값으로 표시합니다.', e);
      return false;
    }
  }

  /* 스탬프 인증을 서버에도 남긴다.
     Apps Script 는 JSON content-type 에 프리플라이트가 걸리므로
     text/plain 으로 보내고 서버에서 파싱한다. */
  async function sendStamp(payload) {
    if (!enabled || cfg.postStamps === false) return false;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action: 'stamp' }, payload)),
      });
      const out = await res.json();
      return Boolean(out && out.ok);
    } catch (e) {
      console.warn('[한수런런] 스탬프를 서버에 보내지 못했습니다. 기기에는 저장됩니다.', e);
      return false;
    }
  }

  return { enabled, url, load, sendStamp };
})();

// 스크립트 순서상 이 파일이 마지막이므로 여기서 바로 불러온다
window.HansuApi.load();
