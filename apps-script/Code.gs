// Everafter OS – 결혼식 사회 대본 / 고객 여정 / Everafter 편지
//
// 자동 생성 시트
//   설정   : 예식별 질문지 설정
//   응답   : 질문지·대본 검토 응답
//   대본   : 고객에게 발송한 대본
//   백업   : 사회자 대본 빌더 작업 데이터
//   여정   : 고객용 Journey 공개 데이터
//   답장   : 예식 후 Everafter 편지 답장
//   문장DB : 식전 · 식후 SNS 문장 마스터 목록 (사회자가 직접 관리, 예식별로 일부만 배정)

function sheet_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

function answers_() {
  return sheet_('응답', ['받은시각', '예식ID', '작성자', '응답데이터']);
}
function configs_() {
  return sheet_('설정', ['수정시각', '예식ID', '설정데이터']);
}
function scripts_() {
  return sheet_('대본', ['보낸시각', '예식ID', '회차', '대본데이터']);
}
function backups_() {
  return sheet_('백업', ['저장시각', '예식ID', '제목', '작업데이터']);
}
function journeys_() {
  return sheet_('여정', ['수정시각', '예식ID', '영애코드', '신부', '신랑', '공개데이터']);
}
function replies_() {
  return sheet_('답장', ['받은시각', '예식ID', '영애코드', '신부', '신랑', '답장데이터']);
}
function linkKeys_() {
  return sheet_('링크키', ['발급시각', '예식ID', '링크키']);
}

/* ===== 링크키 =================================================
   예전에는 영애 코드(2608_01 처럼 순번)만 알면 두 분의 이름·예식
   일시·편지 전문까지 그대로 열렸습니다. 코드가 순번이라 차례로
   넣어보면 남의 예식도 열리는 상태였습니다.

   이제 예식마다 추측할 수 없는 링크키를 하나씩 발급하고, 링크에
   함께 실어 보냅니다. 링크키가 맞지 않으면 아무것도 돌려주지
   않습니다. 링크를 잃어버리신 분은 예전처럼 영애 코드와 이름으로
   찾으실 수 있고, 그때 링크키를 다시 받아갑니다.
   ============================================================ */
function makeLinkKey_() {
  // 사람이 옮겨 적다 헷갈리는 글자(l, 1, o, 0)는 뺐습니다.
  var chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  var out = '';
  for (var i = 0; i < 14; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function tokenFor_(id) {
  if (!id) return '';
  var rows = linkKeys_().getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(id)) return String(rows[i][2]);
  }
  return '';
}

/** 없으면 새로 발급합니다. 사회자 도구가 링크를 만들 때 부릅니다. */
function ensureToken_(id) {
  var t = tokenFor_(id);
  if (t) return t;
  t = makeLinkKey_();
  linkKeys_().appendRow([new Date(), String(id), t]);
  return t;
}

/** 링크키가 맞을 때만 true. 발급 전 예식은 통과시키지 않습니다. */
function linkOk_(id, t) {
  var real = tokenFor_(id);
  return !!real && String(t || '') === real;
}

function badLink_() {
  return json_({ ok: false, error: 'link key required' });
}

function sentences_() {
  return sheet_('문장DB', ['구분', '번호', 'SNS 포스팅 문장']);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseJson_(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

function normalizeYoungae_(value) {
  var digits = String(value || '').replace(/영애/gi, '').replace(/\D/g, '');
  if (digits.length !== 6) return '';
  return digits.slice(0, 4) + '_' + digits.slice(4, 6);
}

// ---------- 운영자 인증 ----------
// index.html(대본 빌더)만 아는 토큰입니다. 아래 스크립트 속성에
// ADMIN_TOKEN 을 설정해야 관리자 전용 요청이 열립니다.
// (설정 방법: 왼쪽 톱니바퀴 "프로젝트 설정" → "스크립트 속성" → 속성 추가)
function getAdminToken_() {
  return String(PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN') || '');
}
function isAdmin_(token) {
  var real = getAdminToken_();
  return !!real && String(token || '') === real;
}
function unauthorized_() {
  return json_({ ok: false, error: 'unauthorized' });
}

function upsertById_(sh, id, line) {
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(id)) {
      sh.getRange(i + 1, 1, 1, line.length).setValues([line]);
      return { updated: true, row: i + 1 };
    }
  }
  sh.appendRow(line);
  return { created: true, row: sh.getLastRow() };
}

// 주어진 시트에서 예식ID(1번 열)가 일치하는 행을 전부 지웁니다.
// 뒤에서부터 지워야 앞쪽 행 번호가 밀리지 않습니다.
function deleteRowsById_(sh, id) {
  var rows = sh.getDataRange().getValues();
  var count = 0;
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][1]) === String(id)) {
      sh.deleteRow(i + 1);
      count++;
    }
  }
  return count;
}

