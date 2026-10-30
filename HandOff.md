# HandOff — Everafter Youngae 작업 인수인계

2026-10-30 기준. 새 세션이 이 문서만 읽고 이어갈 수 있게 썼습니다.
두 저장소를 같은 브랜드가 씁니다. 디자인 판단의 최우선 기준은 `~/workspace/studio/BRAND.md`.

| 저장소 | 무엇 | 배포 |
|---|---|---|
| `~/workspace/wedding-mc` | 사회자 대본 빌더 (정적 HTML + Apps Script) | `main` push = GitHub Pages 즉시 반영 |
| `~/workspace/everafter-instagram` | 인스타그램 카드 제작·예약 발행·인사 다니기 (Python CLI + Flask 로컬 UI) | 비공개, 로컬 |
| `~/workspace/studio` | 브랜드 사이트 + 인스타 이미지 호스팅(`assets/ig/`, GitHub Pages) | 커밋 → post-commit 훅이 push |

---

## 1. 지금 어디까지 왔나

### 인스타그램 — 발행 4건 완료, 런칭 전

| No. | 편 | 날짜 | 링크 |
|---|---|---|---|
| 01–03 | 오프닝 트립틱 | 9/11 | — |
| 04 | BETWEEN US 01 | 9/16 20:30 | instagram.com/p/DdWMeewG9ws |
| 05 | BETWEEN US 02 | 10/5 20:30 | instagram.com/p/DeHIqLBG-lk |
| — | (사용자가 직접 올린 것) | 10/19 20:00 | instagram.com/p/DerGrOUFszD |
| 06 | BETWEEN US 03 | 10/26 20:00 | instagram.com/p/De9IRmelQVu |

**다음 발행:** 계획표(`data/plan.json`)상 `BETWEEN US 04` → `그날의 이야기 01~05` → 브랜드 3편 → `WE ARE OPEN`.
고정 슬롯 **매주 수요일 20:30**, 10월만 금요일 추가. 실제로는 월요일 20:00/20:30 에 올린 적이 많으니
사용자에게 날짜를 확인하고 걸 것. 지나간 슬롯은 대문이 자동으로 건너뛰어 다음 슬롯부터 다시 채운다.

**그날의 이야기 01**(`story-01`, 야구를 너무 좋아하는 신랑)은 원고·사진·캡션까지 다 됐고
**04번 카드(영상) 자리만 비어 있다.** 사용자가 영상을 자산 폴더에 넣고 편집기 사진 칸에 `video:파일명.mp4`
를 적으면 된다. 자막("야구보다 ○○○!")은 영상에 태워 넣어야 한다 — 캐러셀은 무음 재생.

### 인사 다니기(팔로워) — 셋팅 완료, 운영 시작 단계
명단 20곳(손으로 12 + 자동 8). 사용자가 한 곳 "팔로우 기록" 만 눌러둔 상태(앱에선 아직 안 함).
**다음 할 일:** 사용자가 평소 댓글 5~10개를 주면 → `data/comment_voice.md`(아직 없음)로 정리 →
자동 찾기로 들어온 곳들 댓글 초안을 그 톤으로 쓰기.

### 대본 빌더 — 최근 추가 둘
- 식순 `신랑·신부 동시 입장` (켜면 신랑·신부 입장이 꺼짐, 질문지도 같은 규칙)
- 식순 순서를 예식마다 끌어서 바꾸기(`w.order`, ▲▼, 기본 순서로). 질문지도 그 순서로 선다.

---

## 2. 꼭 알아야 할 구조

