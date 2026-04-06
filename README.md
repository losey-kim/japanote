# Japanote

JLPT 시험 공부를 위한 정적 학습 사이트입니다.

## 실행 방법

1. 저장소 루트에서 **HTTP로 여는 것**을 권장합니다 (`file://`로 열면 일부 기능·Supabase 로그인이 제한될 수 있어요).
2. **Node.js**가 있으면:

   ```text
   npm run dev
   ```

   브라우저에서 `http://localhost:8080/` 로 접속합니다.

3. Node 없이 **Python**만 있으면:

   ```text
   python -m http.server 8080
   ```

4. 또는 VS Code **Live Server** 등으로 같은 폴더를 띄워도 됩니다.

## 가나 데이터 수정

- 가나 정본은 `data-source/kana-source.json`만 수정합니다.
- 수정 후 아래 명령으로 런타임용 `data/kana.json`을 다시 생성합니다.

  ```text
  npm run build:data:kana
  ```

## 로컬에서 Supabase(클라우드 로그인) 테스트

매직 링크는 **지금 브라우저 주소창에 보이는 그 URL(포트 포함)**으로 돌아오게 요청합니다. Supabase는 **Redirect URLs에 없는 주소**로는 보내 주지 않고, **Site URL(예: GitHub Pages)**로 바꿔 버립니다. 그래서 로컬에서 보냈는데 배포 주소로 열리면 **허용 목록에 로컬 주소가 없는 것**이에요.

- **Authentication → URL Configuration → Redirect URLs**에 아래를 넣습니다.

  - 배포: `https://losey-kim.github.io/Japanote/**` (실제 도메인에 맞게)
  - 로컬: **`http://localhost:8080/**`** 처럼 **쓰는 포트와 동일하게** (예: Live Server가 `53237`이면 `http://localhost:53237/**`도 추가)

- 포트가 매번 바뀌면(Live Server 등) 그때그때 Redirect URLs에 추가하거나, **`npm run dev`(고정 8080)** 로 맞추는 편이 편합니다.

## 페이지 구성

- `index.html`: 홈 대시보드, 로드맵, 주간 루틴
- `vocab.html`: 단어 플래시카드
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
2. `assets/js/supabase-config.js` 맨 위의 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 두 줄에 붙여 넣습니다. 둘 다 채워지면 `enabled`가 자동으로 켜집니다. (실 키는 공개 저장소에 커밋하지 않는 것이 좋습니다.)
   - `stateTable`: 기본 `user_state` (테이블명을 바꾼 경우만 수정)
   - `emailRedirectTo`: 비워 두면 현재 페이지 기준으로 돌아옵니다.
3. Supabase Authentication에서 **Email** 로그인(매직 링크)을 켭니다.
4. Authentication의 `Site URL`과 `Redirect URLs`에 실제 서비스 주소를 등록합니다. GitHub Pages 예: `https://losey-kim.github.io/Japanote/**`. 로컬 개발 주소는 아래「로컬에서 Supabase」절을 참고하세요.
5. **SQL Editor**(Supabase 대시보드 → SQL)에서 `supabase/migrations/001_user_state.sql`을 실행합니다. 예전에 `match_state`, `theme_mode`까지 쓰던 버전으로 이미 테이블을 만든 적이 있다면 이어서 `supabase/migrations/002_trim_user_state_columns.sql`도 실행합니다. 이걸 하지 않으면 동기화 시 `Could not find the table 'public.user_state' in the schema cache` 같은 오류가 납니다.

앱에서는 **이름 + 이메일**만 입력하면 매직 링크가 전송됩니다. 로그인하면 **클라우드에서 저장한 단어/한자 목록을 자동으로 불러오고**, 이후 그 목록이 바뀔 때마다 **잠시 후 자동으로 클라우드에 저장**됩니다. 현재 원격 동기화 대상은 `reviewIds`, `masteredIds`, `kanjiReviewIds`, `kanjiMasteredIds` 4개뿐이며, 짝 맞추기 설정이나 테마 같은 화면 상태는 각 기기 로컬에만 남습니다.

다른 기기에서도 같은 계정으로 로그인하면 같은 데이터를 이어서 볼 수 있어요.