function getJourneyById_(id) {
  var rows = journeys_().getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(id)) {
      var data = parseJson_(rows[i][5], null);
      if (!data) return null;
      data.id = String(id);
      data.code = normalizeYoungae_(data.code || rows[i][2]);
      return { row: i + 1, data: data };
    }
  }
  return null;
}

function saveJourney_(id, data) {
  data = data || {};
  data.id = String(id);
  data.code = normalizeYoungae_(data.code || '');

  // 고객 화면에는 필요한 항목만 저장합니다.
  var publicData = {
    id: String(id),
    code: data.code,
    bride: String(data.bride || ''),
    groom: String(data.groom || ''),
    date: String(data.date || ''),
    time: String(data.time || ''),
    steps: data.steps || {},
    archiveSentence: String(data.archiveSentence || ''),
    archiveScene: String(data.archiveScene || ''),
    archiveClosing: String(data.archiveClosing || ''),
    reviewLink: String(data.reviewLink || ''),
    archiveSentAt: String(data.archiveSentAt || ''),
    sentencePicks: Array.isArray(data.sentencePicks)
      ? data.sentencePicks.slice(0, 30).map(function (it) {
          return { category: String((it || {}).category || ''), text: String((it || {}).text || '') };
        })
      : []
  };

  var line = [
    new Date(),
    String(id),
    publicData.code,
    publicData.bride,
    publicData.groom,
    JSON.stringify(publicData)
  ];
  return upsertById_(journeys_(), id, line);
}

