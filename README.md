# INTO CHURCH 모바일 웹앱 (PWA)

into.or.kr(구글 사이트)의 내용·로고·색을 그대로 옮기고, 회원가입 / 이번 주 질문 / 질문 게시판 / 관리자 기능을 더한 **설치형 모바일 웹앱**입니다.
빌드 과정 없이 HTML·CSS·JS 파일만으로 동작하고, 데이터는 **Supabase**(무료 DB + 로그인 + 사진 저장소)에 저장됩니다.

---

## 1. 바로 미리보기 (데모 모드)

`index.html`을 더블클릭해 크롬으로 열면 됩니다. `config.js`가 비어 있으면 **데모 모드**로 동작해서, 데이터가 그 브라우저에만 저장돼요.

| 계정 | 이메일 | 비밀번호 |
|---|---|---|
| 관리자 | `admin@into.demo` | `into1234` |
| 성도 | `member@into.demo` | `into1234` |

> 관리자 화면은 PC에서 `#/admin` 으로 들어가거나, 로그인 후 오른쪽 위 **관리** 버튼을 누르세요.

---

## 2. 기능 한눈에 보기

### 성도용 (모바일 우선)
- **홈** – 더 깊이·더 가까이·더 낮게, Deeper/Closer/Lower, 예배 장소(STEADFAST), 사진 슬라이드, 함께하는 방법(예배 문의·온라인 헌금·INTO TABLE·뉴스레터), 소식, 갤러리
- **우리는 인투처치입니다 / 주일 예배 안내 / 예배와 공동체 / FOUNDATION** – 기존 사이트 내용 그대로
- **주일 예배 안내** – 시간, 장소, 네이버·카카오 지도 바로가기, 주소 복사
- **이번 주 질문** – 목사님이 매주 올리는 질문에 성도들이 나눔(사진 첨부·익명 선택·공감♥·수정/삭제), 지난 질문 보관
- **질문 게시판** – 성도가 질문을 올리면 목사님이 답변 (공개 / 비공개 선택)
- **교회 소식**, **갤러리**(태그별 보기, 크게 보기)
- **예배 문의 / 새가족 신청** – 기존 구글 폼 대체 (로그인 없이 작성 가능)
- **회원가입 / 로그인 / 비밀번호 찾기 / 내 정보 / 내 나눔·내 질문 / 회원 탈퇴**
- **앱 설치** – 홈 화면에 추가, 오프라인에서도 화면이 열림

### 관리자용 (PC 최적화, 모바일도 가능)
- **대시보드** – 회원 수, 승인 대기, 새 예배 문의, 답변 대기 질문, 이번 주 나눔 수
- **이번 주 질문** – 등록/수정/예약(미래 주일 날짜), 공개·익명 허용·마감 설정, 나눔 목록(익명 실명 확인), 나눔 삭제, CSV 다운로드
- **질문 게시판** – 답변 대기/완료 필터, 답변 작성·수정, CSV
- **교회 소식** – 작성·이미지·링크·고정·공개 설정
- **갤러리** – 여러 장 한 번에 업로드(자동 리사이즈), 설명·태그 편집, 삭제
- **예배 문의** – 상태(새 문의/연락함/완료), 관리자 메모, 삭제(개인정보 파기), 엑셀(CSV)
- **회원 관리** – 검색, 승인, 이용 제한, 관리자 권한 부여, 엑셀(CSV)
- **사이트 콘텐츠** – 홈·소개·예배 안내·공동체·FOUNDATION·링크·교회 정보 문구와 사진을 화면에서 직접 수정 (코딩 불필요)
- **설정** – 회원가입 승인제 켜기/끄기, 예배 문의 유형 편집

---

## 3. 실제 운영 설정 (약 15분)

### ① Supabase 준비
1. https://supabase.com 에서 프로젝트를 엽니다 (이미 만든 프로젝트를 써도 됩니다). 리전은 **Northeast Asia (Seoul)** 권장.
2. 왼쪽 **SQL Editor** → **New query** → `supabase/schema.sql` 내용을 전부 붙여넣고 **Run**.
3. 같은 방법으로 `supabase/seed.sql`도 실행 (사이트 문구·갤러리 사진 목록·첫 소식이 들어갑니다).