### everafter-instagram
```
src/posting.py   PostingItem = 시트 한 행. type BETWEEN/STORY/BRAND. 키(slug)는 between-02 · story-01 처럼
                 시리즈 이름, 발행 번호(no)는 plan.json 순서가 정한다. 옛 키 no04 는 그대로.
src/asks.py      카드 렌더러. LAYOUTS + ASKS_RHYTHM(BETWEEN) / STORY_RHYTHM. 피드 1080x1350, --story 1080x1920.
                 사진 칸 접두사: sheet:(편지지) · dim:(채도·밝기 내림) · video:(그 장 안 구움, 번호 비움)
src/webui.py     Flask 127.0.0.1:8765. / → /between-us(대문: 계획 보드 + 목록), ?slug= 편집기,
                 /outreach 인사 다니기, /cards 문장 카드, /triptych. use_reloader=True.
src/discover.py  해시태그 → 캡션 @멘션 → Business Discovery → outreach.json 에 추가.
src/outreach.py  인사 명단(data/outreach.json). 종류 우선 스냅→드레스→웨딩홀→플래너, 서울 먼저.
src/scheduler.py data/content_calendar.csv 의 pending 행을 발행. GitHub Actions publish.yml 이 돌린다.
tools/render.js  playwright. 반드시 channel 'chromium-headless-shell' (아니면 Dock 에 창 뜸), --jobs 로 한 번에.
data/plan.json   발행 계획(16편). 시트가 아니라 파일 — 앱스크립트에 행 삭제가 없어서.
data/design_system.md  디자인 기준. 그림자·대비 실측값, 표지 좌표, 리듬 표가 다 여기.
apps-script/content-sheet.gs  시트 백엔드 사본. 헤더 자동 확장이라 열 추가에 재배포 불필요.
```

**원고는 구글 시트가 원본**(`CONTENT_SHEET_URL`). 시트는 `2026-09-16 20:30` 을 날짜형으로, `05` 를 `5` 로
바꿔 돌려주므로 `posting._when/_no` 가 읽을 때 되돌린다. 시트 호출은 가끔 404/타임아웃 — 재시도하면 된다.

**두 종류 토큰:**
- `IG_ACCESS_TOKEN`(Instagram Login, GitHub 시크릿) — 발행용. 60일, `refresh-token.yml` 이 갱신.
- `FB_ACCESS_TOKEN`(.env, Facebook 페이지 연동) — 해시태그 검색·업체 프로필용. 60일(12/25 만료),
  맥 launchd `com.everafter.fb-token-refresh` 가 1일·15일 갱신. 페이지 "Everafter Youngae" 1416545664868405
  ↔ IG 비즈니스 17841476122143785. App ID 1050499857977473.

### wedding-mc
- 모든 페이지가 단일 HTML(inline CSS/JS). `shared.js` 만 공유. Apps Script 는 `apps-script/Code.gs` 사본 —
  고치면 사용자가 붙여넣고 "새 버전 배포" 해야 반영.
- `SEC_DEFS` 가 식순 정의, `secOrder(w)` 가 예식별 순서. 식순 키는 `ask.html`(SECS)·`review.html` 과 손으로 맞춘다.
- 검증은 `python3 -m http.server` + playwright headless-shell 로 실제 DOM 을 확인한다(스크린샷만 믿지 않음).
  빌더는 잠금 화면이 먼저라 테스트에서 `unlock()` 호출 필요. 저장은 디바운스라 바로 localStorage 를 읽지 말 것.

---

## 3. 반복 절차

### 예약 발행 (매번 이 순서)
1. `git pull --rebase origin main` — **먼저.** Actions 봇이 발행 결과를 CSV 에 커밋하므로 로컬은 늘 뒤처져 있다.
   (한 번 옛 CSV 위에 행을 더했다가 9/16 행이 pending 으로 되살아나 중복 발행 직전까지 갔다.)
2. 미리보기 `preview.build(...)` 를 보여주고 **사용자 승인**을 받는다. 올라간 캐러셀은 API 로 못 지운다.
3. `media.host_images` 로 studio Pages 에 그림 공개 → 전부 200 확인
4. `python src/cli.py schedule add --at "YYYY-MM-DD HH:MM" --media-type CAROUSEL --url "a|b|…" --caption-file …`
   캡션은 시트 `caption` 그대로(해시태그는 캡션 안에, 별도 `hashtags` 칸은 비움)