function updateJourneyStep_(id, stepKey) {
  var found = getJourneyById_(id);
  if (!found) return false;
  var d = found.data;
  d.steps = d.steps || {};
  if (!d.steps[stepKey]) d.steps[stepKey] = new Date().toISOString();
  saveJourney_(id, d);
  return true;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // 사회자가 질문지 설정을 올릴 때 (관리자 전용)
    if (data.type === 'config') {
      if (!isAdmin_(data.token)) return unauthorized_();
      var cfgLine = [new Date(), String(data.id), JSON.stringify(data.cfg)];
      var cfgResult = upsertById_(configs_(), data.id, cfgLine);
      return json_({ ok: true, updated: !!cfgResult.updated, created: !!cfgResult.created });
    }

    // 사회자 대본 빌더 자동 백업 (관리자 전용)
    if (data.type === 'backup') {
      if (!isAdmin_(data.token)) return unauthorized_();
      var backupLine = [
        new Date(),
        String(data.id),
        String(data.title || ''),
        JSON.stringify(data.data)
      ];
      var backupResult = upsertById_(backups_(), data.id, backupLine);
      return json_({ ok: true, updated: !!backupResult.updated, created: !!backupResult.created });
    }

    // 대본 발송 데이터 (관리자 전용)
    if (data.type === 'script') {
      if (!isAdmin_(data.token)) return unauthorized_();
      var scriptLine = [
        new Date(),
        String(data.id),
        String((data.script || {}).round || ''),
        JSON.stringify(data.script || {})
      ];
      var scriptResult = upsertById_(scripts_(), data.id, scriptLine);
      return json_({ ok: true, updated: !!scriptResult.updated, created: !!scriptResult.created });
    }

    // 고객용 Journey 공개 데이터 저장 (관리자 전용)
    if (data.type === 'journey') {
      if (!isAdmin_(data.token)) return unauthorized_();
      if (!data.id || !data.data) throw new Error('journey data is required');
      var journeyResult = saveJourney_(String(data.id), data.data);
      return json_({
        ok: true,
        updated: !!journeyResult.updated,
        created: !!journeyResult.created,
        code: normalizeYoungae_(data.data.code)
      });
    }

    // 고객이 Everafter 편지에 답장할 때 (고객 화면 · 인증 없음)
    if (data.type === 'afterReview') {
      if (!data.id || !data.review) throw new Error('review data is required');
      if (!linkOk_(data.id, data.t)) return badLink_();
      var foundJourney = getJourneyById_(String(data.id));
      if (!foundJourney) throw new Error('journey not found');

      var j = foundJourney.data;
      var review = data.review || {};
      var safeReview = {
        memoryTags: Array.isArray(review.memoryTags) ? review.memoryTags.slice(0, 10) : [],
        bestMoment: String(review.bestMoment || '').slice(0, 3000),
        sentence: String(review.sentence || '').slice(0, 3000),
        publishConsent: ['private', 'anonymous', 'named'].indexOf(review.publishConsent) > -1
          ? review.publishConsent : 'private',
        submittedAt: String(review.submittedAt || new Date().toISOString())
      };

      replies_().appendRow([
        new Date(),
        String(data.id),
        String(j.code || ''),
        String(j.bride || ''),
        String(j.groom || ''),
        JSON.stringify(safeReview)
      ]);

      updateJourneyStep_(String(data.id), 's9');
      return json_({ ok: true });
    }

    // Everafter 편지 이메일 발송 (관리자 전용)
    if (data.type === 'sendArchive') {
      if (!isAdmin_(data.token)) return unauthorized_();
      var id = String(data.id || '');
      var email = String(data.email || '').trim();
      var journeyUrl = String(data.journeyUrl || '').trim();
      if (!id) throw new Error('id is required');
      if (!email || email.indexOf('@') < 1) throw new Error('email is invalid');

      var journeyFound = getJourneyById_(id);
      if (!journeyFound) throw new Error('journey not found');
      var jd = journeyFound.data;

      var names = [jd.bride, jd.groom].filter(String).join(' · ') || '두 분';
      var subject = names + ' 두 분께, Everafter 편지를 보냅니다.';
      var representative = jd.archiveSentence || '두 분의 오래 기억될 하루를 함께할 수 있어 기뻤습니다.';

      var plainBody =
        names + ' 두 분께\n\n' +
        '두 분의 오래 기억될 하루를 한 편의 편지로 남겼습니다.\n\n' +
        '“' + representative + '”\n\n' +
        '영애, 오래 사랑한다는 마음을 담아\n' +
        '두 분의 앞으로를 조용히 응원하겠습니다.\n\n' +
        (journeyUrl ? 'Everafter 편지 열어보기\n' + journeyUrl + '\n\n' : '') +
        'Everafter · 永愛\n' +
        '오래 기억될 하루를 함께 만듭니다.';

      var buttonHtml = journeyUrl
        ? '<p style="margin:30px 0"><a href="' + escapeHtml_(journeyUrl) + '" style="display:inline-block;background:#8A2540;color:#fff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:700">Everafter 편지 열어보기</a></p>'
        : '';

      var htmlBody =
        '<div style="max-width:600px;margin:0 auto;padding:36px 24px;background:#F4F1EB;color:#25231F;font-family:Arial,Apple SD Gothic Neo,Malgun Gothic,sans-serif;line-height:1.9">' +
          '<div style="font-size:15px;letter-spacing:.14em;text-align:center;margin-bottom:36px">EVERAFTER · 永愛</div>' +
          '<div style="background:#fff;border:1px solid #E3DDD3;border-radius:18px;padding:34px 28px">' +
            '<p style="margin:0 0 24px;font-weight:700">' + escapeHtml_(names) + ' 두 분께</p>' +
            '<p>두 분의 오래 기억될 하루를 한 편의 편지로 남겼습니다.</p>' +
            '<p style="font-family:Georgia,serif;font-size:21px;color:#8A2540;text-align:center;margin:30px 0">“' + escapeHtml_(representative) + '”</p>' +
            '<p>영애, 오래 사랑한다는 마음을 담아<br>두 분의 앞으로를 조용히 응원하겠습니다.</p>' +
            buttonHtml +
            '<p style="margin-top:32px">Everafter · 永愛</p>' +
          '</div>' +
          '<p style="text-align:center;color:#777;font-size:12px;margin-top:24px">오래 기억될 하루를 함께 만듭니다.</p>' +
        '</div>';

      MailApp.sendEmail({
        to: email,
        subject: subject,
        body: plainBody,
        htmlBody: htmlBody,
        name: 'Everafter'
      });

      jd.steps = jd.steps || {};
      if (!jd.steps.s10) jd.steps.s10 = new Date().toISOString();
      jd.archiveSentAt = new Date().toISOString();
      saveJourney_(id, jd);

      return json_({ ok: true, sent: true, sentAt: jd.archiveSentAt });
    }

    // 대본 단계 알림 이메일 (관리자 전용)
    if (data.type === 'notifyScript') {
      if (!isAdmin_(data.token)) return unauthorized_();
      var nsEmail = String(data.email || '').trim();
      var nsRound = String(data.round || '대본');
      var nsUrl = String(data.reviewUrl || '').trim();
      var nsBride = String(data.bride || '');
      var nsGroom = String(data.groom || '');
      if (!nsEmail || nsEmail.indexOf('@') < 1) throw new Error('email is invalid');

      var nsNames = [nsBride, nsGroom].filter(String).join(' · ') || '두 분';
      var nsSubject = nsNames + ' 두 분께, ' + nsRound + '이 준비되었습니다.';

      var nsPlainBody =
        nsNames + ' 두 분께\n\n' +
        nsRound + '이 준비되었습니다.\n\n' +
        '아래 링크에서 편하게 둘러보시고,\n' +
        '더하고 싶은 이야기나 덜어내고 싶은 부분이 있다면 알려주세요.\n\n' +
        (nsUrl ? nsUrl + '\n\n' : '') +
        'Everafter · 永愛';

      var nsButtonHtml = nsUrl
        ? '<p style="margin:30px 0"><a href="' + escapeHtml_(nsUrl) + '" style="display:inline-block;background:#8A2540;color:#fff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:700">대본 확인하기</a></p>'
        : '';

      var nsHtmlBody =
        '<div style="max-width:600px;margin:0 auto;padding:36px 24px;background:#F4F1EB;color:#25231F;font-family:Arial,Apple SD Gothic Neo,Malgun Gothic,sans-serif;line-height:1.9">' +
          '<div style="font-size:15px;letter-spacing:.14em;text-align:center;margin-bottom:36px">EVERAFTER · 永愛</div>' +
          '<div style="background:#fff;border:1px solid #E3DDD3;border-radius:18px;padding:34px 28px">' +
            '<p style="margin:0 0 24px;font-weight:700">' + escapeHtml_(nsNames) + ' 두 분께</p>' +
            '<p>' + escapeHtml_(nsRound) + '이 준비되었습니다.</p>' +
            '<p>아래 링크에서 편하게 둘러보시고,<br>더하고 싶은 이야기나 덜어내고 싶은 부분이 있다면 알려주세요.</p>' +
            nsButtonHtml +
            '<p style="margin-top:32px">Everafter · 永愛</p>' +
          '</div>' +
          '<p style="text-align:center;color:#777;font-size:12px;margin-top:24px">오래 기억될 하루를 함께 만듭니다.</p>' +
        '</div>';

      MailApp.sendEmail({
        to: nsEmail,
        subject: nsSubject,
        body: nsPlainBody,
        htmlBody: nsHtmlBody,
        name: 'Everafter'
      });

      return json_({ ok: true, sent: true });
    }

    // 예식 하나의 시트 기록을 전부 삭제 (관리자 전용 — 테스트/취소된 예식 정리용, 되돌릴 수 없음)
    if (data.type === 'purgeJourney') {
      if (!isAdmin_(data.token)) return unauthorized_();
      var pgId = String(data.id || '');
      if (!pgId) throw new Error('id is required');
      var removed = 0;
      removed += deleteRowsById_(configs_(), pgId);
      removed += deleteRowsById_(scripts_(), pgId);
      removed += deleteRowsById_(backups_(), pgId);
      removed += deleteRowsById_(journeys_(), pgId);
      removed += deleteRowsById_(replies_(), pgId);
      removed += deleteRowsById_(answers_(), pgId);
      removed += deleteRowsById_(linkKeys_(), pgId);
      return json_({ ok: true, removed: removed });
    }

    // 예식의 링크키 발급/조회 (관리자 전용 — 사회자 도구가 링크를 만들 때 씁니다)
    if (data.type === 'linkKey') {
      if (!isAdmin_(data.token)) return unauthorized_();
      var lkId = String(data.id || '');
      if (!lkId) throw new Error('id is required');
      return json_({ ok: true, t: ensureToken_(lkId) });
    }

    // 지금 바로 구글드라이브에 백업 (관리자 전용 — 매주 자동 백업과 같은 동작을 즉시 실행)
    if (data.type === 'runBackupNow') {
      if (!isAdmin_(data.token)) return unauthorized_();
      weeklyBackup();
      return json_({ ok: true });
    }

    // 질문지 및 대본 검토 응답 (고객 화면 · 링크키 확인)
    if (!linkOk_(data.id, data.t)) return badLink_();
    answers_().appendRow([
      new Date(),
      String(data.id || ''),
      String(data.name || ''),
      JSON.stringify(data)
    ]);
    return json_({ ok: true });

  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    var p = e.parameter || {};

    // 고객 질문지 설정 (고객 화면 · 인증 없음)
    if (p.cfg) {
      if (!linkOk_(p.cfg, p.t)) return badLink_();
      var cfgRows = configs_().getDataRange().getValues();
      for (var i = 1; i < cfgRows.length; i++) {
        if (String(cfgRows[i][1]) === String(p.cfg)) {
          return json_({ ok: true, cfg: parseJson_(cfgRows[i][2], {}) });
        }
      }
      return json_({ ok: false, error: 'config not found' });
    }

    // 대본 빌더 백업 목록 (관리자 전용 — 모든 예식의 백업 원문이 담겨 있습니다)
    if (p.backups) {
      if (!isAdmin_(p.token)) return unauthorized_();
      var backupRows = backups_().getDataRange().getValues();
      var list = [];
      for (var q = 1; q < backupRows.length; q++) {
        list.push({
          id: String(backupRows[q][1]),
          title: String(backupRows[q][2]),
          ts: backupRows[q][0],
          data: parseJson_(backupRows[q][3], {})
        });
      }
      list.reverse();
      return json_({ ok: true, backups: list });
    }

    // 공개 동의한 Everafter 편지 답장 목록 (관리자 전용 — publishConsent가 private이 아닌 것만 반환합니다)
    if (p.replies) {
      if (!isAdmin_(p.token)) return unauthorized_();
      var replyRows = replies_().getDataRange().getValues();
      var replyList = [];
      for (var r = 1; r < replyRows.length; r++) {
        var reviewData = parseJson_(replyRows[r][5], null);
        if (!reviewData || reviewData.publishConsent === 'private') continue;
        replyList.push({
          id: String(replyRows[r][1]),
          code: String(replyRows[r][2]),
          bride: String(replyRows[r][3]),
          groom: String(replyRows[r][4]),
          ts: replyRows[r][0],
          review: reviewData
        });
      }
      replyList.reverse();
      return json_({ ok: true, replies: replyList });
    }

    // 식전 · 식후 문장 마스터 DB 전체 목록 (관리자 전용 — 예식별로 배정할 문장을 고를 때 사용)
    if (p.sentenceDb) {
      if (!isAdmin_(p.token)) return unauthorized_();
      var sdRows = sentences_().getDataRange().getValues();
      var sdList = [];
      for (var sd = 1; sd < sdRows.length; sd++) {
        var sdCategory = String(sdRows[sd][0] || '').trim();
        var sdText = String(sdRows[sd][2] || '').trim();
        if (!sdCategory || !sdText) continue;
        sdList.push({ category: sdCategory, num: sdRows[sd][1], text: sdText });
      }
      return json_({ ok: true, items: sdList });
    }

    // 고객에게 보낸 대본 (고객 화면 · 인증 없음)
    if (p.script) {
      if (!linkOk_(p.script, p.t)) return badLink_();
      var scriptRows = scripts_().getDataRange().getValues();
      for (var m = 1; m < scriptRows.length; m++) {
        if (String(scriptRows[m][1]) === String(p.script)) {
          return json_({ ok: true, script: parseJson_(scriptRows[m][3], {}) });
        }
      }
      return json_({ ok: false, error: 'script not found' });
    }

    // 고객 Journey 페이지 (고객 화면 · 인증 없음)
    if (p.journey) {
      if (!linkOk_(p.journey, p.t)) return badLink_();
      var journey = getJourneyById_(String(p.journey));
      if (!journey) return json_({ ok: false, error: 'journey not found' });
      return json_({ ok: true, journey: journey.data });
    }

    // 영애 코드로 고객 Story 페이지 조회 (고객 화면 · 인증 없음)
    if (p.story) {
      var storyCode = normalizeYoungae_(p.story);
      if (!storyCode) return json_({ ok: false, error: 'story code is required' });

      var storyRows = journeys_().getDataRange().getValues();
      for (var sk = 1; sk < storyRows.length; sk++) {
        if (normalizeYoungae_(storyRows[sk][2]) !== storyCode) continue;
        // 코드는 순번이라 추측할 수 있으므로, 링크키가 맞아야만 열어줍니다.
        if (!linkOk_(storyRows[sk][1], p.t)) return badLink_();
        return json_({ ok: true, journey: parseJson_(storyRows[sk][5], {}) });
      }
      return json_({ ok: false, error: 'story not found' });
    }

    // 영애 코드 + 이름으로 Journey 조회 (고객 화면 · 인증 없음)
    if (p.lookup) {
      var code = normalizeYoungae_(p.lookup);
      var name = String(p.name || '').replace(/\s/g, '');
      if (!code || !name) return json_({ ok: false, error: 'code and name are required' });

      var journeyRows = journeys_().getDataRange().getValues();
      for (var k = 1; k < journeyRows.length; k++) {
        if (normalizeYoungae_(journeyRows[k][2]) !== code) continue;
        var bride = String(journeyRows[k][3] || '').replace(/\s/g, '');
        var groom = String(journeyRows[k][4] || '').replace(/\s/g, '');
        // 이름은 두 글자 이상, 정확히 일치할 때만 열어줍니다.
        if (name.length >= 2 && (name === bride || name === groom)) {
          // 이름이 확인됐으므로 링크키를 함께 돌려줍니다. 링크를 잃어버려도
          // 코드와 이름만 알면 다시 들어오실 수 있습니다.
          var foundId = String(journeyRows[k][1]);
          return json_({ ok: true, id: foundId, t: ensureToken_(foundId) });
        }
      }
      return json_({ ok: false, error: 'journey not found' });
    }

    // 사회자가 응답을 불러갈 때 (관리자 전용 — all=1 은 모든 고객의 응답이 다 나옵니다)
    if (p.id || p.all) {
      if (!isAdmin_(p.token)) return unauthorized_();
      var answerId = p.all ? '' : (p.id || '');
      var answerRows = answers_().getDataRange().getValues();
      var items = [];
      for (var j = 1; j < answerRows.length; j++) {
        if (answerId && String(answerRows[j][1]) !== answerId) continue;
        var parsed = parseJson_(answerRows[j][3], null);
        if (parsed) items.push(parsed);
      }
      items.reverse();
      return json_({ ok: true, items: items });
    }

    return json_({ ok: false, error: 'unknown request' });

  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- 자동 백업 ----------
// 매주 월요일 아침, 이 스프레드시트 전체를 구글드라이브의
// "Everafter 백업" 폴더에 복사해 둡니다. 8주(56일)보다 오래된
// 백업은 자동으로 정리합니다.
//
// 처음 한 번만: 이 파일을 저장한 뒤, 위쪽 함수 선택 드롭다운에서
// installWeeklyBackupTrigger 를 고르고 ▶ 실행을 눌러주세요.
// (권한 요청 창이 뜨면 허용해 주세요 — 드라이브에 백업 파일을
// 만들기 위한 권한입니다.) 그 이후로는 완전히 자동으로 돌아갑니다.
function weeklyBackup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var folderName = 'Everafter 백업';
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  var tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  var stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var file = DriveApp.getFileById(ss.getId()).makeCopy('Everafter 백업 ' + stamp, folder);

  var cutoff = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getId() !== file.getId() && f.getDateCreated() < cutoff) {
      f.setTrashed(true);
    }
  }
}

function installWeeklyBackupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'weeklyBackup') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('weeklyBackup')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(6)
    .create();
}
