# Japanote

JLPT 시험 공부를 위한 정적 학습 사이트입니다.

## 실행 방법

1. 저장소 루트에서 **HTTP로 여는 것**을 권장합니다. `file://`로 열면 일부 기능과 Supabase 로그인이 제한될 수 있습니다.
2. **Node.js**가 있으면 아래 명령으로 로컬 서버를 띄웁니다.

   ```text
   npm run dev
   ```

   브라우저에서 `http://localhost:8080/` 로 접속합니다.

3. Node 없이 **Python**만 있으면 아래처럼 실행해도 됩니다.

   ```text
   python -m http.server 8080
   ```

4. VS Code **Live Server** 같은 정적 서버를 써도 되지만, Supabase 매직 링크 테스트는 `npm run dev`처럼 포트가 고정된 환경이 더 편합니다.

## 빌드와 데이터 생성

- 가나 정본은 `data-source/kana-source.json`만 수정합니다.
- 로컬 런타임용 `data/kana.json`을 다시 만들려면 아래 명령을 사용합니다.

  ```text
  npm run build:data:kana
  ```

- Cloudflare Pages 배포용 정적 산출물은 아래 명령으로 생성합니다.

  ```text
  npm run build
  ```

- 배포 산출물은 `output/`에만 생성됩니다. 이 빌드는 루트 HTML과 추적 중인 파일을 직접 수정하지 않습니다.

## Cloudflare Pages 배포

이 저장소는 GitHub Pages 대신 **Cloudflare Pages + private GitHub repo** 구성을 기준으로 운영합니다.

1. Cloudflare Pages에서 현재 GitHub 저장소를 연결합니다.
2. Build command는 `npm run build`로 설정합니다.
3. Build output directory는 `output`으로 설정합니다.
4. Production branch는 현재 기본 브랜치를 사용합니다.
5. 기본 공개 주소는 `https://japanote.pages.dev`를 기준으로 빌드됩니다.
6. 실제 Pages 주소가 다르면 Cloudflare Pages 환경 변수에 `SITE_URL=https://실제-프로젝트.pages.dev`를 추가합니다.
7. Cloudflare 배포가 정상 동작하면 그다음 GitHub Pages를 내리고 저장소를 `private`으로 전환합니다.

배포 산출물을 로컬에서 확인하려면 빌드 후 `output/`을 정적 서버로 띄우면 됩니다.

## 로컬에서 Supabase(클라우드 로그인) 테스트

매직 링크는 **지금 브라우저 주소창에 보이는 URL(포트 포함)**로 돌아오게 요청합니다. Supabase는 **Redirect URLs에 없는 주소**로는 보내 주지 않고, 허용된 주소가 없으면 `Site URL`로 돌려보냅니다. 그래서 로컬에서 보냈는데 배포 주소로 열리면 **허용 목록에 로컬 주소가 빠진 것**입니다.

- **Authentication → URL Configuration → Redirect URLs**에 아래를 넣습니다.

  - 배포: `https://japanote.pages.dev/**`
  - 배포 주소가 다르면: `https://실제-프로젝트.pages.dev/**`
  - 로컬: **`http://localhost:8080/**`** 처럼 **쓰는 포트와 동일하게** 등록합니다.

- 포트가 매번 바뀌면 그때그때 Redirect URLs에 추가해야 하므로, Supabase 테스트는 **`npm run dev`(고정 8080)** 를 쓰는 편이 낫습니다.

## 페이지 구성

- `index.html`: 홈 대시보드, 로드맵, 주간 루틴
- `characters.html`: 히라가나/카타카나 학습
- `kanji.html`: 한자 학습
- `vocab.html`: 단어 플래시카드와 짝 맞추기
- `grammar.html`: 문법 체크리스트 + 문법 드릴
- `reading.html`: 독해 문제 풀이

## 포함 기능

- N5~N1 레벨별 학습 로드맵
- 문자·단어·문법·독해를 짧은 흐름으로 이어서 학습
- 플래시카드 단어 학습
- 문법 체크리스트와 문법 드릴
- 독해 문제 풀이와 짧은 모의 퀴즈
- 로컬 스토리지 기반 학습 진척도 저장