5. CSV 의 지난 행이 전부 `published` 인지 확인 → commit → push
6. 맥 launchd `com.everafter.publish-trigger` 를 **예약 시각 +1분**에 걸어 `gh workflow run publish.yml` —
   Actions 크론(`*/15`)은 실제로 2~5시간씩 밀린다. 맥이 깨어 있어야 정시.
7. `gh workflow run publish.yml -f dry_run=true` — 예정 전이면 "0건" 이 정상
8. **로컬에서 `schedule run` 을 돌리지 말 것** — Actions 와 중복 발행된다.

**뒤처리(발행 다음 날):** CSV result 확인 → 시트 `status=published`, `media`, `result`, `publish_at` 갱신 →
launchd 에이전트 bootout + plist 삭제(Month/Day 지정이라 매년 반복됨).

### 새 편 만들기
대문 계획 칸의 **만들기** → 편집기에서 원고 → **저장하고 다시 굽기** → 사진은 썸네일 피커 → 대비 재기
(`scratchpad/contrast.js` 류 스크립트, 중간값 5 이상이면 안전; 밝은 사진은 `dim:` 또는 교체).
표지 제목·문구는 **사용자 확정본을 한 글자도 바꾸지 않는다.** 바꾸고 싶으면 '제안' 으로 따로.

### 인사 다니기 운영
매일 08:30 자동 찾기 → `/outreach` 에 오늘 10곳 → 사용자가 앱에서 팔로우·댓글 → 화면에서 "했어요" 기록.
**이 화면은 인스타에 아무것도 보내지 않는다.** 일괄 댓글·자동 팔로우는 API 에 없고, 있어도 안 한다(제재·톤).
댓글 초안은 "사회석에서 보면…" 처럼 사회자라서 할 수 있는 말로. 사용자 평소 톤 파일이 생기면 그걸 따른다.

---

## 4. 사용자 선호 (지키기)
- 담백·과하지 않게. 광고 문구·교훈·CTA 금지. 확정 문구는 임의 수정 금지, 제안은 구분해서.
- **창 띄우지 않기** — 굽기·검증 모두 headless-shell. 사용자가 Dock 에 뜨는 창에 여러 번 불편해했다.
- 디자인 결정은 재서 보여준다(대비·좌표·위치 실측). "잘했어" 는 그 뒤에 왔다.
- 비밀값(토큰·시크릿)은 화면에 다시 적지 않는다. 브라우저 안의 토큰은 밖으로 못 꺼낸다 — 사용자가 붙여줘야 한다.
- 시트에 테스트로 쓰지 말 것(`__probe` 열, `no05`·`no06` 빈 행이 아직 남아 있음 — 사용자가 지워야 한다).

## 5. 남은 일 (우선순위)
1. 사용자 평소 댓글 받아 `data/comment_voice.md` → 자동 찾기 8곳 초안 쓰기
2. 다음 발행(BETWEEN US 04 또는 그날의 이야기 01) 날짜 확정 → 위 절차로 예약
3. story-01 영상 자리(`video:`) 채우기 — 사용자 영상 대기
4. 선택: `/outreach` "오늘 10곳 묶음 복사" · "전부 했음" 버튼, Claude API 키 넣으면 초안 자동화
5. 선택: 시트 `no05`·`no06` 행, `__probe` 열 정리 (사용자 손)

## 6. 길을 잃으면
- 메모리: `~/.claude/projects/-Users-jeonjuhyeon-workspace-wedding-mc/memory/` — 발행 절차·토큰 트러블슈팅 상세
- 토큰이 이상하면 `debug_token` 의 `granular_scopes` 부터. `me/accounts` 가 비어도 IG 접근은 열려 있을 수 있다.
  페이지 연동이 로그인 창에 안 뜨면 `facebook.com/settings?tab=business_tools` 에서 앱 Remove 후 재발급.
- 대문이 500 이면 거의 시트 타임아웃. 잠시 뒤 새로고침.