### ② 로그인(이메일) 설정
**Authentication → URL Configuration**
- **Site URL**: 앱 주소 (예: `https://into-church.vercel.app` 또는 `https://app.into.or.kr`)
- **Redirect URLs**: 같은 주소를 추가 (예: `https://app.into.or.kr/**`)

**Authentication → Providers → Email**
- 가입 시 이메일 인증을 받으려면 *Confirm email* 켜기 (기본값). 교회 안에서만 쓰고 간단하게 하려면 끄고, 대신 앱 **설정 → 회원가입 승인제**를 켜서 관리자가 승인하는 방식을 추천합니다.
- (선택) **Email Templates**에서 인증/비밀번호 메일 문구를 한글로 바꿀 수 있어요.
- 무료 플랜 기본 메일은 시간당 발송량이 적습니다. 성도 수가 많아지면 **SMTP 설정**(예: Gmail, Resend)을 연결하세요.

### ③ 앱에 연결
**Project Settings → API**에서 *Project URL*과 *anon public* 키를 복사해 `config.js`에 넣습니다.

```js
window.INTO_CONFIG = {
  SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...',   // anon public 키 (service_role 키는 절대 넣지 마세요)
  ...
};
```

### ④ 배포 (택1)
- **Vercel** (추천): GitHub 저장소에 이 폴더를 올림 → Vercel에서 *Import* → Framework Preset **Other**, Build Command 비움 → Deploy.
- **Netlify**: https://app.netlify.com/drop 에 폴더를 끌어다 놓기.
- **GitHub Pages**: 저장소 Settings → Pages → Branch 선택.

> PWA(설치·오프라인)는 **https 주소**에서만 동작합니다. 위 서비스는 모두 https를 기본 제공합니다.

### ⑤ 첫 관리자 지정
1. 배포된 앱에서 목사님(또는 담당자) 이메일로 **회원가입**.
2. Supabase **SQL Editor**에서 실행:
   ```sql
   update public.profiles set role = 'admin', status = 'active' where email = '목사님이메일@example.com';
   ```
3. 이후 다른 관리자는 앱의 **관리자 → 회원 관리**에서 권한을 줄 수 있어요.

### ⑥ 도메인 (선택)
기존 into.or.kr은 구글 사이트에 연결돼 있으니, 앱은 **app.into.or.kr** 같은 서브도메인으로 Vercel에 연결하는 방법이 가장 간단합니다.
(Vercel → Project → Settings → Domains에 추가 → 도메인 관리 업체에서 CNAME `cname.vercel-dns.com` 등록)

### ⑦ 성도들에게 안내
앱 주소를 단톡방에 공유하고 "홈 화면에 추가"를 안내하세요.
- 아이폰(사파리): 공유 버튼 → **홈 화면에 추가**
- 안드로이드(크롬): 메뉴 ⋮ → **앱 설치** (앱 안의 "홈 화면에 앱 추가" 버튼으로도 가능)

---

## 앱 설치 유도 (휴대폰)

성도들에게는 **설치 안내 주소**를 보내 주세요: `https://into-church-app.vercel.app/#/install`
(관리자 → 설정에서 QR 이미지(인쇄용)와 단톡방 안내문을 바로 받을 수 있어요.)

- **안드로이드(크롬·삼성인터넷)**: 처음 들어오면 설치 안내가 자동으로 뜨고, "앱 설치" 버튼 한 번으로 설치 창이 열립니다.
- **아이폰(Safari·Chrome)**: iOS 버전에 맞춘 3단계 안내(공유 → 홈 화면에 추가)가 뜹니다. 설치 후 실행 시 로고 시작 화면이 보여요.
- **카카오톡·네이버·인스타그램 등 앱 안 브라우저**: 설치가 불가능해서, 카카오톡은 자동으로 기본 브라우저(Safari/Chrome)로 넘기고 나머지는 "다른 브라우저로 열기" 안내를 띄웁니다.
- **PC**: 홈 하단과 설치 안내 페이지에 휴대폰으로 찍을 QR 코드가 나옵니다.
- 안내를 닫으면 3일(다시 보지 않기: 60일) 동안 자동으로 다시 뜨지 않으며, 상단 **앱 설치** 버튼·메뉴에서 언제든 다시 열 수 있어요. 이미 앱으로 실행 중이면 안내가 모두 숨겨집니다.