## Supabase 동기화 설정

기기 간에 같은 학습 상태를 보려면 `Supabase Auth`와 `user_state` 테이블을 설정하면 됩니다. 앱은 `assets/js/supabase-sync.js`에서 저장한 단어/한자 목록만 `study_state`에 upsert합니다.

1. [Supabase](https://supabase.com/) 프로젝트를 만들고, **Project Settings → API**에서 **Project URL**과 **anon public** 키를 복사합니다.
2. `assets/js/supabase-config.js` 맨 위의 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 두 줄에 붙여 넣습니다.
   - `stateTable`: 기본 `user_state`입니다. 테이블명을 바꾼 경우에만 수정합니다.
   - `challengePreviewBaseUrl`: 선택 사항입니다. Cloudflare Pages Functions 같은 HTML 응답 endpoint가 있을 때 넣습니다. 기본 설정은 로컬(`localhost`, `127.0.0.1`)이 아닌 현재 origin에서 `/challenge-preview`를 자동으로 사용합니다.
   - `emailRedirectTo`: 비워 두면 현재 페이지 URL로 돌아옵니다.
   - `anon public` 키는 브라우저로 전달되는 클라이언트 공개 키라서, 저장소를 `private`으로 바꿔도 사용자에게 계속 보입니다.
3. Supabase Authentication에서 **Email** 로그인(매직 링크)을 켭니다.
4. Authentication의 `Site URL`과 `Redirect URLs`에 실제 서비스 주소를 등록합니다.
   - 기본 예시: `https://japanote.pages.dev/**`
   - 프로젝트 slug가 다르면 실제 `pages.dev` 주소로 바꿉니다.
   - 로컬 개발 주소는 위의 「로컬에서 Supabase 테스트」 절을 참고합니다.
5. **SQL Editor**에서 `supabase/migrations/001_user_state.sql`을 실행합니다.
   - 예전에 `match_state`, `theme_mode`까지 쓰던 버전으로 이미 테이블을 만든 적이 있다면 `supabase/migrations/002_trim_user_state_columns.sql`도 이어서 실행합니다.
   - 이 작업이 빠지면 `Could not find the table 'public.user_state' in the schema cache` 같은 오류가 날 수 있습니다.
6. 친구 도전 짧은 링크와 동적 공유 미리보기를 쓰려면 `supabase/migrations/003_shared_challenges.sql`도 실행합니다.
7. Cloudflare Pages에 배포하면 `functions/challenge-preview/[code].js`가 공유 미리보기 endpoint로 함께 배포됩니다.
   - 로컬이 아닌 실제 배포 주소에서는 `challengePreviewBaseUrl`이 자동으로 활성화됩니다.
   - 커스텀 도메인을 쓰면 `challengePreviewBaseUrl`에 `https://내도메인/challenge-preview`를 직접 넣어도 됩니다.
8. 참고로 Supabase 기본 `functions/v1` 도메인은 HTML을 `text/plain`으로 내려주기 때문에 링크 미리보기 용도로는 그대로 쓸 수 없습니다.

앱에서는 **이름 + 이메일**만 입력하면 매직 링크가 전송됩니다. 로그인하면 **클라우드에서 저장한 단어/한자 목록을 자동으로 불러오고**, 이후 그 목록이 바뀔 때마다 **잠시 후 자동으로 클라우드에 저장**합니다. 현재 원격 동기화 대상은 `reviewIds`, `masteredIds`, `kanjiReviewIds`, `kanjiMasteredIds` 4개뿐이며, 짝 맞추기 설정이나 테마 같은 화면 상태는 각 기기 로컬에만 남습니다.

Cloudflare Pages에서 서비스 확인이 끝나면:

1. GitHub Pages를 unpublish 합니다.
2. 저장소 visibility를 `private`으로 바꿉니다.
3. Cloudflare Pages가 private 저장소에서도 자동 배포를 계속하는지 다시 확인합니다.