## 4. 권한(보안) 구조

권한은 화면이 아니라 **DB(RLS 정책)에서 강제**되므로, 주소를 직접 쳐서 들어와도 막힙니다.

| 데이터 | 비회원 | 승인된 성도 | 관리자 |
|---|---|---|---|
| 사이트 문구·소식·갤러리·질문 | 보기 | 보기 | 작성/수정/삭제 |
| 이번 주 질문의 나눔 | ✗ | 보기·작성·내 글 수정/삭제·공감 | 전체 관리(익명 실명 확인) |
| 질문 게시판 | ✗ | 공개 글 보기, 내 글 작성/수정/삭제 | 전체 보기·답변 |
| 예배 문의 | 작성만 | 작성만 | 보기·상태·메모·삭제 |
| 회원 정보 | ✗ | 본인 것만 | 전체 |

- 성도는 자기 권한(role)·상태(status)를 바꿀 수 없고(탈퇴만 가능), 질문 게시판 답변란도 수정할 수 없게 DB 트리거로 막혀 있습니다.
- 사진은 Supabase Storage `media` 버킷(공개 읽기)에 저장되며, 성도는 `members/본인ID/` 폴더에만 올릴 수 있습니다.
- 사진은 올리기 전에 휴대폰에서 자동으로 줄여(최대 1,600px) 용량을 아낍니다.

---

## 5. 폴더 구조

```
index.html              앱 진입점
config.js               ★ Supabase 주소/키 입력
manifest.webmanifest    앱 이름·아이콘·색 (홈 화면 설치 정보)
sw.js                   오프라인 캐시 (서비스워커)
css/app.css             디자인 (into.or.kr 색: #DBD7CE, #423B36, #F3F1EC / IBM Plex Sans KR)
js/util.js              공통 도구 (아이콘, 모달, 이미지 리사이즈, CSV 등)
js/seed.js              기본 문구·사진 목록 (into.or.kr 내용)
js/api-demo.js          데모 모드 저장소 (브라우저 localStorage)
js/api-supabase.js      실제 운영 저장소 (Supabase)
js/app.js               라우터·레이아웃·로그인 상태·설치
js/views-public.js      홈·소개·예배안내·공동체·FOUNDATION·소식·갤러리·예배문의
js/views-member.js      로그인·회원가입·MY·이번 주 질문·질문 게시판
js/views-admin.js       관리자 화면 전체
assets/                 로고(진한/밝은), 앱 아이콘, into.or.kr 사진(원본+썸네일)
supabase/schema.sql     DB 테이블·권한(RLS)·스토리지 정책
supabase/seed.sql       초기 데이터
tools/gen-seed-sql.js   js/seed.js → supabase/seed.sql 변환기 (node tools/gen-seed-sql.js > supabase/seed.sql)
```

## 6. 수정 후 다시 배포할 때
- 화면 문구·사진은 **관리자 → 사이트 콘텐츠**에서 바로 수정 (배포 불필요).
- 코드(css/js)를 고쳤다면 `sw.js`의 `VERSION`·`V`와 `index.html`의 `?v=` 숫자를 함께 올려야 성도 폰에 새 버전이 반영됩니다.

## 7. 알아 두면 좋은 점
- Supabase 무료 플랜은 **일주일간 요청이 없으면 프로젝트가 일시 정지**될 수 있어요. 매주 쓰는 앱이라 대부분 문제없지만, 정지되면 대시보드에서 *Restore*를 누르면 됩니다.
- 구글 사이트의 원본 사진 주소는 임시 주소라 바뀌기 때문에, 사진은 모두 `assets/photos`에 파일로 옮겨 두었습니다.
- 회원을 완전히 지우려면 관리자 화면에서 삭제한 뒤, Supabase **Authentication → Users**에서 로그인 계정도 삭제하세요.

## 8. 다음에 붙이면 좋은 기능
- 새 질문이 올라오면 **푸시 알림** (Web Push + Supabase Edge Function)
- 예배 문의를 **구글 시트로 자동 전송** (Supabase Database Webhook → Apps Script)
- **카카오 로그인** (Supabase Auth의 Kakao provider)
- 설교 영상(유튜브) 목록 페이지
