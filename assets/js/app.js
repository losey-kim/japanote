const storageKey = "jlpt-compass-state";
let state = null;

function getStudyStateStore() {
  if (globalThis.japanoteSync && typeof globalThis.japanoteSync.readValue === "function") {
    return globalThis.japanoteSync;
  }

  return null;
}

const contentLevels = ["N5", "N4", "N3"];
const allLevelValue = "all";
const selectablePracticeLevels = [allLevelValue, ...contentLevels];
const contentRegistry = globalThis.japanoteContent || {};
const kanaStrokeSvgs = globalThis.kanaStrokeSvgs || {};
const vocabContent = contentRegistry.vocab || {};
const grammarContent = contentRegistry.grammar || {};
const readingContent = contentRegistry.reading || {};

function getLevelContentSets(source) {
  return contentLevels.reduce((sets, level) => {
    sets[level] = Array.isArray(source?.[level]) ? source[level] : [];
    return sets;
  }, {});
}

function getAllPracticeSets(levelSets = {}) {
  return contentLevels.flatMap((level) => levelSets[level] || []);
}

function getLegacyVocabKey(level) {
  return `jlpt${level}`;
}

function withTaggedVocabLevel(items, level) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    _level: item?._level || item?.level || level
  }));
}

function getDynamicVocabSource(level = "N5") {
  if (level === allLevelValue) {
    return contentLevels.flatMap((itemLevel) => getDynamicVocabSource(itemLevel));
  }

  if (Array.isArray(vocabContent?.[level]) && vocabContent[level].length) {
    return withTaggedVocabLevel(vocabContent[level], level);
  }

  const legacyKey = getLegacyVocabKey(level);
  if (Array.isArray(vocabContent?.[legacyKey]) && vocabContent[legacyKey].length) {
    return withTaggedVocabLevel(vocabContent[legacyKey], level);
  }

  if (level === "N5" && Array.isArray(globalThis.jlptN5Vocab) && globalThis.jlptN5Vocab.length) {
    return withTaggedVocabLevel(globalThis.jlptN5Vocab, level);
  }

  return [];
}

const fallbackFlashcards = [
  { id: "v1", level: "N5", word: "食べる", reading: "たべる", meaning: "먹다" },
  { id: "v2", level: "N5", word: "行く", reading: "いく", meaning: "가다" },
  { id: "v3", level: "N5", word: "見る", reading: "みる", meaning: "보다" },
  { id: "v4", level: "N5", word: "聞く", reading: "きく", meaning: "듣다, 묻다" },
  { id: "v5", level: "N5", word: "飲む", reading: "のむ", meaning: "마시다" },
  { id: "v6", level: "N5", word: "学校", reading: "がっこう", meaning: "학교" },
  { id: "v7", level: "N5", word: "先生", reading: "せんせい", meaning: "선생님" },
  { id: "v8", level: "N5", word: "友だち", reading: "ともだち", meaning: "친구" },
  { id: "v9", level: "N5", word: "今日", reading: "きょう", meaning: "오늘" },
  { id: "v10", level: "N5", word: "明日", reading: "あした", meaning: "내일" },
  { id: "v11", level: "N5", word: "水", reading: "みず", meaning: "물" },
  { id: "v12", level: "N5", word: "本", reading: "ほん", meaning: "책" },
  { id: "v13", level: "N4", word: "準備", reading: "じゅんび", meaning: "준비" },
  { id: "v14", level: "N4", word: "続ける", reading: "つづける", meaning: "계속하다" },
  { id: "v15", level: "N3", word: "提案", reading: "ていあん", meaning: "제안" },
  { id: "v16", level: "N3", word: "割合", reading: "わりあい", meaning: "비율, 정도" },
  { id: "v17", level: "N2", word: "模擬", reading: "もぎ", meaning: "모의" },
  { id: "v18", level: "N2", word: "適切", reading: "てきせつ", meaning: "적절함" },
  { id: "v19", level: "N1", word: "顕著", reading: "けんちょ", meaning: "현저함" },
  { id: "v20", level: "N1", word: "推移", reading: "すいい", meaning: "추이" }
];

let flashcards = [...fallbackFlashcards];
let vocabListItems = [...fallbackFlashcards];
const vocabPageSize = 20;
const kanjiPageSize = 20;
const vocabQuizSessionSize = 12;
const studyCardOrderCache = {
  vocab: { signature: "", ids: [] },
  kanji: { signature: "", ids: [] }
};

function buildStudyCardSignature(items) {
  return Array.isArray(items) ? items.map((item) => item?.id || "").join("|") : "";
}

function shuffleStudyCardIds(ids) {
  const nextIds = [...ids];

  for (let index = nextIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextIds[index], nextIds[swapIndex]] = [nextIds[swapIndex], nextIds[index]];
  }

  return nextIds;
}

function getOrderedStudyCards(key, items) {
  const source = Array.isArray(items) ? items : [];
  const orderState = studyCardOrderCache[key];

  if (!orderState || source.length <= 1) {
    return source;
  }

  const signature = buildStudyCardSignature(source);

  if (orderState.signature !== signature) {
    orderState.signature = signature;
    orderState.ids = shuffleStudyCardIds(source.map((item) => item.id));
  }

  const orderMap = new Map(orderState.ids.map((id, index) => [id, index]));

  return [...source].sort((left, right) => {
    const leftIndex = orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}

const starterItems = [
  {
    id: "s1",
    track: "문자",
    module: "hiragana",
    title: "히라가나 전체 보기",
    detail: "히라가나를 쭉 보고 바로 퀴즈까지 가봐요.",
    duration: "2~3분"
  },
  {
    id: "s2",
    track: "문자",
    module: "katakana",
    title: "카타카나 전체 보기",
    detail: "카타카나를 쭉 보면서 읽기를 익혀봐요.",
    duration: "2~3분"
  },
  {
    id: "s3",
    track: "단어",
    module: "words",
    title: "N5 단어 보기",
    detail: "자주 나오는 N5 단어를 가볍게 익혀봐요.",
    duration: "3분"
  },
  {
    id: "s4",
    track: "문법",
    module: "particles",
    title: "조사 5개 보기",
    detail: "헷갈리기 쉬운 조사 5개부터 가볍게 볼까요?",
    duration: "1분"
  },
  {
    id: "s5",
    track: "한자",
    module: "kanji",
    title: "학년별 한자 보기",
    detail: "일본 초등학교 학년별 배당 한자를 읽기로 익혀봐요.",
    duration: "5분"
  },
  {
    id: "s6",
    track: "독해",
    module: "sentences",
    title: "짧은 문장 읽기",
    detail: "메모나 공지처럼 짧은 문장을 읽어봐요.",
    duration: "1지문"
  }
];
const basicPracticeSets = {
  kana: {
    label: "문자",
    heading: "히라가나 · 가타카나",
    items: [
      {
        id: "bp-k1",
        source: "히라가나 1",
        title: "히라가나 기본 모음",
        note: "문자를 보고 바로 소리를 떠올리기",
        prompt: "이 글자, 어떻게 읽을까요?",
        display: "あ",
        displaySub: "기본 모음",
        options: ["a / 아", "i / 이", "u / 우", "e / 에"],
        answer: 0,
        explanation: "あ는 일본어의 기본 모음 a 소리예요."
      },
      {
        id: "bp-k2",
        source: "히라가나 2",
        title: "히라가나 자주 쓰는 글자",
        note: "단어에서 자주 나오는 글자",
        prompt: "이 글자, 어떻게 읽을까요?",
        display: "き",
        displaySub: "예: きく, きょう",
        options: ["ki / 키", "sa / 사", "ta / 타", "ne / 네"],
        answer: 0,
        explanation: "き는 ki 소리예요. 聞く, 今日 같은 단어에서 자주 보여요."
      },
      {
        id: "bp-k3",
        source: "가타카나 1",
        title: "가타카나 읽기",
        note: "외래어에서 많이 보는 글자",
        prompt: "이 글자, 어떻게 읽을까요?",
        display: "コ",
        displaySub: "예: コーヒー",
        options: ["ko / 코", "so / 소", "to / 토", "no / 노"],
        answer: 0,
        explanation: "コ는 ko 소리예요. コーヒー 같은 단어에서 바로 나와요."
      },
      {
        id: "bp-k4",
        source: "가타카나 2",
        title: "가타카나 기본 글자",
        note: "가타카나도 읽기부터 고정",
        prompt: "이 글자, 어떻게 읽을까요?",
        display: "ケ",
        displaySub: "예: ケーキ",
        options: ["ke / 케", "re / 레", "na / 나", "ha / 하"],
        answer: 0,
        explanation: "ケ는 ke 소리예요. ケーキ처럼 쉬운 외래어에서 자주 보여요."
      },
      {
        id: "bp-k5",
        source: "히라가나 3",
        title: "문자 읽기 마무리",
        note: "헷갈리는 글자 구분",
        prompt: "이 글자, 어떻게 읽을까요?",
        display: "ぬ",
        displaySub: "ぬ / め / ね 구분하기",
        options: ["nu / 누", "me / 메", "ne / 네", "no / 노"],
        answer: 0,
        explanation: "ぬ는 nu 소리예요. 비슷한 글자랑 섞이면 여기서 자주 헷갈려요."
      }
    ]
  },
  words: {
    label: "단어",
    heading: "N5 읽기 단어",
    items: [
      {
        id: "bp-w1",
        source: "N5 단어 1",
        title: "동사 읽기",
        note: "읽기와 뜻을 같이 묶기",
        prompt: "이 단어 뜻, 어떤 걸까요?",
        display: "たべる",
        displaySub: "食べる",
        options: ["먹다", "가다", "보다", "듣다"],
        answer: 0,
        explanation: "たべる는 食べる예요. 뜻은 먹다예요."
      },
      {
        id: "bp-w2",
        source: "N5 단어 2",
        title: "명사 읽기",
        note: "초급 핵심 장소 단어",
        prompt: "이 단어 뜻, 어떤 걸까요?",
        display: "がっこう",
        displaySub: "学校",
        options: ["학교", "선생님", "친구", "책"],
        answer: 0,
        explanation: "がっこう는 学校예요. 뜻은 학교예요."
      },
      {
        id: "bp-w3",
        source: "N5 단어 3",
        title: "기본 명사",
        note: "뜻보다 읽기를 먼저 붙잡기",
        prompt: "이 단어 뜻, 어떤 걸까요?",
        display: "みず",
        displaySub: "水",
        options: ["물", "불", "사람", "달"],
        answer: 0,
        explanation: "みず는 水예요. 뜻은 물이에요."
      },
      {
        id: "bp-w4",
        source: "N5 단어 4",
        title: "시간 표현",
        note: "오늘, 내일 구분하기",
        prompt: "이 단어 뜻, 어떤 걸까요?",
        display: "あした",
        displaySub: "明日",
        options: ["내일", "오늘", "어제", "아침"],
        answer: 0,
        explanation: "あした는 明日예요. 뜻은 내일이에요."
      },
      {
        id: "bp-w5",
        source: "N5 단어 5",
        title: "사람 표현",
        note: "자주 쓰는 인간관계 단어",
        prompt: "이 단어 뜻, 어떤 걸까요?",
        display: "ともだち",
        displaySub: "友だち",
        options: ["친구", "선생님", "학생", "가족"],
        answer: 0,
        explanation: "ともだち는 友だち예요. 뜻은 친구예요."
      }
    ]
  },
  particles: {
    label: "조사",
    heading: "기본 조사",
    items: [
      {
        id: "bp-p1",
        source: "조사 1",
        title: "주제 표시",
        note: "A는 B예요 형태",
        prompt: "빈칸에 어울리는 조사를 골라봐요.",
        display: "わたし（　）がくせい です。",
        displaySub: "나는 학생이에요.",
        options: ["は", "を", "で", "に"],
        answer: 0,
        explanation: "주제를 말할 때는 「は」를 써요. 「わたしは がくせいです。」가 자연스러워요."
      },
      {
        id: "bp-p2",
        source: "조사 2",
        title: "도착점",
        note: "어디에 가는지",
        prompt: "빈칸에 어울리는 조사를 골라봐요.",
        display: "がっこう（　）いきます。",
        displaySub: "학교에 가요.",
        options: ["を", "に", "が", "と"],
        answer: 1,
        explanation: "도착점은 「に」를 써요. 학교에 간다는 뜻이에요."
      },
      {
        id: "bp-p3",
        source: "조사 3",
        title: "행동 장소",
        note: "어디에서 하는지",
        prompt: "빈칸에 어울리는 조사를 골라봐요.",
        display: "スーパー（　）みずを かいます。",
        displaySub: "슈퍼에서 물을 사요.",
        options: ["で", "に", "を", "は"],
        answer: 0,
        explanation: "행동이 일어나는 장소는 「で」를 써요."
      },
      {
        id: "bp-p4",
        source: "조사 4",
        title: "목적어",
        note: "무엇을 하는지",
        prompt: "빈칸에 어울리는 조사를 골라봐요.",
        display: "ほん（　）よみます。",
        displaySub: "책을 읽어요.",
        options: ["に", "を", "で", "が"],
        answer: 1,
        explanation: "목적어는 「を」를 써요. 책을 읽다는 「ほんを よみます。」예요."
      },
      {
        id: "bp-p5",
        source: "조사 5",
        title: "함께 하는 대상",
        note: "누구와 같이",
        prompt: "빈칸에 어울리는 조사를 골라봐요.",
        display: "ともだち（　）べんきょう します。",
        displaySub: "친구와 공부해요.",
        options: ["と", "を", "で", "へ"],
        answer: 0,
        explanation: "함께하는 대상은 「と」를 써요. 친구와 같이 공부한다는 뜻이에요."
      }
    ]
  },
  kanji: {
    label: "한자",
    heading: "첫 한자 읽기",
    items: [
      {
        id: "bp-j1",
        source: "한자 1",
        title: "가장 먼저 보는 한자",
        note: "대표 읽기를 먼저 고정",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "日",
        displaySub: "뜻: 해, 날",
        options: ["ひ", "みず", "つき", "やま"],
        answer: 0,
        explanation: "日의 대표 읽기는 ひ예요. 날짜나 요일에서도 자주 보여요."
      },
      {
        id: "bp-j2",
        source: "한자 2",
        title: "사람 한자",
        note: "가장 자주 쓰는 기초 한자",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "人",
        displaySub: "뜻: 사람",
        options: ["ひと", "ほん", "か", "みる"],
        answer: 0,
        explanation: "人은 ひと, 사람이에요."
      },
      {
        id: "bp-j3",
        source: "한자 3",
        title: "달 한자",
        note: "요일과 날짜에서 자주 나옴",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "月",
        displaySub: "뜻: 달, 월",
        options: ["つき", "ひ", "みず", "き"],
        answer: 0,
        explanation: "月은 보통 つき라고 읽어요."
      },
      {
        id: "bp-j4",
        source: "한자 4",
        title: "불 한자",
        note: "짧게 자주 반복하기",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "火",
        displaySub: "뜻: 불",
        options: ["ひ", "みず", "ひと", "つき"],
        answer: 0,
        explanation: "火는 ひ, 불이에요."
      },
      {
        id: "bp-j5",
        source: "한자 5",
        title: "물 한자",
        note: "초급 명사와 같이 익히기",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "水",
        displaySub: "뜻: 물",
        options: ["みず", "か", "き", "ほん"],
        answer: 0,
        explanation: "水는 みず, 물이에요. 단어 카드랑 같이 보면 더 빨리 익혀요."
      },
      {
        id: "bp-j6",
        source: "한자 6",
        title: "나무 한자",
        note: "요일과 단어에서 자주 보임",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "木",
        displaySub: "뜻: 나무",
        options: ["き", "やま", "かわ", "て"],
        answer: 0,
        explanation: "木는 き, 나무예요. 목요일(木曜日)에서도 자주 만나요."
      },
      {
        id: "bp-j7",
        source: "한자 7",
        title: "산 한자",
        note: "지형 표현의 기본",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "山",
        displaySub: "뜻: 산",
        options: ["やま", "くち", "みず", "ひ"],
        answer: 0,
        explanation: "山은 やま, 산이에요. 富士山처럼 지명에서도 많이 보여요."
      },
      {
        id: "bp-j8",
        source: "한자 8",
        title: "강 한자",
        note: "자연 표현과 함께 익히기",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "川",
        displaySub: "뜻: 강",
        options: ["かわ", "やま", "ひと", "て"],
        answer: 0,
        explanation: "川은 かわ, 강이에요. 산이랑 함께 자연 단어에서 자주 보여요."
      },
      {
        id: "bp-j9",
        source: "한자 9",
        title: "입 한자",
        note: "몸과 관련된 기초 한자",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "口",
        displaySub: "뜻: 입",
        options: ["くち", "め", "あめ", "つき"],
        answer: 0,
        explanation: "口는 くち, 입이에요. 입구라는 뜻의 入口에서도 같은 글자를 볼 수 있어요."
      },
      {
        id: "bp-j10",
        source: "한자 10",
        title: "손 한자",
        note: "몸 표현을 넓히는 한자",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "手",
        displaySub: "뜻: 손",
        options: ["て", "くち", "き", "かわ"],
        answer: 0,
        explanation: "手는 て, 손이에요. 上手처럼 익숙한 단어에서도 자주 보여요."
      },
      {
        id: "bp-j11",
        source: "한자 11",
        title: "눈 한자",
        note: "몸과 관련된 핵심 한자",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "目",
        displaySub: "뜻: 눈",
        options: ["め", "みみ", "あし", "いし"],
        answer: 0,
        explanation: "目는 め, 눈이에요. 익혀두면 관련 단어를 볼 때 바로 떠올리기 쉬워요."
      },
      {
        id: "bp-j12",
        source: "한자 12",
        title: "귀 한자",
        note: "몸 표현 세트로 익히기",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "耳",
        displaySub: "뜻: 귀",
        options: ["みみ", "め", "はな", "あめ"],
        answer: 0,
        explanation: "耳는 みみ, 귀예요. 目와 함께 몸 관련 기초 한자로 자주 묶어 배워요."
      },
      {
        id: "bp-j13",
        source: "한자 13",
        title: "발 한자",
        note: "몸 표현을 넓히는 기본",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "足",
        displaySub: "뜻: 발",
        options: ["あし", "て", "くるま", "かわ"],
        answer: 0,
        explanation: "足는 あし, 발이에요. 걷기나 이동 표현에서도 자주 보여요."
      },
      {
        id: "bp-j14",
        source: "한자 14",
        title: "비 한자",
        note: "날씨 표현에서 자주 등장",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "雨",
        displaySub: "뜻: 비",
        options: ["あめ", "ゆき", "いし", "そら"],
        answer: 0,
        explanation: "雨는 あめ, 비예요. 날씨 단어를 볼 때 아주 자주 나와요."
      },
      {
        id: "bp-j15",
        source: "한자 15",
        title: "돌 한자",
        note: "짧게 외우기 좋은 명사",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "石",
        displaySub: "뜻: 돌",
        options: ["いし", "き", "たけ", "かい"],
        answer: 0,
        explanation: "石는 いし, 돌이에요. 글자 모양도 단순해서 초반에 익히기 좋아요."
      },
      {
        id: "bp-j16",
        source: "한자 16",
        title: "꽃 한자",
        note: "일상 단어와 같이 보기",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "花",
        displaySub: "뜻: 꽃",
        options: ["はな", "みず", "そら", "た"],
        answer: 0,
        explanation: "花는 はな, 꽃이에요. 회화에서도 자주 쓰는 친숙한 한자예요."
      },
      {
        id: "bp-j17",
        source: "한자 17",
        title: "차 한자",
        note: "이동 관련 단어의 기본",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "車",
        displaySub: "뜻: 차, 자동차",
        options: ["くるま", "かわ", "いと", "やま"],
        answer: 0,
        explanation: "車는 くるま, 차예요. 생활 단어와 연결해서 외우기 좋아요."
      },
      {
        id: "bp-j18",
        source: "한자 18",
        title: "하늘 한자",
        note: "자연 표현 확장",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "空",
        displaySub: "뜻: 하늘",
        options: ["そら", "あめ", "かわ", "ひ"],
        answer: 0,
        explanation: "空는 そら, 하늘이에요. 날씨나 풍경 표현과 함께 자주 익혀요."
      },
      {
        id: "bp-j19",
        source: "한자 19",
        title: "밭 한자",
        note: "기초 글자 모양 익히기",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "田",
        displaySub: "뜻: 밭",
        options: ["た", "いし", "たけ", "はな"],
        answer: 0,
        explanation: "田는 た, 밭이에요. 모양이 단순해서 한자 감각을 잡기 좋아요."
      },
      {
        id: "bp-j20",
        source: "한자 20",
        title: "대나무 한자",
        note: "자연 한자 마무리",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "竹",
        displaySub: "뜻: 대나무",
        options: ["たけ", "き", "いと", "くち"],
        answer: 0,
        explanation: "竹은 たけ, 대나무예요. 자연 한자를 넓힐 때 같이 보면 좋아요."
      },
      {
        id: "bp-j21",
        source: "한자 21",
        title: "실 한자",
        note: "모양이 단순한 기초 한자",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "糸",
        displaySub: "뜻: 실",
        options: ["いと", "いし", "みみ", "はな"],
        answer: 0,
        explanation: "糸는 いと, 실이에요. 글자 모양이 독특해서 초반에 기억해두기 좋아요."
      },
      {
        id: "bp-j22",
        source: "한자 22",
        title: "조개 한자",
        note: "사물 이름으로 익히기",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "貝",
        displaySub: "뜻: 조개",
        options: ["かい", "かわ", "こ", "たけ"],
        answer: 0,
        explanation: "貝는 かい, 조개예요. 간단한 명사 한자로 익히기 좋아요."
      },
      {
        id: "bp-j23",
        source: "한자 23",
        title: "구슬 한자",
        note: "짧은 읽기로 외우기",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "玉",
        displaySub: "뜻: 구슬, 공",
        options: ["たま", "そら", "くるま", "め"],
        answer: 0,
        explanation: "玉는 たま, 구슬이에요. 읽기가 짧아서 금방 익히기 좋아요."
      },
      {
        id: "bp-j24",
        source: "한자 24",
        title: "아이 한자",
        note: "사람 관련 한자 시작",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "子",
        displaySub: "뜻: 아이",
        options: ["こ", "て", "おとこ", "あめ"],
        answer: 0,
        explanation: "子는 こ, 아이예요. 이름이나 단어 끝에서도 자주 보여요."
      },
      {
        id: "bp-j25",
        source: "한자 25",
        title: "여자 한자",
        note: "사람 표현의 기본",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "女",
        displaySub: "뜻: 여자",
        options: ["おんな", "おとこ", "ひと", "こ"],
        answer: 0,
        explanation: "女는 おんな, 여자예요. 男과 같이 묶어서 보면 더 잘 들어와요."
      },
      {
        id: "bp-j26",
        source: "한자 26",
        title: "남자 한자",
        note: "사람 표현 짝으로 익히기",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "男",
        displaySub: "뜻: 남자",
        options: ["おとこ", "おんな", "こ", "みみ"],
        answer: 0,
        explanation: "男는 おとこ, 남자예요. 女와 짝으로 보면 더 익히기 쉬워요."
      },
      {
        id: "bp-j27",
        source: "한자 27",
        title: "개 한자",
        note: "동물 한자 시작",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "犬",
        displaySub: "뜻: 개",
        options: ["いぬ", "ねこ", "うま", "さかな"],
        answer: 0,
        explanation: "犬는 いぬ, 개예요. 생활 단어에서 자주 보는 대표 동물 한자예요."
      },
      {
        id: "bp-j28",
        source: "한자 28",
        title: "물고기 한자",
        note: "동물 표현 확장",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "魚",
        displaySub: "뜻: 물고기",
        options: ["さかな", "いぬ", "かわ", "たま"],
        answer: 0,
        explanation: "魚는 さかな, 물고기예요. 음식이나 시장 단어로도 이어져요."
      },
      {
        id: "bp-j29",
        source: "한자 29",
        title: "위 한자",
        note: "위치 표현의 기본",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "上",
        displaySub: "뜻: 위",
        options: ["うえ", "した", "なか", "そと"],
        answer: 0,
        explanation: "上는 うえ, 위예요. 방향과 위치 표현에서 아주 자주 보여요."
      },
      {
        id: "bp-j30",
        source: "한자 30",
        title: "아래 한자",
        note: "방향 표현 마무리",
        prompt: "이 한자, 어떻게 읽을까요?",
        display: "下",
        displaySub: "뜻: 아래",
        options: ["した", "うえ", "みぎ", "ひだり"],
        answer: 0,
        explanation: "下는 した, 아래예요. 上와 함께 묶어두면 방향 한자를 빨리 익혀요."
      }
    ]
  },
  sentences: {
    label: "문장",
    heading: "짧은 문장 읽기",
    items: [
      {
        id: "bp-s1",
        source: "문장 1",
        title: "기본 단정 문장",
        note: "아주 짧은 단정 표현",
        prompt: "문장 뜻에 맞는 답을 골라봐요.",
        display: "これは ほん です。",
        displaySub: "이건 책이에요.",
        options: ["이건 책이에요.", "이건 물이에요.", "저건 학교예요.", "이건 친구예요."],
        answer: 0,
        explanation: "これは는 '이것은', ほん은 '책', です는 문장을 부드럽게 마무리할 때 써요."
      },
      {
        id: "bp-s2",
        source: "문장 2",
        title: "이동 문장",
        note: "장소 + 이동",
        prompt: "문장 뜻에 맞는 답을 골라봐요.",
        display: "あした がっこうへ いきます。",
        displaySub: "시간 표현 + 장소 + 가다",
        options: ["내일 학교에 가요.", "오늘 학교에서 공부해요.", "내일 집에 와요.", "어제 학교에 갔어요."],
        answer: 0,
        explanation: "あした는 '내일', がっこうへ는 '학교에', いきます는 '가요'라는 뜻이에요."
      },
      {
        id: "bp-s3",
        source: "문장 3",
        title: "행동 문장",
        note: "목적어 + 동사",
        prompt: "문장 뜻에 맞는 답을 골라봐요.",
        display: "みずを のみます。",
        displaySub: "을/를 + 마셔요",
        options: ["물을 마셔요.", "물을 봐요.", "책을 읽어요.", "밥을 먹어요."],
        answer: 0,
        explanation: "みず는 '물', のみます는 '마셔요'예요. 그래서 문장 뜻은 '물을 마셔요'가 돼요."
      },
      {
        id: "bp-s4",
        source: "문장 4",
        title: "같이 하는 행동",
        note: "と 조사 익히기",
        prompt: "문장 뜻에 맞는 답을 골라봐요.",
        display: "ともだちと べんきょう します。",
        displaySub: "친구와 공부해요.",
        options: ["친구와 공부해요.", "친구를 만나요.", "친구와 가요.", "친구가 공부해요."],
        answer: 0,
        explanation: "ともだちと는 '친구와', べんきょうします는 '공부해요'예요."
      },
      {
        id: "bp-s5",
        source: "문장 5",
        title: "소유 표현",
        note: "나의 + 명사",
        prompt: "문장 뜻에 맞는 답을 골라봐요.",
        display: "わたしの せんせい です。",
        displaySub: "소유 표현 확인",
        options: ["제 선생님이에요.", "저는 선생님이에요.", "제 친구예요.", "학생이에요."],
        answer: 0,
        explanation: "わたしの는 '저의', せんせい는 '선생님'이에요."
      }
    ]
  }
};

const grammarItems = Array.isArray(grammarContent.items) ? grammarContent.items : [];
const grammarPracticeSets = getLevelContentSets(grammarContent.practiceSets);
grammarPracticeSets[allLevelValue] = getAllPracticeSets(grammarPracticeSets);

const quizQuestions = [
  {
    id: "q1",
    level: "N5",
    question: "「毎日 日本語を 勉強します。」에서 「毎日」는 무슨 뜻일까요?",
    options: ["매일", "지금", "어제", "조금"],
    answer: "매일"
  },
  {
    id: "q2",
    level: "N4",
    question: "「雨が降りそうです。」는 자연스럽게 어떻게 읽을까요?",
    options: ["비를 좋아해요", "비가 올 것 같아요", "비가 그쳤어요", "비를 피했어요"],
    answer: "비가 올 것 같아요"
  },
  {
    id: "q3",
    level: "N3",
    question: "「〜わけではない」는 어떤 느낌에 가장 가까울까요?",
    options: ["강한 명령", "부분 부정", "과거 회상", "희망 표현"],
    answer: "부분 부정"
  },
  {
    id: "q4",
    level: "N2",
    question: "「急がざるを得ない」는 어떤 뜻에 가장 가까울까요?",
    options: ["급할 필요가 없다", "서둘러야만 한다", "급하게 말하다", "급하게 먹는다"],
    answer: "서둘러야만 한다"
  },
  {
    id: "q5",
    level: "N1",
    question: "「新製品の発売を皮切りに」는 어떤 뜻일까요?",
    options: ["판매를 멈추고", "출시를 시작점으로 하여", "가격을 낮추고", "리뷰를 마치고"],
    answer: "출시를 시작점으로 하여"
  }
];

let dynamicQuizSource = getDynamicVocabSource("N5");
const quizModeLabels = {
  meaning: "뜻 맞히기",
  reading: "읽기 맞히기"
};
const vocabQuizFieldLabels = {
  reading: "히라가나·가타카나",
  word: "한자",
  meaning: "뜻"
};
const vocabQuizFieldOptions = ["reading", "word", "meaning"];
const vocabQuizResultFilterLabels = {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};
const quizSessionSizeOptions = [10, 20];
const starterKanjiQuizCountOptions = [5, 10, 15, 20];
const kanjiMatchCountOptions = [5, 10, 15, 20];
const vocabQuizCountOptions = [5, 10, 15, 20];
const grammarPracticeCountOptions = [5, 10, 15, 20];
const readingCountOptions = [5, 10, 15, 20];
const quizDurationOptions = [10, 15, 20, 0];
const grammarPracticeDurationOptions = [15, 25, 35, 0];
const readingDurationOptions = [45, 60, 90, 0];
const kanjiQuizFieldOptions = ["display", "reading"];
const kanjiQuizFieldLabels = {
  display: "한자",
  reading: "발음"
};
const vocabPartAllValue = allLevelValue;
const selectableStudyLevels = [...contentLevels, allLevelValue];
const kanjiGradeOptions = [allLevelValue, "1", "2", "3", "4", "5", "6"];
const kanjiDataRows = Array.isArray(globalThis.JAPANOTE_KANJI_DATA) ? globalThis.JAPANOTE_KANJI_DATA : [];
const kanjiToneMap = {
  "1": "tone-gold",
  "2": "tone-sky",
  "3": "tone-mint",
  "4": "tone-coral",
  "5": "tone-gold",
  "6": "tone-sky"
};

function getKanjiTone(grade) {
  return kanjiToneMap[String(grade)] || "tone-gold";
}

function getKanjiGrade(value = state?.kanjiGrade) {
  const normalizedGrade = normalizeQuizText(value);
  return kanjiGradeOptions.includes(normalizedGrade) ? normalizedGrade : allLevelValue;
}

function getKanjiGradeLabel(grade = state?.kanjiGrade) {
  const activeGrade = getKanjiGrade(grade);
  return activeGrade === allLevelValue ? "전체" : `${activeGrade}학년`;
}

function getKanjiGradeSummaryLabel(grade = state?.kanjiGrade) {
  return getKanjiGrade(grade) === allLevelValue ? "전체" : `${getKanjiGrade(grade)}학년`;
}

function getKanjiCollectionFilter(value = state?.kanjiCollectionFilter) {
  const normalizedValue = normalizeQuizText(value);
  if (normalizedValue === "saved") {
    return "review";
  }
  return Object.prototype.hasOwnProperty.call(kanjiCollectionFilterLabels, normalizedValue) ? normalizedValue : "all";
}

function getKanjiCollectionSummaryLabel(filter = state?.kanjiCollectionFilter) {
  return kanjiCollectionFilterLabels[getKanjiCollectionFilter(filter)] || kanjiCollectionFilterLabels.all;
}

function getKanjiView(view = state?.kanjiView) {
  return view === "list" ? "list" : "card";
}

function getKanjiViewLabel(view = state?.kanjiView) {
  return getKanjiView(view) === "list" ? "목록" : "카드";
}

function getKanjiOptionsSummaryText() {
  return [
    getKanjiGradeSummaryLabel(),
    getKanjiViewLabel(),
    getKanjiCollectionSummaryLabel()
  ].join(" · ");
}

function getStarterKanjiQuizField(value, fallback = "display") {
  return kanjiQuizFieldOptions.includes(value) ? value : fallback;
}

function getDefaultStarterKanjiOptionField(questionField) {
  return getStarterKanjiQuizField(questionField) === "display" ? "reading" : "display";
}

function getDefaultStarterKanjiQuestionField(optionField) {
  return getStarterKanjiQuizField(optionField) === "display" ? "reading" : "display";
}

function getStarterKanjiQuestionField(value = state?.starterKanjiQuestionField) {
  return getStarterKanjiQuizField(value, "display");
}

function getStarterKanjiOptionField(value = state?.starterKanjiOptionField, questionField = state?.starterKanjiQuestionField) {
  const normalizedQuestionField = getStarterKanjiQuestionField(questionField);
  let nextField = getStarterKanjiQuizField(value, getDefaultStarterKanjiOptionField(normalizedQuestionField));

  if (nextField === normalizedQuestionField) {
    nextField = getDefaultStarterKanjiOptionField(normalizedQuestionField);
  }

  return nextField;
}

function getStarterKanjiFieldLabel(field) {
  return kanjiQuizFieldLabels[getStarterKanjiQuizField(field)] || kanjiQuizFieldLabels.display;
}

function getStarterKanjiQuizConfigLabel(
  questionField = state?.starterKanjiQuestionField,
  optionField = state?.starterKanjiOptionField
) {
  return `${getStarterKanjiFieldLabel(questionField)} → ${getStarterKanjiFieldLabel(optionField)}`;
}

function getStarterKanjiItemValue(item, field) {
  const normalizedField = getStarterKanjiQuizField(field);
  return normalizedField === "reading"
    ? normalizeQuizText(item?.reading)
    : normalizeQuizDisplay(item?.display);
}

function getStarterKanjiPrompt(questionField = state?.starterKanjiQuestionField) {
  return getStarterKanjiQuestionField(questionField) === "reading"
    ? "이 발음, 어떤 한자일까요?"
    : "이 한자, 어떻게 읽을까요?";
}

function buildKanjiPracticeItemsFromData(rows = kanjiDataRows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const [char, grade, reading, readingsDisplay, strokeCount] = Array.isArray(row) ? row : [];
      const normalizedGrade = String(grade || "");
      const normalizedReading = normalizeQuizText(reading || "");
      const normalizedChar = normalizeQuizText(char || "");

      if (!normalizedChar || !normalizedReading || !kanjiGradeOptions.includes(normalizedGrade)) {
        return null;
      }

      const gradeLabel = getKanjiGradeLabel(normalizedGrade);
      const strokes = Number.isFinite(Number(strokeCount)) ? Number(strokeCount) : 0;

      return {
        id: `kanji-${normalizedGrade}-${index + 1}-${normalizedChar}`,
        grade: normalizedGrade,
        gradeLabel,
        source: gradeLabel,
        title: `${gradeLabel} 한자`,
        note: gradeLabel,
        prompt: "이 한자, 어떻게 읽을까요?",
        display: normalizedChar,
        displaySub: "",
        reading: normalizedReading,
        readingsDisplay: normalizeQuizText(readingsDisplay || normalizedReading),
        strokeCount: strokes,
        tone: getKanjiTone(normalizedGrade),
        explanation: `${normalizedChar}의 대표 읽기 중 하나는 ${normalizedReading}예요.`
      };
    })
    .filter(Boolean);
}

function normalizeQuizText(value) {
  const text = String(value ?? "").trim();

  if (/%[0-9A-Fa-f]{2}/.test(text)) {
    try {
      return decodeURIComponent(text).replace(/\s+/g, " ").trim();
    } catch (error) {
      return text.replace(/\s+/g, " ").trim();
    }
  }

  return text.replace(/\s+/g, " ").trim();
}

function normalizeQuizDisplay(value) {
  return normalizeQuizText(value).replace(/\s*·\s*/g, " / ");
}

function normalizeStudyLevelValue(level, fallback = "") {
  const text = normalizeQuizText(level);
  const upper = text.toUpperCase();

  if (!text) {
    return fallback;
  }

  if (upper === allLevelValue.toUpperCase()) {
    return allLevelValue;
  }

  const matchedLevel = upper.match(/^N?([1-5])$/);
  return matchedLevel ? `N${matchedLevel[1]}` : text;
}

function formatStudyLevelLabel(level, fallback = "") {
  const normalizedLevel = normalizeStudyLevelValue(level, fallback);
  return normalizedLevel === allLevelValue ? "전체" : normalizedLevel;
}

function formatQuizLineBreaks(value) {
  return normalizeQuizText(value).replace(/\s*;\s*/g, "\n");
}

function hasFinalConsonant(char) {
  const code = char.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

function softenCopulaEnding(text) {
  return text
    .replace(/([가-힣])이었습니다\./g, (_, char) => `${char}이었어요.`)
    .replace(/([가-힣])였습니다\./g, (_, char) => `${char}였어요.`)
    .replace(/([가-힣])입니다\./g, (_, char) => `${char}${hasFinalConsonant(char) ? "이에요." : "예요."}`)
    .replace(/([가-힣])입니다/g, (_, char) => `${char}${hasFinalConsonant(char) ? "이에요" : "예요"}`);
}

function softenVisibleKoreanCopy(value) {
  return softenCopulaEnding(normalizeQuizText(value))
    .replace(/무엇인가요\?/g, "뭘까요?")
    .replace(/무엇을까요\?/g, "뭘까요?")
    .replace(/같습니다\./g, "같아요.")
    .replace(/씁니다\./g, "써요.")
    .replace(/됩니다\./g, "돼요.")
    .replace(/보입니다\./g, "보여요.")
    .replace(/맞습니다\./g, "맞아요.")
    .replace(/갑니다\./g, "가요.")
    .replace(/옵니다\./g, "와요.")
    .replace(/삽니다\./g, "사요.")
    .replace(/합니다\./g, "해요.")
    .replace(/마십니다\./g, "마셔요.")
    .replace(/읽습니다\./g, "읽어요.")
    .replace(/만납니다\./g, "만나요.")
    .replace(/나옵니다\./g, "나와요.")
    .replace(/익힙니다\./g, "익혀요.")
    .replace(/배웁니다\./g, "배워요.")
    .replace(/좋아합니다\./g, "좋아해요.")
    .replace(/그쳤습니다\./g, "그쳤어요.")
    .replace(/피했습니다\./g, "피했어요.")
    .replace(/생각합니다\./g, "생각해요.")
    .replace(/말합니다\./g, "말해요.")
    .replace(/묻습니다\./g, "묻고 있어요.");
}

function softenExplanationCopy(value) {
  return softenVisibleKoreanCopy(value);
}

function getQuizDisplayWord(item) {
  return normalizeQuizDisplay(item.pron || item.showEntry || item.show_entry || item.entry);
}

function getQuizReading(item) {
  return normalizeQuizText(item.entry || item.showEntry || item.show_entry).replace(/-/g, "");
}

function getQuizMeaning(item) {
  if (!Array.isArray(item.means)) {
    return "";
  }

  return normalizeQuizText(item.means.find((value) => normalizeQuizText(value)) || "");
}

function getQuizPart(item) {
  if (!Array.isArray(item.parts)) {
    return "";
  }

  return normalizeQuizText(item.parts[0] || "");
}

function getQuizSessionSize(value) {
  return Number(value) === 10 ? 10 : 20;
}

function getQuizMode(value = state?.quizMode) {
  return value === "reading" ? "reading" : "meaning";
}

function getVocabQuizMode(value = state?.vocabQuizMode) {
  return value === "word" ? "word" : "meaning";
}

function getVocabQuizField(value, fallback = "reading") {
  return vocabQuizFieldOptions.includes(value) ? value : fallback;
}

function getLegacyVocabQuizQuestionField(mode = state?.vocabQuizMode) {
  return getVocabQuizMode(mode) === "word" ? "meaning" : "reading";
}

function getLegacyVocabQuizOptionField(mode = state?.vocabQuizMode) {
  return getVocabQuizMode(mode) === "word" ? "word" : "meaning";
}

function getDefaultVocabQuizOptionField(questionField) {
  return getVocabQuizField(questionField) === "meaning" ? "word" : "meaning";
}

function getDefaultVocabQuizQuestionField(optionField) {
  return getVocabQuizField(optionField) === "meaning" ? "reading" : "meaning";
}

function getVocabQuizQuestionField(value = state?.vocabQuizQuestionField, legacyMode = state?.vocabQuizMode) {
  return getVocabQuizField(value, getLegacyVocabQuizQuestionField(legacyMode));
}

function getVocabQuizOptionField(
  value = state?.vocabQuizOptionField,
  questionField = getVocabQuizQuestionField(),
  legacyMode = state?.vocabQuizMode
) {
  const normalizedQuestionField = getVocabQuizQuestionField(questionField, legacyMode);
  let nextField = getVocabQuizField(value, getLegacyVocabQuizOptionField(legacyMode));

  if (nextField === normalizedQuestionField) {
    nextField = getDefaultVocabQuizOptionField(normalizedQuestionField);
  }

  if (nextField === normalizedQuestionField) {
    nextField = vocabQuizFieldOptions.find((field) => field !== normalizedQuestionField) || "meaning";
  }

  return nextField;
}

function getVocabQuizFieldLabel(field) {
  return vocabQuizFieldLabels[getVocabQuizField(field)];
}

function getLevelLabel(level) {
  return formatStudyLevelLabel(level, "N5");
}

function getLevelSummaryLabel(level) {
  return level === allLevelValue ? "전체 난이도" : getLevelLabel(level);
}

function getDurationLabel(duration) {
  return Number(duration) <= 0 ? "천천히" : `${Number(duration)}초`;
}

function getQuizLevel(level = state?.quizLevel) {
  const normalizedLevel = normalizeStudyLevelValue(level, "N5");
  return selectableStudyLevels.includes(normalizedLevel) ? normalizedLevel : "N5";
}

function getQuizLevelLabel(level = state?.quizLevel) {
  return getLevelLabel(getQuizLevel(level));
}

function getQuizDuration(value = state?.quizDuration) {
  const numericValue = Number(value);
  return quizDurationOptions.includes(numericValue) ? numericValue : 15;
}

function getVocabQuizCount(value = state?.vocabQuizCount) {
  const numericValue = Number(value);
  return vocabQuizCountOptions.includes(numericValue) ? numericValue : 10;
}

function getStarterKanjiQuizCount(value = state?.starterKanjiQuizCount) {
  const numericValue = Number(value);
  return starterKanjiQuizCountOptions.includes(numericValue) ? numericValue : 10;
}

function getVocabQuizDuration(value = state?.vocabQuizDuration) {
  const numericValue = Number(value);
  return quizDurationOptions.includes(numericValue) ? numericValue : 15;
}

function getStarterKanjiQuizDuration(value = state?.starterKanjiQuizDuration) {
  const numericValue = Number(value);
  return quizDurationOptions.includes(numericValue) ? numericValue : 15;
}

function getGrammarPracticeCount(value = state?.grammarPracticeCount) {
  const numericValue = Number(value);
  return grammarPracticeCountOptions.includes(numericValue) ? numericValue : 10;
}

function getReadingCount(value = state?.readingCount) {
  const numericValue = Number(value);
  return readingCountOptions.includes(numericValue) ? numericValue : 10;
}

function getGrammarPracticeLevel(level = state?.grammarPracticeLevel) {
  const normalizedLevel = normalizeStudyLevelValue(level, "N5");
  return selectablePracticeLevels.includes(normalizedLevel) ? normalizedLevel : "N5";
}

function getGrammarPracticeDuration(value = state?.grammarPracticeDuration) {
  const numericValue = Number(value);
  return grammarPracticeDurationOptions.includes(numericValue) ? numericValue : 25;
}

function getReadingLevel(level = state?.readingLevel) {
  const normalizedLevel = normalizeStudyLevelValue(level, "N5");
  return selectablePracticeLevels.includes(normalizedLevel) ? normalizedLevel : "N5";
}

function getReadingDuration(value = state?.readingDuration) {
  const numericValue = Number(value);
  return readingDurationOptions.includes(numericValue) ? numericValue : 45;
}

function getCharactersTab(value) {
  return ["library", "quiz", "writing"].includes(value) ? value : "library";
}

function getCharactersLibraryTab(value) {
  return value === "katakana" ? "katakana" : "hiragana";
}

function getGrammarTab(value) {
  return value === "practice" ? "practice" : "list";
}

function getVocabTab(value = state?.vocabTab) {
  return ["study", "quiz", "match"].includes(value) ? value : "study";
}

function getKanjiTab(value = state?.kanjiTab) {
  return ["list", "practice", "match"].includes(value) ? value : "list";
}

function getWritingPracticeOrder(value) {
  return value === "random" ? "random" : "sequence";
}

function shuffleQuizArray(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function uniqueQuizValues(values) {
  return values.filter((value, index, source) => source.indexOf(value) === index);
}

function buildDynamicQuizPool(items) {
  const normalizedItems = items
    .map((item) => ({
      id: normalizeQuizText(item.entry_id || item.id),
      level: formatStudyLevelLabel(item._level || item.level, "N5"),
      word: getQuizDisplayWord(item),
      reading: getQuizReading(item),
      meaning: getQuizMeaning(item),
      part: getQuizPart(item)
    }))
    .filter((item) => item.id && item.word && item.reading && item.meaning);

  return normalizedItems.filter(
    (item, index, source) =>
      source.findIndex(
        (candidate) =>
          candidate.word === item.word &&
          candidate.reading === item.reading &&
          candidate.meaning === item.meaning
      ) === index
  );
}

let dynamicQuizPool = buildDynamicQuizPool(dynamicQuizSource);

function getFallbackVocabItems(level = "N5") {
  const normalizedLevel = getVocabLevel(level);

  if (normalizedLevel === allLevelValue) {
    const mixedLevelItems = fallbackFlashcards.filter((item) => contentLevels.includes(item.level));
    return mixedLevelItems.length ? mixedLevelItems : fallbackFlashcards.filter((item) => item.level === "N5");
  }

  const fallbackItems = fallbackFlashcards.filter((item) => item.level === normalizedLevel);

  return fallbackItems.length ? fallbackItems : fallbackFlashcards.filter((item) => item.level === "N5");
}

function buildDynamicFlashcardPool(items, level = "N5") {
  const normalizedLevel = getVocabLevel(level);
  const cards = items
    .map((item) => ({
      id: item.id,
      level: formatStudyLevelLabel(item.level, normalizedLevel),
      word: item.word,
      reading: item.reading,
      meaning: item.meaning,
      part: item.part || ""
    }))
    .filter((item) => item.id && item.word && item.reading && item.meaning);

  return cards.length ? shuffleQuizArray(cards) : shuffleQuizArray(getFallbackVocabItems(normalizedLevel));
}

function buildDynamicVocabListPool(items, level = "N5") {
  const normalizedLevel = getVocabLevel(level);
  const cards = items
    .map((item) => ({
      id: item.id,
      level: formatStudyLevelLabel(item.level, normalizedLevel),
      word: item.word,
      reading: item.reading,
      meaning: item.meaning,
      part: item.part || ""
    }))
    .filter((item) => item.id && item.word && item.reading && item.meaning);

  return cards.length ? cards : getFallbackVocabItems(normalizedLevel);
}

function getVocabQuizItemValue(item, field) {
  const normalizedField = getVocabQuizField(field);

  if (normalizedField === "meaning") {
    return normalizeQuizText(item.meaning);
  }

  if (normalizedField === "word") {
    return normalizeQuizDisplay(item.word || item.reading);
  }

  return normalizeQuizText(item.reading || item.word);
}

function getVocabQuizDisplaySub(item, questionField, optionField) {
  const normalizedQuestionField = getVocabQuizField(questionField);
  const reading = getVocabQuizItemValue(item, "reading");

  if (normalizedQuestionField === "meaning") {
    return item.part || "";
  }

  if (normalizedQuestionField === "word" && reading !== getVocabQuizItemValue(item, "word")) {
    return reading;
  }

  return "";
}

function getVocabQuizExplanation(item) {
  const word = getVocabQuizItemValue(item, "word");
  const reading = getVocabQuizItemValue(item, "reading");
  const meaning = getVocabQuizItemValue(item, "meaning");

  if (word && word !== reading) {
    return `${reading}는 ${word}, 뜻은 ${meaning}예요.`;
  }

  return `${reading}의 뜻은 ${meaning}예요.`;
}

function buildWordPracticeQuestionSet(items, level = "N5", fallbackItems = [], config = {}) {
  const tones = ["tone-coral", "tone-mint", "tone-gold", "tone-sky"];
  const levelLabel = getLevelLabel(level);
  const questionField = getVocabQuizQuestionField(config.questionField, config.mode);
  const optionField = getVocabQuizOptionField(config.optionField, questionField, config.mode);
  const count = Math.max(1, Number(config.count) || vocabQuizSessionSize);
  const seedItems = shuffleQuizArray(items);
  const questions = [];

  for (let index = 0; index < seedItems.length && questions.length < count; index += 1) {
    const item = seedItems[index];
    const questionIndex = questions.length;
    const display = getVocabQuizItemValue(item, questionField);
    const displaySub = getVocabQuizDisplaySub(item, questionField, optionField);
    const correctOption = getVocabQuizItemValue(item, optionField);
    const distractors = uniqueQuizValues(
      shuffleQuizArray(
        items
          .filter((candidate) => candidate.id !== item.id)
          .map((candidate) => getVocabQuizItemValue(candidate, optionField))
          .filter((value) => value && value !== correctOption)
      )
    ).slice(0, 3);

    if (!display || !correctOption || distractors.length < 3) {
      continue;
    }

    const options = shuffleQuizArray([correctOption, ...distractors]);
    const answer = options.indexOf(correctOption);
    const questionLabel = getVocabQuizFieldLabel(questionField);
    const optionLabel = getVocabQuizFieldLabel(optionField);
    const title = item.part ? `${item.part} ${optionLabel} 퀴즈` : `${levelLabel} ${optionLabel} 퀴즈`;
    const note = `${questionLabel}를 보고 ${optionLabel}를 골라봐요.`;
    const prompt = `이 ${questionLabel}에 맞는 ${optionLabel}, 어떤 걸까요?`;
    const explanation = getVocabQuizExplanation(item);

    questions.push({
      id: `bp-dw-${questionField}-${optionField}-${item.id}-${questionIndex}`,
      source: `${levelLabel} 단어 ${questionIndex + 1}`,
      level: item.level || levelLabel,
      title,
      note,
      prompt,
      display,
      displaySub,
      options,
      answer,
      explanation,
      sourceId: item.id,
      questionField,
      optionField,
      word: item.word,
      reading: item.reading,
      meaning: item.meaning,
      tone: tones[questionIndex % tones.length]
    });
  }

  return questions.length ? questions : fallbackItems;
}

function buildDynamicWordPracticeItems(items, level = "N5") {
  return buildWordPracticeQuestionSet(items, level, basicPracticeSets.words.items);
}

function getVocabLevel(level = state?.vocabLevel) {
  const normalizedLevel = normalizeStudyLevelValue(level, "N5");
  return selectableStudyLevels.includes(normalizedLevel) ? normalizedLevel : "N5";
}

function getVocabLevelLabel(level = state?.vocabLevel) {
  return getLevelLabel(getVocabLevel(level));
}

function refreshDynamicVocabContent(level = "N5") {
  const activeLevel = getVocabLevel(level);
  const activeSource = getDynamicVocabSource(activeLevel);
  const activePool = buildDynamicQuizPool(activeSource);
  basicPracticeSets.words.items = buildDynamicWordPracticeItems(activePool, activeLevel);
}

function refreshQuizContent(level = "N5") {
  const activeLevel = getQuizLevel(level);
  dynamicQuizSource = getDynamicVocabSource(activeLevel);
  dynamicQuizPool = buildDynamicQuizPool(dynamicQuizSource);
}

function refreshVocabPageContent(level = "N5") {
  const activeLevel = getVocabLevel(level);
  const activeVocabSource = getDynamicVocabSource(activeLevel);
  const activeVocabPool = buildDynamicQuizPool(activeVocabSource);

  flashcards = buildDynamicFlashcardPool(activeVocabPool, activeLevel);
  vocabListItems = buildDynamicVocabListPool(activeVocabPool, activeLevel);
}

const kanaBlueprintGroups = [
  {
    title: "기본음",
    items: [
      { reading: "a", hiragana: "あ" },
      { reading: "i", hiragana: "い" },
      { reading: "u", hiragana: "う" },
      { reading: "e", hiragana: "え" },
      { reading: "o", hiragana: "お" },
      { reading: "ka", hiragana: "か" },
      { reading: "ki", hiragana: "き" },
      { reading: "ku", hiragana: "く" },
      { reading: "ke", hiragana: "け" },
      { reading: "ko", hiragana: "こ" },
      { reading: "sa", hiragana: "さ" },
      { reading: "shi", hiragana: "し" },
      { reading: "su", hiragana: "す" },
      { reading: "se", hiragana: "せ" },
      { reading: "so", hiragana: "そ" },
      { reading: "ta", hiragana: "た" },
      { reading: "chi", hiragana: "ち" },
      { reading: "tsu", hiragana: "つ" },
      { reading: "te", hiragana: "て" },
      { reading: "to", hiragana: "と" },
      { reading: "na", hiragana: "な" },
      { reading: "ni", hiragana: "に" },
      { reading: "nu", hiragana: "ぬ" },
      { reading: "ne", hiragana: "ね" },
      { reading: "no", hiragana: "の" },
      { reading: "ha", hiragana: "は" },
      { reading: "hi", hiragana: "ひ" },
      { reading: "fu", hiragana: "ふ" },
      { reading: "he", hiragana: "へ" },
      { reading: "ho", hiragana: "ほ" },
      { reading: "ma", hiragana: "ま" },
      { reading: "mi", hiragana: "み" },
      { reading: "mu", hiragana: "む" },
      { reading: "me", hiragana: "め" },
      { reading: "mo", hiragana: "も" },
      { reading: "ya", hiragana: "や" },
      { reading: "yu", hiragana: "ゆ" },
      { reading: "yo", hiragana: "よ" },
      { reading: "ra", hiragana: "ら" },
      { reading: "ri", hiragana: "り" },
      { reading: "ru", hiragana: "る" },
      { reading: "re", hiragana: "れ" },
      { reading: "ro", hiragana: "ろ" },
      { reading: "wa", hiragana: "わ" },
      { reading: "wo", hiragana: "を" },
      { reading: "n", hiragana: "ん" }
    ]
  },
  {
    title: "탁음 / 반탁음",
    items: [
      { reading: "ga", hiragana: "が" },
      { reading: "gi", hiragana: "ぎ" },
      { reading: "gu", hiragana: "ぐ" },
      { reading: "ge", hiragana: "げ" },
      { reading: "go", hiragana: "ご" },
      { reading: "za", hiragana: "ざ" },
      { reading: "ji", hiragana: "じ" },
      { reading: "zu", hiragana: "ず" },
      { reading: "ze", hiragana: "ぜ" },
      { reading: "zo", hiragana: "ぞ" },
      { reading: "da", hiragana: "だ" },
      { reading: "ji", hiragana: "ぢ" },
      { reading: "zu", hiragana: "づ" },
      { reading: "de", hiragana: "で" },
      { reading: "do", hiragana: "ど" },
      { reading: "ba", hiragana: "ば" },
      { reading: "bi", hiragana: "び" },
      { reading: "bu", hiragana: "ぶ" },
      { reading: "be", hiragana: "べ" },
      { reading: "bo", hiragana: "ぼ" },
      { reading: "pa", hiragana: "ぱ" },
      { reading: "pi", hiragana: "ぴ" },
      { reading: "pu", hiragana: "ぷ" },
      { reading: "pe", hiragana: "ぺ" },
      { reading: "po", hiragana: "ぽ" }
    ]
  },
  {
    title: "요음",
    items: [
      { reading: "kya", hiragana: "きゃ" },
      { reading: "kyu", hiragana: "きゅ" },
      { reading: "kyo", hiragana: "きょ" },
      { reading: "sha", hiragana: "しゃ" },
      { reading: "shu", hiragana: "しゅ" },
      { reading: "sho", hiragana: "しょ" },
      { reading: "cha", hiragana: "ちゃ" },
      { reading: "chu", hiragana: "ちゅ" },
      { reading: "cho", hiragana: "ちょ" },
      { reading: "nya", hiragana: "にゃ" },
      { reading: "nyu", hiragana: "にゅ" },
      { reading: "nyo", hiragana: "にょ" },
      { reading: "hya", hiragana: "ひゃ" },
      { reading: "hyu", hiragana: "ひゅ" },
      { reading: "hyo", hiragana: "ひょ" },
      { reading: "mya", hiragana: "みゃ" },
      { reading: "myu", hiragana: "みゅ" },
      { reading: "myo", hiragana: "みょ" },
      { reading: "rya", hiragana: "りゃ" },
      { reading: "ryu", hiragana: "りゅ" },
      { reading: "ryo", hiragana: "りょ" },
      { reading: "gya", hiragana: "ぎゃ" },
      { reading: "gyu", hiragana: "ぎゅ" },
      { reading: "gyo", hiragana: "ぎょ" },
      { reading: "ja", hiragana: "じゃ" },
      { reading: "ju", hiragana: "じゅ" },
      { reading: "jo", hiragana: "じょ" },
      { reading: "bya", hiragana: "びゃ" },
      { reading: "byu", hiragana: "びゅ" },
      { reading: "byo", hiragana: "びょ" },
      { reading: "pya", hiragana: "ぴゃ" },
      { reading: "pyu", hiragana: "ぴゅ" },
      { reading: "pyo", hiragana: "ぴょ" }
    ]
  },
  {
    title: "소문자 / 기타",
    items: [
      { reading: "xa", hiragana: "ぁ", quiz: false },
      { reading: "xi", hiragana: "ぃ", quiz: false },
      { reading: "xu", hiragana: "ぅ", quiz: false },
      { reading: "xe", hiragana: "ぇ", quiz: false },
      { reading: "xo", hiragana: "ぉ", quiz: false },
      { reading: "xtu", hiragana: "っ", quiz: false },
      { reading: "xya", hiragana: "ゃ", quiz: false },
      { reading: "xyu", hiragana: "ゅ", quiz: false },
      { reading: "xyo", hiragana: "ょ", quiz: false },
      { reading: "xwa", hiragana: "ゎ", quiz: false },
      { reading: "vu", hiragana: "ゔ" },
      { reading: "wi", hiragana: "ゐ", quiz: false },
      { reading: "we", hiragana: "ゑ", quiz: false },
      { reading: "la", hiragana: "ゕ", quiz: false },
      { reading: "le", hiragana: "ゖ", quiz: false }
    ]
  }
];

function convertHiraganaToKatakana(text) {
  return Array.from(text)
    .map((character) => String.fromCodePoint(character.codePointAt(0) + 0x60))
    .join("");
}

function buildKanaDeck(script) {
  const isKatakana = script === "katakana";
  return kanaBlueprintGroups.map((group) => ({
    title: group.title,
    items: group.items.map((item) => ({
      reading: item.reading,
      char: isKatakana ? convertHiraganaToKatakana(item.hiragana) : item.hiragana,
      quiz: item.quiz !== false,
      group: group.title
    }))
  }));
}

function buildKanaPracticeItems(script) {
  const deck = kanaStudyDecks[script] || [];
  const quizItems = deck.flatMap((group) => group.items.filter((item) => item.quiz !== false));

  return quizItems
    .map((item, index) => {
      const distractors = uniqueQuizValues(
        shuffleQuizArray(
          quizItems
            .filter((candidate) => candidate.char !== item.char)
            .map((candidate) => candidate.reading)
        )
      ).slice(0, 3);

      if (distractors.length < 3) {
        return null;
      }

      const options = shuffleQuizArray([item.reading, ...distractors]);
      const answer = options.indexOf(item.reading);

      return {
        id: `bp-${script}-${index}`,
        source: `${script === "hiragana" ? "히라가나" : "카타카나"} ${index + 1}`,
        title: `${script === "hiragana" ? "히라가나" : "카타카나"} 읽기`,
        note: "방금 표에서 본 글자들이에요.",
        prompt: "이 글자, 어떻게 읽을까요?",
        display: item.char,
        displaySub: item.reading,
        options,
        answer,
        explanation: `${item.char}는 ${item.reading}로 읽어요.`,
        tone: index % 2 === 0 ? "tone-coral" : "tone-sky"
      };
    })
    .filter(Boolean);
}

const kanaQuizSettings = {
  mode: "hiragana",
  count: 10,
  duration: 5
};
const kanaQuizCountOptions = [10, 20, 30, "all"];
const kanaQuizDurationOptions = [5, 10, 15, 0];

const kanaQuizSheetState = {
  open: false,
  mode: "hiragana",
  sessionIndex: 0,
  sessionItems: [],
  answered: false,
  finished: false,
  results: [],
  resultFilter: "all"
};

const kanaQuizResultFilterLabels = {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};

function getKanaQuizModeLabel(mode) {
  if (mode === "random") {
    return "랜덤";
  }

  return mode === "katakana" ? "카타카나" : "히라가나";
}

const vocabFilterLabels = {
  all: "전체",
  review: "다시 볼래요",
  mastered: "익혔어요",
  unmarked: "아직 안 정했어요"
};

const vocabHeadingCopy = {
  N5: {
    title: "N5 단어, 카드로 익혀봐요",
    description: ""
  },
  N4: {
    title: "N4 단어, 카드로 익혀봐요",
    description: "조금 더 넓어진 표현을 카드와 목록으로 같이 익혀봐요."
  },
  N3: {
    title: "N3 단어, 카드로 익혀봐요",
    description: "실전에서 자주 만나는 N3 단어를 천천히 쌓아봐요."
  },
  all: {
    title: "전체 단어, 한 번에 익혀봐요",
    description: "N5부터 N3까지 섞어서 카드와 목록으로 같이 훑어봐요."
  }
};

const quizHeadingCopy = {
  N5: {
    title: "N5 단어 퀴즈, 가볍게 풀어볼까요?",
    description: ""
  },
  N4: {
    title: "N4 단어 퀴즈로 감각을 올려봐요",
    description: "N4 단어를 뜻이랑 단어로 번갈아 풀어봐요."
  },
  N3: {
    title: "N3 단어 퀴즈, 실전 느낌으로 가봐요",
    description: "조금 더 긴 호흡으로 N3 어휘 감각을 확인해봐요."
  },
  all: {
    title: "전체 단어 퀴즈로 감각을 섞어봐요",
    description: "N5부터 N3까지 섞어서 문제 수와 시간에 맞춰 풀어봐요."
  }
};

const matchHeadingCopy = {
  title: "단어 짝맞추기, 바로 감각 올려봐요",
  description: "읽기와 뜻을 빠르게 묶으면서 오늘 볼 단어를 가볍게 몸에 붙여봐요."
};

function getVocabItemPart(item) {
  return normalizeQuizText(item?.part) || "기타";
}

function getKanaQuizPool(mode) {
  if (mode === "random") {
    return [
      ...(basicPracticeSets.hiragana?.items || []),
      ...(basicPracticeSets.katakana?.items || [])
    ];
  }

  return basicPracticeSets[mode]?.items || [];
}

function getKanaQuizCountValue(value, total) {
  if (value === "all") {
    return total;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(10, total);
  }

  return Math.min(parsed, total);
}

function buildKanaQuizSession(mode = kanaQuizSettings.mode) {
  const pool = getKanaQuizPool(mode);
  const count = getKanaQuizCountValue(kanaQuizSettings.count, pool.length);
  return shuffleQuizArray(pool).slice(0, count);
}

function getKanaQuizSheetCurrentItem() {
  const items = kanaQuizSheetState.sessionItems;
  const index = kanaQuizSheetState.sessionIndex;

  if (!items.length || index >= items.length) {
    return null;
  }

  return {
    mode: kanaQuizSheetState.mode,
    index,
    total: items.length,
    item: items[index]
  };
}

function getKanaQuizCountLabel(count) {
  return String(count) === "all" ? "전부" : `${count}문제`;
}

function getKanaQuizDurationLabel(duration) {
  return Number(duration) <= 0 ? "천천히" : `${duration}초`;
}

function getKanaQuizResultFilter(value = kanaQuizSheetState.resultFilter) {
  return Object.prototype.hasOwnProperty.call(kanaQuizResultFilterLabels, value) ? value : "all";
}

function getKanaQuizResultCounts() {
  return {
    all: kanaQuizSheetState.results.length,
    correct: kanaQuizSheetState.results.filter((item) => item.status === "correct").length,
    wrong: kanaQuizSheetState.results.filter((item) => item.status === "wrong").length
  };
}

function getFilteredKanaQuizResults(filter = getKanaQuizResultFilter(kanaQuizSheetState.resultFilter)) {
  const activeFilter = getKanaQuizResultFilter(filter);

  if (activeFilter === "all") {
    return [...kanaQuizSheetState.results];
  }

  return kanaQuizSheetState.results.filter((item) => item.status === activeFilter);
}

function setKanaQuizResult(current, selectedIndex, correct, timedOut = false) {
  const reading = current.item.options[current.item.answer] || current.item.displaySub || "";
  const selected = timedOut ? "" : current.item.options[selectedIndex] || "";
  const result = {
    id: current.item.id,
    source: current.item.source,
    char: current.item.display,
    reading,
    selected,
    status: correct ? "correct" : "wrong",
    timedOut
  };
  const existingIndex = kanaQuizSheetState.results.findIndex((item) => item.id === current.item.id);

  if (existingIndex >= 0) {
    kanaQuizSheetState.results[existingIndex] = result;
    return;
  }

  kanaQuizSheetState.results.push(result);
}

function renderKanaQuizResultFilterOptions(counts) {
  const filterSelect = document.getElementById("kana-quiz-result-filter");

  if (!filterSelect) {
    return;
  }

  filterSelect.innerHTML = Object.keys(kanaQuizResultFilterLabels)
    .map((filter) => `<option value="${filter}">${kanaQuizResultFilterLabels[filter]} (${counts[filter] ?? 0})</option>`)
    .join("");
  filterSelect.value = getKanaQuizResultFilter(kanaQuizSheetState.resultFilter);
}

function renderKanaQuizResults() {
  const total = document.getElementById("kana-quiz-result-total");
  const correct = document.getElementById("kana-quiz-result-correct-count");
  const wrong = document.getElementById("kana-quiz-result-wrong-count");
  const empty = document.getElementById("kana-quiz-result-empty");
  const list = document.getElementById("kana-quiz-result-list");
  const counts = getKanaQuizResultCounts();
  const filteredResults = getFilteredKanaQuizResults();

  if (!total || !correct || !wrong || !empty || !list) {
    return;
  }

  total.textContent = String(counts.all);
  correct.textContent = String(counts.correct);
  wrong.textContent = String(counts.wrong);
  renderKanaQuizResultFilterOptions(counts);

  if (!filteredResults.length) {
    empty.hidden = false;
    empty.textContent = `${kanaQuizResultFilterLabels[getKanaQuizResultFilter(kanaQuizSheetState.resultFilter)]} 결과는 아직 없어요.`;
    list.innerHTML = "";
    return;
  }

  empty.hidden = true;
  list.innerHTML = filteredResults
    .map((item) => {
      const statusLabel = item.timedOut ? "시간초과" : item.status === "correct" ? "정답" : "오답";
      const detail =
        item.status === "correct"
          ? `정답: ${formatQuizLineBreaks(item.reading)}`
          : `선택: ${formatQuizLineBreaks(item.selected || "미응답")} · 정답: ${formatQuizLineBreaks(item.reading)}`;

      return `
        <article class="match-result-item is-${item.status}">
          <div class="match-result-item-head">
            <div class="match-result-item-badges">
              <span class="match-result-badge is-${item.status}">${statusLabel}</span>
              <span class="match-result-level">${formatQuizLineBreaks(item.source || getKanaQuizModeLabel(kanaQuizSheetState.mode))}</span>
            </div>
          </div>
          <div class="match-result-item-main">
            <strong>${formatQuizLineBreaks(item.char)} · ${formatQuizLineBreaks(item.reading)}</strong>
            <p>${detail}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderKanaQuizSetup() {
  const setupShell = document.getElementById("kana-setup-shell");
  const setupToggle = document.getElementById("kana-setup-toggle");
  const setupPanel = document.getElementById("kana-setup-panel");
  const setupSummary = document.getElementById("kana-setup-summary");
  const countSpinner = document.querySelector('[data-spinner-id="kana-quiz-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="kana-quiz-time"]');
  const isOpen = state.kanaSetupOpen === true;
  const modeButtons = document.querySelectorAll("[data-kana-mode]");
  const isSettingsLocked = kanaQuizSheetState.open && !kanaQuizSheetState.finished;
  const summaryText = [
    getKanaQuizModeLabel(kanaQuizSettings.mode),
    getKanaQuizCountLabel(kanaQuizSettings.count),
    getKanaQuizDurationLabel(kanaQuizSettings.duration)
  ].join(" · ");

  renderCollapsibleSettingsSection({
    shell: setupShell,
    toggle: setupToggle,
    panel: setupPanel,
    summary: setupSummary,
    summaryText,
    isLocked: isSettingsLocked,
    shouldShowPanel: !isSettingsLocked && isOpen
  });
  syncSelectionButtonState(modeButtons, (button) => button.dataset.kanaMode, kanaQuizSettings.mode);
  modeButtons.forEach((button) => {
    button.disabled = isSettingsLocked;
  });
  renderSpinnerControls([
    {
      spinner: countSpinner,
      options: kanaQuizCountOptions,
      activeValue: kanaQuizSettings.count,
      formatValue: getKanaQuizCountLabel,
      disabled: isSettingsLocked
    },
    {
      spinner: timeSpinner,
      options: kanaQuizDurationOptions,
      activeValue: kanaQuizSettings.duration,
      formatValue: getKanaQuizDurationLabel,
      disabled: isSettingsLocked
    }
  ]);
}

function startKanaQuizSession(mode = kanaQuizSettings.mode) {
  const nextMode = ["hiragana", "katakana", "random"].includes(mode) ? mode : "hiragana";
  kanaQuizSettings.mode = nextMode;
  kanaQuizSheetState.mode = nextMode;
  kanaQuizSheetState.sessionItems = buildKanaQuizSession(nextMode);
  kanaQuizSheetState.sessionIndex = 0;
  kanaQuizSheetState.answered = false;
  kanaQuizSheetState.finished = false;
  kanaQuizSheetState.open = true;
  kanaQuizSheetState.results = [];
  kanaQuizSheetState.resultFilter = "all";

  quizSessions.kana.duration = Number(kanaQuizSettings.duration);
  quizSessions.kana.timeLeft = Number(kanaQuizSettings.duration);
  quizSessions.kana.correct = 0;
  quizSessions.kana.streak = 0;

  renderKanaQuizSetup();
  renderQuizSessionHud("kana");
  renderKanaQuizSheet();
  resetQuizSessionTimer("kana", handleKanaQuizTimeout);
}

function openKanaQuizSheet(mode) {
  state.charactersTab = "quiz";
  saveState();
  renderCharactersPageLayout();
  startKanaQuizSession(mode);

  const quizPanel = document.getElementById("characters-tab-panel-quiz");
  if (quizPanel) {
    quizPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function closeKanaQuizSheet() {
  kanaQuizSheetState.open = false;
  stopQuizSessionTimer("kana");
  renderKanaQuizSheet();
}

function renderKanaQuizSheet() {
  const practiceView = document.getElementById("kana-quiz-practice-view");
  const card = document.getElementById("kana-quiz-card");
  const empty = document.getElementById("kana-quiz-empty");
  const resultView = document.getElementById("kana-quiz-result-view");
  const label = document.getElementById("kana-quiz-sheet-label");
  const title = document.getElementById("kana-quiz-sheet-title");
  const desc = document.getElementById("kana-quiz-sheet-desc");
  const source = document.getElementById("kana-quiz-sheet-source");
  const progress = document.getElementById("kana-quiz-sheet-progress");
  const promptBox = document.getElementById("kana-quiz-sheet-copy");
  const note = document.getElementById("kana-quiz-sheet-note");
  const prompt = document.getElementById("kana-quiz-sheet-prompt");
  const display = document.getElementById("kana-quiz-sheet-display");
  const displaySub = document.getElementById("kana-quiz-sheet-display-sub");
  const options = document.getElementById("kana-quiz-options");
  const feedback = document.getElementById("kana-quiz-feedback");
  const explanation = document.getElementById("kana-quiz-explanation");
  const next = document.getElementById("kana-quiz-next");

  if (!practiceView || !card || !empty || !resultView || !label || !title || !desc || !source || !progress || !promptBox || !note || !prompt || !display || !displaySub || !options || !feedback || !explanation || !next) {
    return;
  }

  const current = getKanaQuizSheetCurrentItem();

  empty.hidden = kanaQuizSheetState.open;
  practiceView.hidden = !kanaQuizSheetState.open || kanaQuizSheetState.finished;
  practiceView.setAttribute("aria-hidden", String(practiceView.hidden));
  card.hidden = !kanaQuizSheetState.open || kanaQuizSheetState.finished;
  resultView.hidden = !kanaQuizSheetState.open || !kanaQuizSheetState.finished;
  resultView.setAttribute("aria-hidden", String(resultView.hidden));

  if (!kanaQuizSheetState.open) {
    feedback.textContent = "";
    explanation.textContent = "";
    explanation.hidden = true;
    return;
  }

  if (kanaQuizSheetState.finished) {
    renderKanaQuizResults();
    return;
  }

  if (!current) {
    label.textContent = "KANA QUIZ";
    title.textContent = "문자 퀴즈, 풀어볼까요?";
    desc.textContent = "퀴즈를 아직 불러오지 못했어요.";
    source.textContent = "-";
    progress.textContent = "-";
    promptBox.hidden = true;
    note.hidden = true;
    note.textContent = "";
    prompt.textContent = "";
    display.textContent = "-";
    displaySub.textContent = "";
    options.innerHTML = "";
    options.hidden = false;
    feedback.textContent = "";
    explanation.textContent = "";
    explanation.hidden = true;
    next.disabled = true;
    return;
  }

  const modeLabel = getKanaQuizModeLabel(kanaQuizSheetState.mode);
  label.textContent = `${modeLabel.toUpperCase()} QUIZ`;
  title.textContent = `${modeLabel} 퀴즈, 풀어볼까요?`;
  desc.textContent = "문자를 보고 읽기를 골라봐요.";
  source.textContent = formatQuizLineBreaks(current.item.source);
  progress.textContent = `${current.index + 1} / ${current.total}`;
  promptBox.hidden = true;
  note.hidden = true;
  note.textContent = "";
  prompt.textContent = "";
  display.textContent = formatQuizLineBreaks(current.item.display || "-");
  displaySub.textContent = "";
  feedback.textContent = "";
  explanation.textContent = "";
  explanation.hidden = true;
  options.hidden = false;
  next.disabled = true;
  next.textContent =
    current.index + 1 >= current.total ? "결과 보러 갈까요?" : "다음 문제 볼까요?";

  options.innerHTML = "";
  current.item.options.forEach((option, optionIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "basic-practice-option kana-quiz-option";
    button.dataset.kanaQuizOption = String(optionIndex);
    button.textContent = formatQuizLineBreaks(option);
    button.addEventListener("click", () => handleKanaQuizSheetAnswer(optionIndex));
    options.appendChild(button);
  });
}

function finalizeKanaQuizAnswer(correct) {
  kanaQuizSheetState.answered = true;
  finalizeQuizSession("kana", correct);

  const next = document.getElementById("kana-quiz-next");
  if (next) {
    next.disabled = false;
    next.focus();
  }
}

function handleKanaQuizSheetAnswer(index) {
  const current = getKanaQuizSheetCurrentItem();
  if (!current || kanaQuizSheetState.answered) {
    return;
  }

  const optionButtons = document.querySelectorAll("[data-kana-quiz-option]");
  const correct = index === current.item.answer;

  optionButtons.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === current.item.answer) {
      item.classList.add("is-correct");
    }
    if (optionIndex === index && !correct) {
      item.classList.add("is-wrong");
    }
  });

  const feedback = document.getElementById("kana-quiz-feedback");
  const explanation = document.getElementById("kana-quiz-explanation");
  if (feedback) {
    feedback.textContent = "";
  }
  if (explanation) {
    explanation.textContent = "";
    explanation.hidden = true;
  }

  setKanaQuizResult(current, index, correct);
  finalizeKanaQuizAnswer(correct);
}

function handleKanaQuizTimeout() {
  const current = getKanaQuizSheetCurrentItem();
  if (!current || kanaQuizSheetState.answered) {
    return;
  }

  const optionButtons = document.querySelectorAll("[data-kana-quiz-option]");
  optionButtons.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === current.item.answer) {
      item.classList.add("is-correct");
    }
  });

  const feedback = document.getElementById("kana-quiz-feedback");
  const explanation = document.getElementById("kana-quiz-explanation");
  if (feedback) {
    feedback.textContent = "";
  }
  if (explanation) {
    explanation.textContent = "";
    explanation.hidden = true;
  }

  setKanaQuizResult(current, -1, false, true);
  finalizeKanaQuizAnswer(false);
}

function nextKanaQuizSheetQuestion() {
  const current = getKanaQuizSheetCurrentItem();

  if (kanaQuizSheetState.finished || !current) {
    startKanaQuizSession(kanaQuizSettings.mode);
    return;
  }

  if (!kanaQuizSheetState.answered) {
    const feedback = document.getElementById("kana-quiz-feedback");
    if (feedback) {
      feedback.textContent = "답을 고르면 다음으로 넘어가요.";
    }
    return;
  }

  if (current.index + 1 >= current.total) {
    kanaQuizSheetState.finished = true;
    renderKanaQuizSheet();
    return;
  }

  kanaQuizSheetState.sessionIndex += 1;
  kanaQuizSheetState.answered = false;
  renderKanaQuizSheet();
  resetQuizSessionTimer("kana", handleKanaQuizTimeout);
}

const kanaStudyDecks = {
  hiragana: buildKanaDeck("hiragana"),
  katakana: buildKanaDeck("katakana")
};

basicPracticeSets.hiragana = {
  label: "히라가나",
  heading: "히라가나 한눈에 보기",
  items: buildKanaPracticeItems("hiragana")
};

basicPracticeSets.katakana = {
  label: "카타카나",
  heading: "카타카나 한눈에 보기",
  items: buildKanaPracticeItems("katakana")
};

delete basicPracticeSets.kana;

basicPracticeSets.hiragana.label = "히라가나";
basicPracticeSets.hiragana.heading = "히라가나 한눈에 보기";
basicPracticeSets.katakana.label = "카타카나";
basicPracticeSets.katakana.heading = "카타카나 한눈에 보기";

const dynamicKanjiItems = buildKanjiPracticeItemsFromData();
if (dynamicKanjiItems.length) {
  basicPracticeSets.kanji = {
    label: "한자",
    heading: "학년별 배당 한자",
    items: dynamicKanjiItems
  };
}

const basicPracticeTrackOrder = ["hiragana", "katakana", "words", "particles", "kanji", "sentences"];
const basicPracticeTrackLabels = {
  hiragana: "히라가나",
  katakana: "카타카나",
  words: "단어",
  particles: "문법",
  kanji: "한자",
  sentences: "독해"
};

function getAvailableBasicPracticeTracks() {
  const switcher = document.getElementById("basic-practice-switcher");
  const configured = switcher?.dataset?.basicTracks;

  if (!configured) {
    return basicPracticeTrackOrder.filter((key) => basicPracticeSets[key]);
  }

  const tracks = configured
    .split(",")
    .map((item) => item.trim())
    .filter((key) => key && basicPracticeSets[key]);

  return tracks.length ? tracks : basicPracticeTrackOrder.filter((key) => basicPracticeSets[key]);
}
function renderKanaLibrary() {
  const sections = [
    {
      targetId: "hiragana-table",
      track: "hiragana",
      title: "히라가나 한눈에 보기",
      description: "기본음부터 요음까지 한 번에 쭉 살펴봐요."
    },
    {
      targetId: "katakana-table",
      track: "katakana",
      title: "카타카나 한눈에 보기",
      description: "자주 보는 카타카나를 한눈에 익혀봐요."
    }
  ];

  sections.forEach((section) => {
    const container = document.getElementById(section.targetId);
    if (!container) {
      return;
    }

    const deck = kanaStudyDecks[section.track] || [];
    container.innerHTML = deck
      .map(
        (group) => `
          <section class="kana-group">
            <h4>${group.title}</h4>
            <div class="kana-grid">
              ${group.items
                .map(
                  (item) => `
                    <button class="kana-tile${item.quiz ? "" : " is-muted"}" type="button" data-writing-char="${item.char}" data-writing-script="${section.track}" aria-label="${item.char} 따라쓰기 바로 열기">
                      <strong>${item.char}</strong>
                      <span>${item.reading}</span>
                    </button>
                  `
                )
                .join("")}
            </div>
          </section>
        `
      )
      .join("");
  });

  document.querySelectorAll("[data-kana-track]").forEach((button) => {
    if (button.dataset.kanaBound === "true") {
      return;
    }

    button.dataset.kanaBound = "true";
    button.addEventListener("click", () => {
      const track = button.getAttribute("data-kana-track");
      if (!track || !basicPracticeSets[track]) {
        return;
      }

      openKanaQuizSheet(track);
    });
  });

  document.querySelectorAll("[data-writing-char]").forEach((button) => {
    if (button.dataset.writingBound === "true") {
      return;
    }

    button.dataset.writingBound = "true";
    button.addEventListener("click", () => {
      openWritingPracticeForCharacter(button.dataset.writingChar, button.dataset.writingScript);
    });
  });
}

function renderCharactersPageLayout() {
  const activeTab = getCharactersTab(state.charactersTab);
  const libraryTab = getCharactersLibraryTab(state.charactersLibraryTab);

  document.querySelectorAll("[data-characters-tab]").forEach((button) => {
    const isActive = button.dataset.charactersTab === activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  document.querySelectorAll("[data-characters-tab-panel]").forEach((panel) => {
    const isActive = panel.dataset.charactersTabPanel === activeTab;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", String(!isActive));
  });

  document.querySelectorAll("[data-characters-library-tab]").forEach((button) => {
    const isActive = button.dataset.charactersLibraryTab === libraryTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  document.querySelectorAll("[data-characters-library-panel]").forEach((panel) => {
    const isActive = panel.dataset.charactersLibraryPanel === libraryTab;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", String(!isActive));
  });

  if (activeTab === "writing" && document.getElementById("writing-practice-shell")) {
    scheduleWritingPracticeLayout(false);
  }
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const writingPracticeSettings = {
  mode: "hiragana",
  order: "sequence"
};

const writingPracticeSvgTemplateCache = new Map();

const writingPracticeState = {
  sessionItems: [],
  sessionIndex: 0,
  guideVisible: true,
  answerVisible: false,
  isAnimating: false,
  isTransitioning: false,
  animationToken: 0,
  layoutFrame: null,
  pointerId: null,
  isDrawing: false,
  strokes: [],
  score: null,
  feedback: "연한 글자를 따라 천천히 써봐요.",
  tip: "가이드가 잘 보이게 천천히 크게 써봐요.",
  slotEntries: [],
  targetCanvas: document.createElement("canvas"),
  overlayHasInk: false,
  overlayBounds: null,
  hasVectorGuide: false,
  renderSeed: 0,
  layoutObserver: null
};

function getWritingPracticeDefaultFeedback() {
  return "연한 글자를 따라 천천히 써봐요.";
}

function getWritingPracticeDefaultTip() {
  return "가이드가 잘 보이게 천천히 크게 써봐요.";
}

function beginWritingPracticeTransition() {
  writingPracticeState.isTransitioning = true;
}

function endWritingPracticeTransition() {
  writingPracticeState.isTransitioning = false;
}

function getWritingPracticeModeLabel(mode = writingPracticeSettings.mode) {
  if (mode === "random") {
    return "랜덤";
  }

  return mode === "katakana" ? "카타카나" : "히라가나";
}

function getWritingPracticeOrderLabel(order = writingPracticeSettings.order) {
  return getWritingPracticeOrder(order) === "random" ? "랜덤 순서" : "순서대로";
}

function renderWritingPracticeSetup() {
  const setupShell = document.getElementById("writing-setup-shell");
  const setupToggle = document.getElementById("writing-setup-toggle");
  const setupPanel = document.getElementById("writing-setup-panel");
  const setupSummary = document.getElementById("writing-setup-summary");
  const isOpen = state.writingSetupOpen === true;
  const summaryText = [
    getWritingPracticeModeLabel(writingPracticeSettings.mode),
    getWritingPracticeOrderLabel(writingPracticeSettings.order)
  ].join(" · ");

  renderOpenableSettingsSection({
    shell: setupShell,
    toggle: setupToggle,
    panel: setupPanel,
    summary: setupSummary,
    summaryText,
    isOpen
  });
}

function buildWritingPracticePool(script) {
  const label = script === "katakana" ? "카타카나" : "히라가나";
  const deck = kanaStudyDecks[script] || [];

  return deck.flatMap((group, groupIndex) =>
    group.items
      .filter((item) => item.quiz !== false)
      .map((item, itemIndex) => ({
        id: `writing-${script}-${groupIndex}-${itemIndex}`,
        script,
        group: group.title,
        char: item.char,
        reading: item.reading,
        source: `${label} · ${group.title}`
      }))
  );
}

const writingPracticePools = {
  hiragana: buildWritingPracticePool("hiragana"),
  katakana: buildWritingPracticePool("katakana")
};

function buildWritingPracticeSession(mode = writingPracticeSettings.mode, order = writingPracticeSettings.order) {
  const nextOrder = getWritingPracticeOrder(order);
  const items =
    mode === "random"
      ? [...writingPracticePools.hiragana, ...writingPracticePools.katakana]
      : [...(writingPracticePools[mode] || writingPracticePools.hiragana)];

  return nextOrder === "random" ? shuffleQuizArray(items) : items;
}

function ensureWritingPracticeSession() {
  if (!writingPracticeState.sessionItems.length) {
    writingPracticeState.sessionItems = buildWritingPracticeSession(
      writingPracticeSettings.mode,
      writingPracticeSettings.order
    );
    writingPracticeState.sessionIndex = 0;
  }
}

function getCurrentWritingPracticeItem() {
  ensureWritingPracticeSession();

  if (!writingPracticeState.sessionItems.length) {
    return null;
  }

  return writingPracticeState.sessionItems[writingPracticeState.sessionIndex] || null;
}

function cancelWritingPracticeAnimation() {
  writingPracticeState.animationToken += 1;
  writingPracticeState.isAnimating = false;
}

function resetWritingPracticeRound() {
  cancelWritingPracticeAnimation();
  writingPracticeState.pointerId = null;
  writingPracticeState.isDrawing = false;
  writingPracticeState.guideVisible = true;
  writingPracticeState.answerVisible = false;
  writingPracticeState.strokes = [];
  resetWritingOverlayCanvas();
  writingPracticeState.score = null;
  writingPracticeState.feedback = getWritingPracticeDefaultFeedback();
  writingPracticeState.tip = getWritingPracticeDefaultTip();
}

const writingPracticeCompoundFollowers = new Set(["ゃ", "ゅ", "ょ", "ャ", "ュ", "ョ"]);

function splitWritingPracticeUnits(text = "") {
  return Array.from(text).reduce((units, character) => {
    if (writingPracticeCompoundFollowers.has(character) && units.length) {
      units[units.length - 1] += character;
      return units;
    }

    units.push(character);
    return units;
  }, []);
}

function rewriteSvgReference(value, idMap) {
  if (!value) {
    return value;
  }

  if (value.startsWith("url(#") && value.endsWith(")")) {
    const id = value.slice(5, -1);
    return idMap.has(id) ? `url(#${idMap.get(id)})` : value;
  }

  if (value.startsWith("#")) {
    const id = value.slice(1);
    return idMap.has(id) ? `#${idMap.get(id)}` : value;
  }

  return value;
}

function uniquifyWritingSvgIds(svg, prefix) {
  const idMap = new Map();

  svg.querySelectorAll("[id]").forEach((element) => {
    const originalId = element.id;
    const nextId = `${prefix}-${originalId}`;
    idMap.set(originalId, nextId);
    element.id = nextId;
  });

  svg.querySelectorAll("*").forEach((element) => {
    ["clip-path", "href", "xlink:href", "mask", "filter"].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      const nextValue = rewriteSvgReference(value, idMap);

      if (nextValue !== value) {
        element.setAttribute(attribute, nextValue);
      }
    });
  });
}

function parseWritingPracticeSvg(rawSvg) {
  if (!rawSvg) {
    return null;
  }

  const cachedTemplate = writingPracticeSvgTemplateCache.get(rawSvg);

  if (cachedTemplate) {
    return cachedTemplate.cloneNode(true);
  }

  const parsed = new DOMParser().parseFromString(rawSvg.trim(), "image/svg+xml");
  const svg = parsed.documentElement;

  if (!svg || svg.nodeName.toLowerCase() !== "svg" || parsed.querySelector("parsererror")) {
    return null;
  }

  const template = document.importNode(svg, true);
  writingPracticeSvgTemplateCache.set(rawSvg, template);
  return template.cloneNode(true);
}

function getWritingSvgViewBox(svg, fallbackViewBox = { x: 0, y: 0, width: 1024, height: 1024 }) {
  const baseViewBox = {
    x: Number.isFinite(fallbackViewBox?.x) ? fallbackViewBox.x : 0,
    y: Number.isFinite(fallbackViewBox?.y) ? fallbackViewBox.y : 0,
    width: Number.isFinite(fallbackViewBox?.width) && fallbackViewBox.width > 0 ? fallbackViewBox.width : 1024,
    height: Number.isFinite(fallbackViewBox?.height) && fallbackViewBox.height > 0 ? fallbackViewBox.height : 1024
  };
  const groups = [
    svg.querySelector('g[data-strokesvg="shadows"]'),
    svg.querySelector('g[data-strokesvg="strokes"]')
  ].filter(Boolean);
  let minX = baseViewBox.x;
  let minY = baseViewBox.y;
  let maxX = baseViewBox.x + baseViewBox.width;
  let maxY = baseViewBox.y + baseViewBox.height;
  let hasMeasuredBounds = false;

  groups.forEach((group) => {
    if (!group || typeof group.getBBox !== "function") {
      return;
    }

    try {
      const box = group.getBBox();

      if (!box || (!box.width && !box.height)) {
        return;
      }

      hasMeasuredBounds = true;
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    } catch (error) {
      // Hidden or not-yet-rendered SVG nodes may fail to measure; keep the original viewBox.
    }
  });

  if (!hasMeasuredBounds) {
    return {
      viewBox: baseViewBox,
      hasMeasuredBounds
    };
  }

  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const padX = Math.max(24, contentWidth * 0.08);
  const padY = Math.max(28, contentHeight * 0.1);

  return {
    viewBox: {
      x: minX - padX,
      y: minY - padY,
      width: contentWidth + padX * 2,
      height: contentHeight + padY * 2
    },
    hasMeasuredBounds
  };
}

function applyWritingSvgViewBox(entry) {
  if (!entry?.svg || entry.viewBoxMeasured) {
    return;
  }

  const { viewBox: nextViewBox, hasMeasuredBounds } = getWritingSvgViewBox(entry.svg, entry.baseViewBox || entry.viewBox);
  entry.viewBox = nextViewBox;
  entry.viewBoxMeasured = hasMeasuredBounds;
  entry.svg.setAttribute("viewBox", `${nextViewBox.x} ${nextViewBox.y} ${nextViewBox.width} ${nextViewBox.height}`);
}

function refreshWritingPracticeViewBoxes() {
  writingPracticeState.slotEntries.forEach((entry) => {
    applyWritingSvgViewBox(entry);
  });
}

function collectWritingTargetClipMasks(svg, path) {
  const clipValue = path.getAttribute("clip-path");

  if (!clipValue || !clipValue.startsWith("url(#") || !clipValue.endsWith(")")) {
    return [];
  }

  const clipId = clipValue.slice(5, -1);
  const clipElement = svg.querySelector(`[id="${clipId}"]`);

  if (!clipElement) {
    return [];
  }

  const clipPaths = Array.from(clipElement.querySelectorAll("path"));

  clipElement.querySelectorAll("use").forEach((useElement) => {
    const href = useElement.getAttribute("href") || useElement.getAttribute("xlink:href");

    if (!href || !href.startsWith("#")) {
      return;
    }

    const referencedPath = svg.querySelector(`[id="${href.slice(1)}"]`);

    if (referencedPath instanceof SVGPathElement) {
      clipPaths.push(referencedPath);
    }
  });

  return clipPaths
    .map((clipPath) => clipPath.getAttribute("d"))
    .filter(Boolean)
    .map((pathData) => {
      try {
        return new Path2D(pathData);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function collectWritingTargetSegments(svg) {
  const strokesGroup = svg.querySelector('g[data-strokesvg="strokes"]');

  if (!strokesGroup) {
    return [];
  }

  return Array.from(strokesGroup.querySelectorAll("path"))
    .map((path) => {
      const pathData = path.getAttribute("d");

      if (!pathData) {
        return null;
      }

      try {
        return {
          pathMask: new Path2D(pathData),
          clipMasks: collectWritingTargetClipMasks(svg, path)
        };
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function getWritingTargetStrokeWidth(svg) {
  const strokesGroup = svg.querySelector('g[data-strokesvg="strokes"]');

  if (!strokesGroup) {
    return 128;
  }

  const inlineWidth = Number.parseFloat(strokesGroup.style?.strokeWidth || "");

  if (Number.isFinite(inlineWidth) && inlineWidth > 0) {
    return inlineWidth;
  }

  const attributeWidth = Number.parseFloat(strokesGroup.getAttribute("stroke-width") || "");
  return Number.isFinite(attributeWidth) && attributeWidth > 0 ? attributeWidth : 128;
}

function collectWritingStrokeEntries(svg) {
  const strokesGroup = svg.querySelector('g[data-strokesvg="strokes"]');

  if (!strokesGroup) {
    return [];
  }

  return Array.from(strokesGroup.children)
    .map((child) => {
      const paths =
        child.tagName.toLowerCase() === "path" ? [child] : Array.from(child.querySelectorAll("path"));

      if (!paths.length) {
        return null;
      }

      const measuredPaths = paths.map((path) => {
        const length = path.getTotalLength();
        path.dataset.length = String(length);
        return path;
      });

      const maxLength = Math.max(...measuredPaths.map((path) => Number(path.dataset.length || 0)));

      return {
        duration: clampValue(Math.round(maxLength / 2.9), 280, 760),
        paths: measuredPaths
      };
    })
    .filter(Boolean);
}

function setWritingStrokeEntriesState(revealed = false, opacity = 0) {
  writingPracticeState.slotEntries.forEach((entry) => {
    entry.strokeEntries.forEach((strokeEntry) => {
      strokeEntry.paths.forEach((path) => {
        const length = Number(path.dataset.length || 0);
        path.style.transition = "none";
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = revealed ? "0" : `${length}`;
        path.style.opacity = opacity > 0 ? String(opacity) : "0";
      });
    });
  });
}

function buildWritingPracticeStage(current) {
  const layer = document.getElementById("writing-svg-layer");
  const stageEmpty = document.getElementById("writing-practice-stage-empty");

  if (!layer || !stageEmpty || !current) {
    return;
  }

  const units = splitWritingPracticeUnits(current.char);
  const renderPrefix = `writing-${current.id}-${writingPracticeState.renderSeed + 1}`;

  writingPracticeState.renderSeed += 1;
  writingPracticeState.slotEntries = [];
  writingPracticeState.hasVectorGuide = false;

  layer.innerHTML = "";
  layer.style.setProperty("--slot-count", String(units.length || 1));

  units.forEach((unit, unitIndex) => {
    const characters = Array.from(unit);
    const slot = document.createElement("div");
    slot.className = "writing-character-slot";
    slot.dataset.char = unit;
    slot.classList.toggle("is-compound", characters.length > 1);
    slot.style.setProperty("--glyph-count", String(characters.length));

    characters.forEach((character, glyphIndex) => {
      const glyph = document.createElement("div");
      glyph.className = "writing-character-glyph";
      glyph.classList.toggle("is-leading", glyphIndex === 0);
      glyph.classList.toggle("is-trailing", glyphIndex === characters.length - 1);
      glyph.classList.toggle("is-small", glyphIndex > 0 && writingPracticeCompoundFollowers.has(character));
      glyph.dataset.char = character;
      slot.appendChild(glyph);

      const rawSvg = kanaStrokeSvgs[character];

      if (!rawSvg) {
        const fallback = document.createElement("div");
        fallback.className = "writing-character-fallback";
        fallback.textContent = character;
        glyph.appendChild(fallback);
        writingPracticeState.slotEntries.push({
          char: character,
          unit,
          slot,
          glyph,
          svg: null,
          baseViewBox: { x: 0, y: 0, width: 1024, height: 1024 },
          viewBox: { x: 0, y: 0, width: 1024, height: 1024 },
          viewBoxMeasured: true,
          shadowPaths: [],
          targetSegments: [],
          targetStrokeWidth: 128,
          strokeEntries: []
        });
        return;
      }

      const svg = parseWritingPracticeSvg(rawSvg);

      if (!svg) {
        const fallback = document.createElement("div");
        fallback.className = "writing-character-fallback";
        fallback.textContent = character;
        glyph.appendChild(fallback);
        writingPracticeState.slotEntries.push({
          char: character,
          unit,
          slot,
          glyph,
          svg: null,
          baseViewBox: { x: 0, y: 0, width: 1024, height: 1024 },
          viewBox: { x: 0, y: 0, width: 1024, height: 1024 },
          viewBoxMeasured: true,
          shadowPaths: [],
          targetSegments: [],
          targetStrokeWidth: 128,
          strokeEntries: []
        });
        return;
      }

      glyph.appendChild(svg);
      svg.classList.add("writing-character-svg");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      uniquifyWritingSvgIds(svg, `${renderPrefix}-${unitIndex}-${glyphIndex}`);

      const baseViewBox = svg.viewBox?.baseVal
        ? {
            x: svg.viewBox.baseVal.x,
            y: svg.viewBox.baseVal.y,
            width: svg.viewBox.baseVal.width || 1024,
            height: svg.viewBox.baseVal.height || 1024
          }
        : { x: 0, y: 0, width: 1024, height: 1024 };

      const shadowPaths = Array.from(svg.querySelectorAll('g[data-strokesvg="shadows"] path'))
        .map((path) => path.getAttribute("d"))
        .filter(Boolean);
      const targetSegments = collectWritingTargetSegments(svg);
      const targetStrokeWidth = getWritingTargetStrokeWidth(svg);

      writingPracticeState.hasVectorGuide = writingPracticeState.hasVectorGuide || shadowPaths.length > 0;

      const { viewBox, hasMeasuredBounds } = getWritingSvgViewBox(svg, baseViewBox);
      svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
      const strokeEntries = collectWritingStrokeEntries(svg);

      writingPracticeState.slotEntries.push({
        char: character,
        unit,
        slot,
        glyph,
        svg,
        baseViewBox,
        viewBox,
        viewBoxMeasured: hasMeasuredBounds,
        shadowPaths,
        targetSegments,
        targetStrokeWidth,
        strokeEntries
      });
    });

    layer.appendChild(slot);
  });

  stageEmpty.hidden = writingPracticeState.hasVectorGuide;
  stageEmpty.textContent = writingPracticeState.hasVectorGuide
    ? ""
    : "따라쓰기 데이터를 준비하지 못했어요.";
  setWritingStrokeEntriesState(false, 0);
}

function updateWritingPracticeStageState() {
  const stage = document.getElementById("writing-practice-stage");

  if (!stage) {
    return;
  }

  stage.classList.toggle("is-guide-hidden", !writingPracticeState.guideVisible);
  stage.classList.toggle("is-answer-visible", writingPracticeState.answerVisible);
}

function getWritingPracticeStrokeCount() {
  return writingPracticeState.slotEntries.reduce((count, entry) => count + entry.strokeEntries.length, 0);
}

function updateWritingPracticeControls() {
  const guideToggle = document.getElementById("writing-guide-toggle");
  const revealToggle = document.getElementById("writing-practice-reveal");
  const prevButton = document.getElementById("writing-practice-prev");
  const clearButton = document.getElementById("writing-practice-clear");
  const scoreButton = document.getElementById("writing-practice-score-btn");
  const replayButton = document.getElementById("writing-practice-replay");
  const nextButton = document.getElementById("writing-practice-next");
  const isBusy = writingPracticeState.isAnimating || writingPracticeState.isTransitioning;

  const syncButtonState = (button, label, disabled) => {
    if (!button) {
      return;
    }

    if (typeof label === "string" && button.textContent !== label) {
      button.textContent = label;
    }

    if (button.disabled !== disabled) {
      button.disabled = disabled;
    }
  };

  if (guideToggle) {
    guideToggle.disabled = !writingPracticeState.hasVectorGuide || isBusy;
    const isGuideVisible = writingPracticeState.guideVisible;
    const guideLabel = guideToggle.querySelector(".writing-practice-guide-label");
    const guideIcon = guideToggle.querySelector(".writing-practice-guide-icon");

    if (guideLabel) {
      guideLabel.textContent = "가이드";
    }

    if (guideIcon) {
      guideIcon.textContent = isGuideVisible ? "visibility_off" : "visibility";
      guideIcon.setAttribute("aria-label", isGuideVisible ? "숨김" : "표시");
    }

    guideToggle.setAttribute("aria-label", `가이드 ${isGuideVisible ? "숨기기" : "보기"}`);
  }

  if (revealToggle) {
    syncButtonState(
      revealToggle,
      writingPracticeState.answerVisible ? "정답 숨길래요" : "정답 볼래요",
      !writingPracticeState.hasVectorGuide || isBusy
    );
  }

  if (prevButton) {
    syncButtonState(prevButton, null, !writingPracticeState.sessionItems.length || isBusy);
  }

  if (clearButton) {
    syncButtonState(clearButton, null, writingPracticeState.strokes.length === 0 || isBusy);
  }

  if (scoreButton) {
    syncButtonState(scoreButton, null, !writingPracticeState.hasVectorGuide || isBusy);
  }

  if (replayButton) {
    syncButtonState(replayButton, null, !writingPracticeState.hasVectorGuide || isBusy);
  }

  if (nextButton) {
    syncButtonState(nextButton, null, !writingPracticeState.sessionItems.length || isBusy);
  }
}

function updateWritingPracticePanel() {
  const current = getCurrentWritingPracticeItem();
  const title = document.getElementById("writing-practice-title");
  const source = document.getElementById("writing-practice-source");
  const progress = document.getElementById("writing-practice-progress");
  const strokes = document.getElementById("writing-practice-strokes");
  const character = document.getElementById("writing-practice-char");
  const reading = document.getElementById("writing-practice-reading");
  const score = document.getElementById("writing-practice-score");
  const feedback = document.getElementById("writing-practice-feedback");
  const prompt = document.getElementById("writing-practice-prompt");
  const tip = document.getElementById("writing-practice-tip");

  syncSelectionButtonState(
    document.querySelectorAll("[data-writing-mode]"),
    (button) => button.dataset.writingMode,
    writingPracticeSettings.mode
  );
  syncSelectionButtonState(
    document.querySelectorAll("[data-writing-order]"),
    (button) => button.dataset.writingOrder,
    writingPracticeSettings.order
  );

  renderWritingPracticeSetup();

  if (!current) {
    if (title) {
      title.textContent = "문자 따라쓰기";
    }
    if (source) {
      source.textContent = "-";
    }
    if (progress) {
      progress.textContent = "-";
    }
    if (strokes) {
      strokes.textContent = "-";
    }
    if (character) {
      character.textContent = "-";
    }
    if (reading) {
      reading.textContent = "-";
    }
    if (score) {
      score.textContent = "-";
    }
    if (feedback) {
      feedback.hidden = true;
      feedback.textContent = "";
    }
    if (prompt) {
      prompt.textContent = "가이드를 따라 천천히 써보고, 끝나면 점수를 확인해봐요.";
    }
    if (tip) {
      tip.textContent = getWritingPracticeDefaultTip();
    }
    updateWritingPracticeStageState();
    updateWritingPracticeControls();
    return;
  }

  const total = writingPracticeState.sessionItems.length;
  const modeLabel =
    writingPracticeSettings.mode === "random"
      ? "랜덤"
      : current.script === "katakana"
        ? "카타카나"
        : "히라가나";

  if (title) {
    title.textContent = `${modeLabel} 따라쓰기`;
  }
  if (source) {
    source.textContent = current.source;
  }
  if (progress) {
    progress.textContent = `${writingPracticeState.sessionIndex + 1} / ${total}`;
  }
  if (strokes) {
    strokes.textContent = `${getWritingPracticeStrokeCount()}획`;
  }
  if (character) {
    character.textContent = current.char;
  }
  if (reading) {
    reading.textContent = current.reading;
  }
  if (score) {
    score.textContent = writingPracticeState.score === null ? "-" : `${writingPracticeState.score}점`;
  }
  if (feedback) {
    feedback.hidden = writingPracticeState.score === null;
    feedback.textContent = writingPracticeState.score === null ? "" : writingPracticeState.feedback;
  }
  if (prompt) {
    prompt.textContent = `「${current.char}」를 칸 안에 맞춰 써보고, 끝나면 점수를 확인해봐요.`;
  }
  if (tip) {
    tip.textContent = writingPracticeState.tip;
  }

  updateWritingPracticeStageState();
  updateWritingPracticeControls();
}

function getWritingCanvasReferenceRect(canvas) {
  const layer = document.getElementById("writing-svg-layer");
  const layerRect = layer?.getBoundingClientRect();

  if (layerRect?.width && layerRect?.height) {
    return layerRect;
  }

  return canvas.getBoundingClientRect();
}

function getWritingCanvasScaleRatio(canvas) {
  const rect = canvas.getBoundingClientRect();
  return canvas.width / Math.max(rect.width, 1);
}

function getWritingBrushWidth(canvas) {
  const referenceRect = getWritingCanvasReferenceRect(canvas);
  const scaleRatio = getWritingCanvasScaleRatio(canvas);
  const cssBrushWidth = clampValue(Math.round(Math.min(referenceRect.width, referenceRect.height) * 0.018), 6, 14);
  return Math.max(1, Math.round(cssBrushWidth * scaleRatio));
}

function drawWritingStroke(ctx, canvas, points) {
  if (!points.length) {
    return;
  }

  const absolutePoints = points.map((point) => ({
    x: point.x * canvas.width,
    y: point.y * canvas.height
  }));

  if (absolutePoints.length === 1) {
    const radius = getWritingBrushWidth(canvas) * 0.5;
    ctx.beginPath();
    ctx.arc(absolutePoints[0].x, absolutePoints[0].y, radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(absolutePoints[0].x, absolutePoints[0].y);

  for (let index = 1; index < absolutePoints.length; index += 1) {
    ctx.lineTo(absolutePoints[index].x, absolutePoints[index].y);
  }

  ctx.stroke();
}

function getWritingOverlayBounds(canvas, strokes) {
  if (!canvas || !strokes.length) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  strokes.forEach((stroke) => {
    stroke.forEach((point) => {
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  const padding = getWritingBrushWidth(canvas);

  return {
    x: Math.max(0, minX - padding),
    y: Math.max(0, minY - padding),
    width: Math.min(canvas.width, maxX + padding) - Math.max(0, minX - padding),
    height: Math.min(canvas.height, maxY + padding) - Math.max(0, minY - padding)
  };
}

function clearWritingOverlayRegion(ctx, canvas, bounds) {
  if (!ctx || !canvas) {
    return;
  }

  if (!bounds) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  ctx.clearRect(bounds.x, bounds.y, bounds.width, bounds.height);
}

function resetWritingOverlayCanvas() {
  const canvas = document.getElementById("writing-overlay-canvas");
  const ctx = canvas?.getContext("2d");

  if (canvas && ctx) {
    clearWritingOverlayRegion(ctx, canvas, null);
  }

  writingPracticeState.overlayHasInk = false;
  writingPracticeState.overlayBounds = null;
}

function renderWritingOverlay() {
  const canvas = document.getElementById("writing-overlay-canvas");
  const ctx = canvas?.getContext("2d");

  if (!canvas || !ctx) {
    return;
  }

  const hasStrokes = writingPracticeState.strokes.some((stroke) => stroke.length);

  if (!hasStrokes && !writingPracticeState.overlayHasInk) {
    return;
  }

  const nextBounds = hasStrokes ? getWritingOverlayBounds(canvas, writingPracticeState.strokes) : null;
  const previousBounds = writingPracticeState.overlayBounds;
  const clearBounds =
    previousBounds && nextBounds
      ? {
          x: Math.min(previousBounds.x, nextBounds.x),
          y: Math.min(previousBounds.y, nextBounds.y),
          width: Math.max(previousBounds.x + previousBounds.width, nextBounds.x + nextBounds.width) - Math.min(previousBounds.x, nextBounds.x),
          height: Math.max(previousBounds.y + previousBounds.height, nextBounds.y + nextBounds.height) - Math.min(previousBounds.y, nextBounds.y)
        }
      : previousBounds || nextBounds;

  clearWritingOverlayRegion(ctx, canvas, clearBounds);

  if (!hasStrokes) {
    writingPracticeState.overlayHasInk = false;
    writingPracticeState.overlayBounds = null;
    return;
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(30, 35, 49, 0.94)";
  ctx.fillStyle = "rgba(30, 35, 49, 0.94)";
  ctx.lineWidth = getWritingBrushWidth(canvas);

  writingPracticeState.strokes.forEach((stroke) => {
    drawWritingStroke(ctx, canvas, stroke);
  });
  writingPracticeState.overlayHasInk = true;
  writingPracticeState.overlayBounds = nextBounds;
}

function renderWritingPracticeTargetMask() {
  const canvas = document.getElementById("writing-overlay-canvas");
  const ctx = writingPracticeState.targetCanvas.getContext("2d");

  if (!canvas || !ctx) {
    return;
  }

  writingPracticeState.targetCanvas.width = canvas.width;
  writingPracticeState.targetCanvas.height = canvas.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!writingPracticeState.hasVectorGuide) {
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const scaleRatio = canvas.width / Math.max(canvasRect.width, 1);
  ctx.fillStyle = "#ffffff";

  writingPracticeState.slotEntries.forEach((entry) => {
    if (!entry.svg || !entry.targetSegments.length) {
      return;
    }

    const svgRect = entry.svg.getBoundingClientRect();

    if (!svgRect.width || !svgRect.height) {
      return;
    }

    const x = (svgRect.left - canvasRect.left) * scaleRatio;
    const y = (svgRect.top - canvasRect.top) * scaleRatio;
    const width = svgRect.width * scaleRatio;
    const height = svgRect.height * scaleRatio;
    const scale = Math.min(width / entry.viewBox.width, height / entry.viewBox.height);
    const offsetX = x + (width - entry.viewBox.width * scale) / 2 - entry.viewBox.x * scale;
    const offsetY = y + (height - entry.viewBox.height * scale) / 2 - entry.viewBox.y * scale;
    const guideStrokeWidth = (entry.targetStrokeWidth || 128) * scale;
    const targetStrokeWidth = Math.max(getWritingBrushWidth(canvas) * 2.2, guideStrokeWidth * 0.34);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, targetStrokeWidth / Math.max(scale, 0.0001));
    entry.targetSegments.forEach((segment) => {
      ctx.save();

      if (segment.clipMasks.length) {
        segment.clipMasks.forEach((clipMask) => {
          ctx.clip(clipMask);
        });
      }

      ctx.stroke(segment.pathMask);
      ctx.restore();
    });
    ctx.restore();
  });
}

function syncWritingPracticeCanvas() {
  const canvas = document.getElementById("writing-overlay-canvas");

  if (!canvas) {
    return;
  }

  const rect = canvas.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return;
  }

  const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
  const nextWidth = Math.max(1, Math.round(rect.width * ratio));
  const nextHeight = Math.max(1, Math.round(rect.height * ratio));
  const resized = canvas.width !== nextWidth || canvas.height !== nextHeight;

  if (resized) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    writingPracticeState.overlayHasInk = false;
    writingPracticeState.overlayBounds = null;
  }

  refreshWritingPracticeViewBoxes();
  renderWritingOverlay();
}

function observeWritingPracticeLayout() {
  if (writingPracticeState.layoutObserver || typeof ResizeObserver !== "function") {
    return;
  }

  writingPracticeState.layoutObserver = new ResizeObserver(() => {
    if (!document.getElementById("writing-practice-shell") || getCharactersTab(state.charactersTab) !== "writing") {
      return;
    }

    scheduleWritingPracticeLayout(false);
  });

  const stage = document.getElementById("writing-practice-stage");

  if (stage) {
    writingPracticeState.layoutObserver.observe(stage);
  }
}

function scheduleWritingPracticeLayout(replay = false) {
  beginWritingPracticeTransition();

  if (writingPracticeState.layoutFrame) {
    cancelAnimationFrame(writingPracticeState.layoutFrame);
  }

  writingPracticeState.layoutFrame = window.requestAnimationFrame(() => {
    writingPracticeState.layoutFrame = window.requestAnimationFrame(() => {
      writingPracticeState.layoutFrame = null;
      syncWritingPracticeCanvas();
      updateWritingPracticeStageState();
      endWritingPracticeTransition();

      if (replay && writingPracticeState.hasVectorGuide) {
        replayWritingStrokeAnimation();
      }
    });
  });
}

function getWritingPracticeScoreResult(score, coverage, precision) {
  if (score >= 90) {
    return {
      score,
      feedback: "거의 맞았어요. 획 모양이 안정적으로 들어왔어요.",
      tip: "이 감각으로 다음 글자도 이어가보세요."
    };
  }

  if (score >= 78) {
    if (coverage < precision) {
      return {
        score,
        feedback: "모양은 좋아요. 다만 빠진 부분이 조금 있어요.",
        tip: "획의 끝점을 한 번만 더 길게 빼보면 더 닮아져요."
      };
    }

    return {
      score,
      feedback: "대체로 잘 맞아요. 가이드 밖으로 나온 부분만 조금 줄여보세요.",
      tip: "선을 조금 더 천천히 눌러 쓰면 점수가 더 올라가요."
    };
  }

  if (score >= 62) {
    if (coverage < 0.55) {
      return {
        score,
        feedback: "형태는 잡혔지만 빠진 획이 아직 보여요.",
        tip: "획순 다시 보기로 시작점과 끝점을 확인해보세요."
      };
    }

    return {
      score,
      feedback: "전체 윤곽은 보이기 시작했어요. 조금만 더 안쪽으로 모아 써보세요.",
      tip: "가이드 안에서 크기를 조금 줄이면 훨씬 비슷해져요."
    };
  }

  if (coverage < 0.42) {
    return {
      score,
      feedback: "빠진 부분이 많아요. 획을 끝까지 이어서 써보면 좋아요.",
      tip: "정답 모양을 보고 흐름을 익힌 뒤, 화면을 꽉 채운다는 느낌으로 다시 써봐요."
    };
  }

  if (precision < 0.34) {
    return {
      score,
      feedback: "획이 가이드 밖으로 많이 벗어났어요.",
      tip: "한 번에 빨리 쓰기보다 짧게 끊어가며 맞춰보세요."
    };
  }

  return {
    score,
    feedback: "첫 형태는 잡혔어요. 다시 한 번 천천히 써보면 금방 올라가요.",
    tip: "가이드를 켠 상태로 크기와 간격부터 먼저 맞춰보세요."
  };
}

function buildWritingPracticeMask(data) {
  const mask = new Uint8Array(Math.floor(data.length / 4));
  let activePixels = 0;

  for (let dataIndex = 3, maskIndex = 0; dataIndex < data.length; dataIndex += 4, maskIndex += 1) {
    const isActive = data[dataIndex] > 32 ? 1 : 0;
    mask[maskIndex] = isActive;
    activePixels += isActive;
  }

  return {
    mask,
    activePixels
  };
}

function buildWritingPracticeIntegralMask(mask, width, height) {
  const stride = width + 1;
  const integral = new Uint32Array((width + 1) * (height + 1));

  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    const maskRowOffset = (y - 1) * width;
    const integralRowOffset = y * stride;
    const previousRowOffset = (y - 1) * stride;

    for (let x = 1; x <= width; x += 1) {
      rowSum += mask[maskRowOffset + x - 1];
      integral[integralRowOffset + x] = integral[previousRowOffset + x] + rowSum;
    }
  }

  return integral;
}

function hasWritingPracticeMaskHit(integral, width, height, x, y, radius) {
  const stride = width + 1;
  const left = Math.max(0, x - radius);
  const top = Math.max(0, y - radius);
  const right = Math.min(width - 1, x + radius);
  const bottom = Math.min(height - 1, y + radius);
  const x1 = left;
  const y1 = top;
  const x2 = right + 1;
  const y2 = bottom + 1;
  const sum =
    integral[y2 * stride + x2] -
    integral[y1 * stride + x2] -
    integral[y2 * stride + x1] +
    integral[y1 * stride + x1];

  return sum > 0;
}

function countWritingPracticeMaskMatches(mask, activePixels, targetIntegral, width, height, radius) {
  if (!activePixels) {
    return 0;
  }

  let matches = 0;
  let index = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1, index += 1) {
      if (!mask[index]) {
        continue;
      }

      if (hasWritingPracticeMaskHit(targetIntegral, width, height, x, y, radius)) {
        matches += 1;
      }
    }
  }

  return matches;
}

function scoreWritingPractice() {
  if (writingPracticeState.isAnimating || writingPracticeState.isTransitioning) {
    return;
  }

  const canvas = document.getElementById("writing-overlay-canvas");
  const userCtx = canvas?.getContext("2d");
  const targetCtx = writingPracticeState.targetCanvas.getContext("2d");

  if (!canvas || !userCtx || !targetCtx || !writingPracticeState.hasVectorGuide) {
    return;
  }

  if (!writingPracticeState.strokes.some((stroke) => stroke.length)) {
    writingPracticeState.feedback = "아직 쓴 획이 없어요. 먼저 한 번 써볼까요?";
    writingPracticeState.tip = "글자를 칸 안에 크게 한 번 쓴 뒤 점수를 눌러보세요.";
    updateWritingPracticePanel();
    return;
  }

  renderWritingPracticeTargetMask();

  const userData = userCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  const targetData = targetCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  const { mask: userMask, activePixels: userPixels } = buildWritingPracticeMask(userData);
  const { mask: targetMask, activePixels: targetPixels } = buildWritingPracticeMask(targetData);

  if (!targetPixels || !userPixels) {
    writingPracticeState.feedback = "아직 비교할 선이 충분하지 않아요. 조금 더 크게 써보세요.";
    writingPracticeState.tip = "획을 한두 번 더 보강한 뒤 다시 점수를 눌러보세요.";
    updateWritingPracticePanel();
    return;
  }

  const toleranceRadius = clampValue(Math.round(getWritingBrushWidth(canvas) * 0.9), 6, 16);
  const userIntegral = buildWritingPracticeIntegralMask(userMask, canvas.width, canvas.height);
  const targetIntegral = buildWritingPracticeIntegralMask(targetMask, canvas.width, canvas.height);
  const coveredTargetPixels = countWritingPracticeMaskMatches(targetMask, targetPixels, userIntegral, canvas.width, canvas.height, toleranceRadius);
  const alignedUserPixels = countWritingPracticeMaskMatches(userMask, userPixels, targetIntegral, canvas.width, canvas.height, toleranceRadius);
  const coverage = coveredTargetPixels / targetPixels;
  const precision = alignedUserPixels / userPixels;
  const easedCoverage = Math.sqrt(coverage);
  const easedPrecision = Math.sqrt(precision);
  const score = clampValue(Math.round((easedCoverage * 0.58 + easedPrecision * 0.42) * 100), 0, 100);
  const result = getWritingPracticeScoreResult(score, easedCoverage, easedPrecision);

  writingPracticeState.score = result.score;
  writingPracticeState.feedback = result.feedback;
  writingPracticeState.tip = result.tip;

  updateWritingPracticePanel();
  updateStudyStreak();
  saveState();
  renderStats();
}

function getWritingCanvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: clampValue((event.clientX - rect.left) / rect.width, 0, 1),
    y: clampValue((event.clientY - rect.top) / rect.height, 0, 1)
  };
}

function handleWritingPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  if (writingPracticeState.isAnimating || writingPracticeState.isTransitioning) {
    return;
  }

  if (!getCurrentWritingPracticeItem()) {
    return;
  }

  const canvas = event.currentTarget;

  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  writingPracticeState.pointerId = event.pointerId;
  writingPracticeState.isDrawing = true;

  if (writingPracticeState.score !== null) {
    writingPracticeState.score = null;
    writingPracticeState.feedback = getWritingPracticeDefaultFeedback();
    writingPracticeState.tip = getWritingPracticeDefaultTip();
  }

  const point = getWritingCanvasPoint(event, canvas);
  writingPracticeState.strokes.push([point]);
  renderWritingOverlay();
  updateWritingPracticePanel();
}

function handleWritingPointerMove(event) {
  if (!writingPracticeState.isDrawing || writingPracticeState.pointerId !== event.pointerId) {
    return;
  }

  const canvas = event.currentTarget;

  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  event.preventDefault();

  const point = getWritingCanvasPoint(event, canvas);
  const currentStroke = writingPracticeState.strokes[writingPracticeState.strokes.length - 1];

  if (!currentStroke) {
    return;
  }

  const lastPoint = currentStroke[currentStroke.length - 1];

  if (lastPoint && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 0.0022) {
    return;
  }

  currentStroke.push(point);
  renderWritingOverlay();
}

function finishWritingPointer(event) {
  if (writingPracticeState.pointerId !== event.pointerId) {
    return;
  }

  const canvas = event.currentTarget;

  if (canvas instanceof HTMLCanvasElement && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  writingPracticeState.pointerId = null;
  writingPracticeState.isDrawing = false;
  updateWritingPracticeControls();
}

function waitForWritingAnimation(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

async function replayWritingStrokeAnimation() {
  if (!writingPracticeState.hasVectorGuide || writingPracticeState.isAnimating) {
    return;
  }

  cancelWritingPracticeAnimation();
  const token = writingPracticeState.animationToken;
  writingPracticeState.isAnimating = true;
  setWritingStrokeEntriesState(false, 0);
  updateWritingPracticeControls();

  for (const entry of writingPracticeState.slotEntries) {
    for (const strokeEntry of entry.strokeEntries) {
      if (token !== writingPracticeState.animationToken) {
        return;
      }

      strokeEntry.paths.forEach((path) => {
        const length = Number(path.dataset.length || 0);
        path.style.transition = "none";
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
        path.style.opacity = "1";
      });

      strokeEntry.paths[0]?.getBoundingClientRect();

      strokeEntry.paths.forEach((path) => {
        path.style.transition = `stroke-dashoffset ${strokeEntry.duration}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease`;
        path.style.strokeDashoffset = "0";
      });

      await waitForWritingAnimation(strokeEntry.duration + 90);
    }
  }

  if (token !== writingPracticeState.animationToken) {
    return;
  }

  writingPracticeState.isAnimating = false;
  setWritingStrokeEntriesState(true, writingPracticeState.answerVisible ? 0.88 : 0.18);
  updateWritingPracticeControls();
}

function clearWritingPracticeCanvas(resetStatus = true) {
  writingPracticeState.strokes = [];

  if (resetStatus) {
    writingPracticeState.score = null;
    writingPracticeState.feedback = getWritingPracticeDefaultFeedback();
    writingPracticeState.tip = getWritingPracticeDefaultTip();
  }

  renderWritingOverlay();
  updateWritingPracticePanel();
}

function startWritingPracticeSession(mode = writingPracticeSettings.mode, order = writingPracticeSettings.order) {
  const nextMode = ["hiragana", "katakana", "random"].includes(mode) ? mode : "hiragana";
  const nextOrder = getWritingPracticeOrder(order);
  writingPracticeSettings.mode = nextMode;
  writingPracticeSettings.order = nextOrder;
  writingPracticeState.sessionItems = buildWritingPracticeSession(nextMode, nextOrder);
  writingPracticeState.sessionIndex = 0;
  resetWritingPracticeRound();
  renderWritingPractice();
}

function nextWritingPracticeItem() {
  if (writingPracticeState.isAnimating || writingPracticeState.isTransitioning) {
    return;
  }

  if (!writingPracticeState.sessionItems.length) {
    startWritingPracticeSession(writingPracticeSettings.mode, writingPracticeSettings.order);
    return;
  }

  if (writingPracticeState.sessionIndex + 1 >= writingPracticeState.sessionItems.length) {
    writingPracticeState.sessionItems = buildWritingPracticeSession(
      writingPracticeSettings.mode,
      writingPracticeSettings.order
    );
    writingPracticeState.sessionIndex = 0;
  } else {
    writingPracticeState.sessionIndex += 1;
  }

  resetWritingPracticeRound();
  renderWritingPractice();
}

function previousWritingPracticeItem() {
  if (writingPracticeState.isAnimating || writingPracticeState.isTransitioning) {
    return;
  }

  if (!writingPracticeState.sessionItems.length) {
    startWritingPracticeSession(writingPracticeSettings.mode, writingPracticeSettings.order);
    return;
  }

  if (writingPracticeState.sessionIndex <= 0) {
    writingPracticeState.sessionIndex = writingPracticeState.sessionItems.length - 1;
  } else {
    writingPracticeState.sessionIndex -= 1;
  }

  resetWritingPracticeRound();
  renderWritingPractice();
}

function openWritingPracticeForCharacter(char, script) {
  if (!char) {
    return;
  }

  const nextMode = script === "katakana" ? "katakana" : "hiragana";
  const nextItems = buildWritingPracticeSession(nextMode, writingPracticeSettings.order);
  const nextIndex = nextItems.findIndex((item) => item.char === char);

  state.charactersTab = "writing";
  writingPracticeSettings.mode = nextMode;
  writingPracticeState.sessionItems = nextItems;
  writingPracticeState.sessionIndex = nextIndex >= 0 ? nextIndex : 0;
  resetWritingPracticeRound();
  saveState();
  renderWritingPractice();
  renderCharactersPageLayout();
}

function toggleWritingGuide() {
  writingPracticeState.guideVisible = !writingPracticeState.guideVisible;
  updateWritingPracticePanel();
}

function toggleWritingAnswer() {
  if (!writingPracticeState.hasVectorGuide) {
    return;
  }

  cancelWritingPracticeAnimation();
  writingPracticeState.answerVisible = !writingPracticeState.answerVisible;

  if (writingPracticeState.answerVisible) {
    writingPracticeState.guideVisible = true;
    writingPracticeState.tip = "정답 모양을 켰어요. 획순을 보고 같은 흐름으로 다시 써봐요.";
    setWritingStrokeEntriesState(true, 0.88);
    updateWritingPracticePanel();
    return;
  }

  writingPracticeState.tip =
    writingPracticeState.score === null ? getWritingPracticeDefaultTip() : writingPracticeState.tip;
  setWritingStrokeEntriesState(false, 0);
  updateWritingPracticePanel();
}

function renderWritingPractice() {
  const shell = document.getElementById("writing-practice-shell");

  if (!shell) {
    return;
  }

  ensureWritingPracticeSession();

  const current = getCurrentWritingPracticeItem();

  if (!current) {
    endWritingPracticeTransition();
    updateWritingPracticePanel();
    return;
  }

  buildWritingPracticeStage(current);
  updateWritingPracticePanel();

  if (getCharactersTab(state.charactersTab) === "writing") {
    scheduleWritingPracticeLayout(false);
  }
}

function createQuizMeta(item, mode, promptKind) {
  return {
    mode,
    promptKind,
    sourceId: item.id,
    level: item.level,
    word: item.word,
    reading: item.reading,
    meaning: item.meaning,
    part: item.part
  };
}

function buildWordToMeaningQuizQuestion(item, pool, index) {
  const correctMeaning = item.meaning;
  const distractors = uniqueQuizValues(
    shuffleQuizArray(
      pool
        .filter((candidate) => candidate.id !== item.id && candidate.meaning !== correctMeaning)
        .map((candidate) => candidate.meaning)
    )
  );

  if (distractors.length < 3) {
    return null;
  }

  const label = item.part ? ` (${item.part})` : "";

  return {
    id: `quiz-meaning-${item.id}-${index}`,
    level: item.level || "N5",
    question: `이 히라가나, 뜻이 뭘까요? ${item.reading}${label}`,
    options: shuffleQuizArray([correctMeaning, ...distractors.slice(0, 3)]),
    answer: correctMeaning,
    meta: createQuizMeta(item, "meaning", "word-to-meaning")
  };
}

function buildMeaningToWordQuizQuestion(item, pool, index) {
  const correctWord = item.word;
  const distractors = uniqueQuizValues(
    shuffleQuizArray(
      pool
        .filter((candidate) => candidate.id !== item.id && candidate.word !== correctWord)
        .map((candidate) => candidate.word)
    )
  );

  if (distractors.length < 3) {
    return null;
  }

  return {
    id: `quiz-word-${item.id}-${index}`,
    level: item.level || "N5",
    question: `이 뜻에 맞는 일본어 단어는 뭘까요? ${item.meaning}`,
    options: shuffleQuizArray([correctWord, ...distractors.slice(0, 3)]),
    answer: correctWord,
    meta: createQuizMeta(item, "meaning", "meaning-to-word")
  };
}

function buildReadingQuizQuestion(item, pool, index) {
  if (!item.word || !item.reading || item.word === item.reading) {
    return null;
  }

  const distractors = uniqueQuizValues(
    shuffleQuizArray(
      pool
        .filter((candidate) => candidate.id !== item.id && candidate.reading !== item.reading)
        .map((candidate) => candidate.reading)
    )
  );

  if (distractors.length < 3) {
    return null;
  }

  const label = item.part ? ` (${item.part})` : "";

  return {
    id: `quiz-reading-${item.id}-${index}`,
    level: item.level || "N5",
    question: `이 단어, 어떻게 읽을까요? ${item.word}${label}`,
    options: shuffleQuizArray([item.reading, ...distractors.slice(0, 3)]),
    answer: item.reading,
    meta: createQuizMeta(item, "reading", "word-to-reading")
  };
}

function buildMeaningQuizSession(pool, count) {
  const seedItems = shuffleQuizArray(pool);
  const questions = [];

  for (let index = 0; index < seedItems.length && questions.length < count; index += 1) {
    const question = buildWordToMeaningQuizQuestion(seedItems[index], pool, questions.length);

    if (question) {
      questions.push(question);
    }
  }

  return questions;
}

function buildReadingQuizSession(pool, count) {
  const readingPool = pool.filter((item) => item.word && item.reading && item.word !== item.reading);
  const seedItems = shuffleQuizArray(readingPool);
  const questions = [];

  for (let index = 0; index < seedItems.length && questions.length < count; index += 1) {
    const question = buildReadingQuizQuestion(seedItems[index], readingPool, questions.length);

    if (question) {
      questions.push(question);
    }
  }

  return questions;
}

function createFallbackQuizSession(count, mode = state.quizMode, level = state.quizLevel) {
  const activeLevel = getQuizLevel(level);
  const sessionMode = getQuizMode(mode);
  const fallbackPool = buildDynamicQuizPool(getFallbackVocabItems(activeLevel));
  const fallbackQuestions =
    sessionMode === "reading"
      ? buildReadingQuizSession(fallbackPool, count)
      : buildMeaningQuizSession(fallbackPool, count);

  if (fallbackQuestions.length) {
    return fallbackQuestions;
  }

  const levelQuestions =
    activeLevel === allLevelValue
      ? quizQuestions.filter((question) => contentLevels.includes(question.level))
      : quizQuestions.filter((question) => question.level === activeLevel);
  const sourceQuestions = levelQuestions.length
    ? levelQuestions
    : quizQuestions.filter((question) => question.level === "N5");

  return shuffleQuizArray(sourceQuestions)
    .slice(0, Math.min(count, sourceQuestions.length))
    .map((question) => ({
      ...question,
      meta: {
        mode: "meaning",
        promptKind: "fallback",
        sourceId: question.id,
        word: question.answer,
        reading: "",
        meaning: question.answer,
        part: ""
      }
    }));
}

function createQuizSession(mode, size, level = state.quizLevel) {
  const activeLevel = getQuizLevel(level);
  const sessionMode = getQuizMode(mode);
  const questionCount = getQuizSessionSize(size);
  const activeSource = getDynamicVocabSource(activeLevel);
  const activePool = buildDynamicQuizPool(activeSource);
  const dynamicQuestions =
    sessionMode === "reading"
      ? buildReadingQuizSession(activePool, questionCount)
      : buildMeaningQuizSession(activePool, questionCount);

  return dynamicQuestions.length
    ? dynamicQuestions
    : createFallbackQuizSession(questionCount, sessionMode, activeLevel);
}

let activeQuizQuestions = [];
let activeVocabQuizQuestions = [];
let activeVocabQuizSignature = "";
let activeVocabQuizResults = [];
let starterKanjiQuestionOrder = [];
let starterKanjiOptionOrders = {};
const starterKanjiResultFilterLabels = {
  all: "전체",
  correct: "정답",
  wrong: "오답"
};
const kanjiCollectionFilterLabels = {
  all: "전체",
  review: "다시 볼래요",
  mastered: "익혔어요",
  unmarked: "아직 안 정했어요"
};
const starterKanjiState = {
  results: [],
  showResults: false,
  resultFilter: "all"
};

const readingSets = getLevelContentSets(readingContent.sets);
readingSets[allLevelValue] = getAllPracticeSets(readingSets);

const defaultState = {
  flashcardIndex: 0,
  flashcardRevealed: false,
  vocabTab: "study",
  vocabLevel: "N5",
  vocabView: "card",
  vocabFilter: "all",
  vocabPartFilter: "all",
  vocabOptionsOpen: false,
  vocabPage: 1,
  vocabQuizMode: "meaning",
  vocabQuizQuestionField: "reading",
  vocabQuizOptionField: "meaning",
  vocabQuizCount: 10,
  vocabQuizDuration: 15,
  vocabQuizOptionsOpen: false,
  vocabQuizStarted: false,
  vocabQuizResultFilter: "all",
  vocabQuizIndex: 0,
  vocabQuizFinished: false,
  starterKanjiQuestionField: "display",
  starterKanjiOptionField: "reading",
  starterKanjiQuizCount: 10,
  starterKanjiQuizDuration: 15,
  starterKanjiQuizOptionsOpen: false,
  starterKanjiQuizStarted: false,
  starterKanjiQuizFinished: false,
  kanjiMatchCount: 5,
  kanjiMatchDuration: 15,
  kanjiMatchOptionsOpen: false,
  kanjiOptionsOpen: false,
  kanjiTab: "list",
  kanjiView: "card",
  kanjiGrade: allLevelValue,
  kanjiCollectionFilter: "all",
  kanjiPage: 1,
  kanjiFlashcardIndex: 0,
  kanjiFlashcardRevealed: false,
  kanjiReviewIds: [],
  kanjiMasteredIds: [],
  starterDoneIds: [],
  basicPracticeTrack: "kana",
  basicPracticeIndexes: {
    kana: 0,
    words: 0,
    particles: 0,
    kanji: 0,
    sentences: 0
  },
  masteredIds: [],
  reviewIds: [],
  grammarDoneIds: [],
  grammarTab: "list",
  grammarPracticeOptionsOpen: false,
  grammarPracticeStarted: false,
  grammarPracticeLevel: "N5",
  grammarPracticeCount: 10,
  grammarPracticeDuration: 25,
  grammarPracticeSessionQuestionIndex: 0,
  grammarPracticeIndexes: { all: 0, N5: 0, N4: 0, N3: 0 },
  quizIndex: 0,
  quizLevel: "N5",
  quizMode: "meaning",
  quizSessionSize: 20,
  quizDuration: 15,
  quizOptionsOpen: false,
  quizSessionFinished: false,
  quizMistakes: [],
  quizSessionMistakeIds: [],
  quizCorrectCount: 0,
  quizAnsweredCount: 0,
  readingLevel: "N5",
  readingCount: 10,
  readingDuration: 45,
  readingOptionsOpen: false,
  readingStarted: false,
  readingSessionQuestionIndex: 0,
  readingIndexes: { all: 0, N5: 0, N4: 0, N3: 0 },
  charactersTab: "library",
  charactersLibraryTab: "hiragana",
  kanaSetupOpen: false,
  writingSetupOpen: false,
  lastStudyDate: null,
  streak: 0
};

function loadState() {
  const syncStore = getStudyStateStore();

  if (syncStore) {
    const saved = syncStore.readValue(storageKey, null);

    if (saved && typeof saved === "object") {
      return {
        ...defaultState,
        ...saved,
        basicPracticeIndexes: {
          ...defaultState.basicPracticeIndexes,
          ...(saved?.basicPracticeIndexes || {})
        },
        readingIndexes: { ...defaultState.readingIndexes, ...(saved?.readingIndexes || {}) },
        grammarPracticeIndexes: {
          ...defaultState.grammarPracticeIndexes,
          ...(saved?.grammarPracticeIndexes || {})
        }
      };
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return {
      ...defaultState,
      ...saved,
      basicPracticeIndexes: {
        ...defaultState.basicPracticeIndexes,
        ...(saved?.basicPracticeIndexes || {})
      },
      readingIndexes: { ...defaultState.readingIndexes, ...(saved?.readingIndexes || {}) },
      grammarPracticeIndexes: {
        ...defaultState.grammarPracticeIndexes,
        ...(saved?.grammarPracticeIndexes || {})
      }
    };
  } catch (error) {
    return { ...defaultState };
  }
}

function normalizeBasicPracticeState(inputState) {
  const nextState = { ...inputState };
  const savedIndexes = { ...(inputState?.basicPracticeIndexes || {}) };

  if (nextState.basicPracticeTrack === "kana" || !basicPracticeSets[nextState.basicPracticeTrack]) {
    nextState.basicPracticeTrack = "hiragana";
  }

  nextState.basicPracticeIndexes = {
    ...defaultState.basicPracticeIndexes,
    ...savedIndexes,
    hiragana: savedIndexes.hiragana ?? savedIndexes.kana ?? 0,
    katakana: savedIndexes.katakana ?? 0
  };
  delete nextState.basicPracticeIndexes.kana;

  return nextState;
}

function normalizeLoadedState(inputState) {
  const nextState = normalizeBasicPracticeState(inputState);

  nextState.quizLevel = getQuizLevel(nextState.quizLevel);
  nextState.quizMode = getQuizMode(nextState.quizMode);
  nextState.quizSessionSize = getQuizSessionSize(nextState.quizSessionSize);
  nextState.quizDuration = getQuizDuration(nextState.quizDuration);
  nextState.quizSessionFinished = false;
  nextState.quizIndex = 0;
  nextState.quizMistakes = Array.isArray(nextState.quizMistakes) ? nextState.quizMistakes : [];
  nextState.quizSessionMistakeIds = [];
  nextState.masteredIds = Array.from(new Set(Array.isArray(nextState.masteredIds) ? nextState.masteredIds : []));
  nextState.reviewIds = Array.from(
    new Set(
      (Array.isArray(nextState.reviewIds) ? nextState.reviewIds : []).filter(
        (id) => !nextState.masteredIds.includes(id)
      )
    )
  );
  nextState.kanjiMasteredIds = Array.from(new Set(Array.isArray(nextState.kanjiMasteredIds) ? nextState.kanjiMasteredIds : []));
  nextState.kanjiReviewIds = Array.from(
    new Set(
      (Array.isArray(nextState.kanjiReviewIds) ? nextState.kanjiReviewIds : []).filter(
        (id) => !nextState.kanjiMasteredIds.includes(id)
      )
    )
  );
  nextState.vocabTab = getVocabTab(nextState.vocabTab);
  nextState.vocabLevel = getVocabLevel(nextState.vocabLevel);
  nextState.vocabView = ["card", "list"].includes(nextState.vocabView) ? nextState.vocabView : "card";
  if (isVocabPagePath()) {
    const hashTab = window.location.hash.replace(/^#/, "").toLowerCase();

    if (["quiz", "match"].includes(hashTab)) {
      nextState.vocabTab = hashTab;
    }
  }
  nextState.vocabFilter = ["all", "review", "mastered", "unmarked"].includes(nextState.vocabFilter)
    ? nextState.vocabFilter
    : "all";
  nextState.vocabPartFilter =
    normalizeQuizText(nextState.vocabPartFilter) === vocabPartAllValue
      ? vocabPartAllValue
      : normalizeQuizText(nextState.vocabPartFilter);
  nextState.vocabPage = Number.isFinite(Number(nextState.vocabPage)) ? Math.max(1, Number(nextState.vocabPage)) : 1;
  nextState.vocabQuizMode = getVocabQuizMode(nextState.vocabQuizMode);
  nextState.vocabQuizQuestionField = getVocabQuizQuestionField(nextState.vocabQuizQuestionField, nextState.vocabQuizMode);
  nextState.vocabQuizOptionField = getVocabQuizOptionField(
    nextState.vocabQuizOptionField,
    nextState.vocabQuizQuestionField,
    nextState.vocabQuizMode
  );
  nextState.vocabQuizCount = getVocabQuizCount(nextState.vocabQuizCount);
  nextState.vocabQuizDuration = getVocabQuizDuration(nextState.vocabQuizDuration);
  nextState.vocabQuizOptionsOpen = false;
  nextState.vocabQuizStarted = false;
  nextState.vocabQuizResultFilter = ["all", "correct", "wrong"].includes(nextState.vocabQuizResultFilter)
    ? nextState.vocabQuizResultFilter
    : "all";
  nextState.vocabQuizIndex = 0;
  nextState.vocabQuizFinished = false;
  nextState.starterKanjiQuestionField = getStarterKanjiQuestionField(nextState.starterKanjiQuestionField);
  nextState.starterKanjiOptionField = getStarterKanjiOptionField(
    nextState.starterKanjiOptionField,
    nextState.starterKanjiQuestionField
  );
  nextState.starterKanjiQuizCount = getStarterKanjiQuizCount(nextState.starterKanjiQuizCount);
  nextState.starterKanjiQuizDuration = getStarterKanjiQuizDuration(nextState.starterKanjiQuizDuration);
  nextState.starterKanjiQuizOptionsOpen = false;
  nextState.starterKanjiQuizStarted = false;
  nextState.starterKanjiQuizFinished = false;
  nextState.kanjiMatchCount = kanjiMatchCountOptions.includes(Number(nextState.kanjiMatchCount))
    ? Number(nextState.kanjiMatchCount)
    : 5;
  nextState.kanjiMatchDuration = getQuizDuration(nextState.kanjiMatchDuration);
  nextState.kanjiMatchOptionsOpen = false;
  nextState.kanjiOptionsOpen = false;
  nextState.kanjiTab = getKanjiTab(nextState.kanjiTab);
  nextState.kanjiView = ["card", "list"].includes(nextState.kanjiView) ? nextState.kanjiView : "card";
  nextState.kanjiGrade = getKanjiGrade(nextState.kanjiGrade);
  nextState.kanjiCollectionFilter = getKanjiCollectionFilter(nextState.kanjiCollectionFilter);
  nextState.kanjiPage = Number.isFinite(Number(nextState.kanjiPage)) ? Math.max(1, Number(nextState.kanjiPage)) : 1;
  nextState.kanjiFlashcardIndex = Number.isFinite(Number(nextState.kanjiFlashcardIndex))
    ? Math.max(0, Number(nextState.kanjiFlashcardIndex))
    : 0;
  nextState.kanjiFlashcardRevealed = nextState.kanjiFlashcardRevealed === true;
  nextState.grammarPracticeOptionsOpen = false;
  nextState.grammarPracticeStarted = false;
  nextState.grammarPracticeLevel = getGrammarPracticeLevel(nextState.grammarPracticeLevel);
  nextState.grammarPracticeCount = getGrammarPracticeCount(nextState.grammarPracticeCount);
  nextState.grammarPracticeSessionQuestionIndex = Number.isFinite(Number(nextState.grammarPracticeSessionQuestionIndex))
    ? Math.max(0, Number(nextState.grammarPracticeSessionQuestionIndex))
    : 0;
  nextState.grammarPracticeDuration = getGrammarPracticeDuration(nextState.grammarPracticeDuration);
  nextState.readingLevel = getReadingLevel(nextState.readingLevel);
  nextState.readingCount = getReadingCount(nextState.readingCount);
  nextState.readingSessionQuestionIndex = Number.isFinite(Number(nextState.readingSessionQuestionIndex))
    ? Math.max(0, Number(nextState.readingSessionQuestionIndex))
    : 0;
  nextState.readingDuration = getReadingDuration(nextState.readingDuration);
  nextState.readingStarted = false;
  nextState.charactersTab = getCharactersTab(nextState.charactersTab ?? nextState.charactersPracticeTab);
  nextState.charactersLibraryTab = getCharactersLibraryTab(nextState.charactersLibraryTab);
  nextState.grammarTab = getGrammarTab(nextState.grammarTab);
  nextState.kanaSetupOpen = false;
  nextState.writingSetupOpen = false;
  nextState.quizOptionsOpen = false;
  nextState.vocabOptionsOpen = false;
  nextState.readingOptionsOpen = false;
  refreshDynamicVocabContent("N5");
  refreshQuizContent(nextState.quizLevel);
  refreshVocabPageContent(nextState.vocabLevel);
  nextState.vocabPartFilter = getVocabPartFilter(nextState.vocabPartFilter);
  activeQuizQuestions = createQuizSession(nextState.quizMode, nextState.quizSessionSize, nextState.quizLevel);

  return nextState;
}

state = normalizeLoadedState(loadState());

const quizSessions = {
  basic: {
    duration: 18,
    timeLeft: 18,
    correct: 0,
    streak: 0,
    timerId: null,
    timerElement: "basic-timer",
    correctElement: "basic-correct",
    streakElement: "basic-streak"
  },
  vocab: {
    duration: state.vocabQuizDuration,
    timeLeft: state.vocabQuizDuration,
    correct: 0,
    streak: 0,
    timerId: null,
    timerElement: "vocab-quiz-timer",
    correctElement: "vocab-quiz-correct",
    streakElement: "vocab-quiz-streak"
  },
  grammar: {
    duration: state.grammarPracticeDuration,
    timeLeft: state.grammarPracticeDuration,
    correct: 0,
    streak: 0,
    timerId: null,
    timerElement: "grammar-timer",
    correctElement: "grammar-correct",
    streakElement: "grammar-streak"
  },
  reading: {
    duration: state.readingDuration,
    timeLeft: state.readingDuration,
    correct: 0,
    streak: 0,
    timerId: null,
    timerElement: "reading-timer",
    correctElement: "reading-correct",
    streakElement: "reading-streak"
  },
  quiz: {
    duration: state.quizDuration,
    timeLeft: state.quizDuration,
    correct: 0,
    streak: 0,
    timerId: null,
    timerElement: "quiz-timer",
    correctElement: "quiz-correct",
    streakElement: "quiz-streak"
  },
  kana: {
    duration: 5,
    timeLeft: 5,
    correct: 0,
    streak: 0,
    timerId: null,
    timerElement: "kana-quiz-timer",
    correctElement: "kana-quiz-correct",
    streakElement: "kana-quiz-streak"
  },
  starterKanji: {
    duration: state.starterKanjiQuizDuration,
    timeLeft: state.starterKanjiQuizDuration,
    correct: 0,
    streak: 0,
    timerId: null,
    timerElement: "starter-kanji-timer",
    correctElement: "starter-kanji-correct",
    streakElement: "starter-kanji-streak"
  }
};

function stopQuizSessionTimer(key) {
  const session = quizSessions[key];

  if (!session || !session.timerId) {
    return;
  }

  window.clearInterval(session.timerId);
  session.timerId = null;
}

function updateQuizTimerItem(timerItem, progress, warning, isStatic) {
  const nextProgress = progress.toFixed(3);
  const previousProgress = Number(timerItem.dataset.timerProgress || "1");
  const shouldReset = progress > previousProgress + 0.01;

  timerItem.classList.add("is-timer");
  timerItem.classList.toggle("is-warning", warning);
  timerItem.classList.toggle("is-static", isStatic);

  if (shouldReset) {
    timerItem.classList.add("is-resetting");
  }

  timerItem.style.setProperty("--timer-progress", nextProgress);
  timerItem.dataset.timerProgress = nextProgress;

  if (shouldReset) {
    window.requestAnimationFrame(() => {
      timerItem.classList.remove("is-resetting");
    });
  }
}

function renderQuizSessionHud(key) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  const timer = document.getElementById(session.timerElement);
  const correct = document.getElementById(session.correctElement);
  const streak = document.getElementById(session.streakElement);

  if (!timer && !correct && !streak) {
    return;
  }

  if (timer) {
    const warning = session.duration > 0 && session.timeLeft <= Math.max(5, Math.floor(session.duration / 3));
    const timerItem = timer.closest(".quiz-hud-item");
    const progress = session.duration > 0 ? Math.max(0, Math.min(1, session.timeLeft / session.duration)) : 0;

    timer.textContent = session.duration <= 0 ? "천천히" : `${session.timeLeft}초`;
    timer.classList.toggle(
      "is-warning",
      warning
    );

    if (timerItem) {
      updateQuizTimerItem(timerItem, progress, warning, session.duration <= 0);
    }
  }

  if (correct) {
    correct.textContent = String(session.correct);
  }

  if (streak) {
    streak.textContent = String(session.streak);
  }
}

function setQuizSessionDuration(key, duration) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  const nextDuration = Math.max(0, Number(duration) || 0);
  stopQuizSessionTimer(key);
  session.duration = nextDuration;
  session.timeLeft = nextDuration;
  renderQuizSessionHud(key);
}

function resetQuizSessionTimer(key, onExpire) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  const timer = document.getElementById(session.timerElement);

  if (!timer) {
    stopQuizSessionTimer(key);
    return;
  }

  stopQuizSessionTimer(key);
  session.timeLeft = session.duration;
  renderQuizSessionHud(key);

  if (session.duration <= 0) {
    return;
  }

  session.timerId = window.setInterval(() => {
    session.timeLeft = Math.max(0, session.timeLeft - 1);
    renderQuizSessionHud(key);

    if (session.timeLeft === 0) {
      stopQuizSessionTimer(key);
      onExpire();
    }
  }, 1000);
}

function finalizeQuizSession(key, correct) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  stopQuizSessionTimer(key);

  if (correct) {
    session.correct += 1;
    session.streak += 1;
  } else {
    session.streak = 0;
  }

  renderQuizSessionHud(key);
}

function saveState() {
  const syncStore = getStudyStateStore();

  if (syncStore) {
    syncStore.writeValue(storageKey, state);
    return;
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    // Ignore storage failures so UI interactions still work in restricted environments.
  }
}

function resetStateDrivenQuizSessions() {
  stopQuizSessionTimer("vocab");
  stopQuizSessionTimer("grammar");
  stopQuizSessionTimer("reading");
  stopQuizSessionTimer("quiz");
  stopQuizSessionTimer("starterKanji");
  quizSessions.vocab.correct = 0;
  quizSessions.vocab.streak = 0;
  quizSessions.grammar.correct = 0;
  quizSessions.grammar.streak = 0;
  quizSessions.reading.correct = 0;
  quizSessions.reading.streak = 0;
  quizSessions.quiz.correct = 0;
  quizSessions.quiz.streak = 0;
  quizSessions.starterKanji.correct = 0;
  quizSessions.starterKanji.streak = 0;
  setQuizSessionDuration("vocab", state.vocabQuizDuration);
  setQuizSessionDuration("grammar", state.grammarPracticeDuration);
  setQuizSessionDuration("reading", state.readingDuration);
  setQuizSessionDuration("quiz", state.quizDuration);
  setQuizSessionDuration("starterKanji", state.starterKanjiQuizDuration);
}

function applyExternalStudyState(nextState) {
  state = normalizeLoadedState({
    ...defaultState,
    ...(nextState || {})
  });
  resetStateDrivenQuizSessions();
  renderAll();
}

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateStudyStreak() {
  const today = getLocalDateKey();

  if (state.lastStudyDate === today) {
    return;
  }

  if (!state.lastStudyDate) {
    state.streak = 1;
  } else {
    const last = new Date(state.lastStudyDate);
    const current = new Date(today);
    const diffDays = Math.round((current - last) / 86400000);
    state.streak = diffDays === 1 ? state.streak + 1 : 1;
  }

  state.lastStudyDate = today;
  saveState();
}

function renderStarterPath() {
  const grid = document.getElementById("starter-grid");
  const progress = document.getElementById("starter-progress");
  const completedCount = state.starterDoneIds.length;

  if (!grid || !progress) {
    return;
  }

  progress.textContent = `${completedCount} / ${starterItems.length}`;
  grid.innerHTML = "";

  starterItems.forEach((item) => {
    const article = document.createElement("article");
    const done = state.starterDoneIds.includes(item.id);

    article.className = `starter-item${done ? " is-done" : ""}`;
    article.innerHTML = `
      <div class="starter-item-head">
        <span class="starter-track">${item.track}</span>
        <span>${done ? "해봤어요" : item.duration}</span>
      </div>
      <h3>${item.title}</h3>
      <p>${item.detail}</p>
      <div class="starter-item-actions">
        <button class="secondary-btn starter-learn" type="button">바로 해볼까요?</button>
        <button class="secondary-btn starter-toggle${done ? " is-checked" : ""}" type="button">
          ${done ? "한 번 더 해봐요" : "해봤어요"}
        </button>
      </div>
    `;

    article.querySelector(".starter-learn").addEventListener("click", () => {
      if (item.module === "hiragana" || item.module === "katakana") {
        window.location.href = "characters.html";
        return;
      }

      if (item.module === "kanji") {
        window.location.href = "kanji.html";
        return;
      }

      state.basicPracticeTrack = item.module;
      saveState();
      renderBasicPractice();
      document.getElementById("basic-drill").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    article.querySelector(".starter-toggle").addEventListener("click", () => {
      if (done) {
        state.starterDoneIds = state.starterDoneIds.filter((id) => id !== item.id);
      } else {
        state.starterDoneIds.push(item.id);
        updateStudyStreak();
      }

      saveState();
      renderStarterPath();
      renderStats();
    });

    grid.appendChild(article);
  });
}

function getCurrentBasicPracticeSet() {
  const trackKey = basicPracticeSets[state.basicPracticeTrack] ? state.basicPracticeTrack : "hiragana";
  const track = basicPracticeSets[trackKey];
  const currentIndex = state.basicPracticeIndexes[trackKey] % track.items.length;
  return track.items[currentIndex];
}

function renderBasicPractice() {
  const switcher = document.getElementById("basic-practice-switcher");
  const card = document.querySelector("#basic-drill .basic-practice-card");
  const optionsContainer = document.getElementById("basic-practice-options");
  const trackLabel = document.getElementById("basic-practice-track");
  const source = document.getElementById("basic-practice-source");
  const progress = document.getElementById("basic-practice-progress");
  const title = document.getElementById("basic-practice-title");
  const note = document.getElementById("basic-practice-note");
  const prompt = document.getElementById("basic-practice-prompt");
  const display = document.getElementById("basic-practice-display");
  const displaySub = document.getElementById("basic-practice-display-sub");
  const feedback = document.getElementById("basic-practice-feedback");
  const explanation = document.getElementById("basic-practice-explanation");
  const availableTracks = getAvailableBasicPracticeTracks();
  const fallbackTrack = availableTracks[0] || "hiragana";
  const trackKey =
    basicPracticeSets[state.basicPracticeTrack] && availableTracks.includes(state.basicPracticeTrack)
      ? state.basicPracticeTrack
      : fallbackTrack;
  if (state.basicPracticeTrack !== trackKey) {
    state.basicPracticeTrack = trackKey;
  }
  const track = basicPracticeSets[trackKey];
  const current = getCurrentBasicPracticeSet();

  if (
    !switcher ||
    !card ||
    !optionsContainer ||
    !trackLabel ||
    !source ||
    !progress ||
    !title ||
    !note ||
    !prompt ||
    !display ||
    !displaySub ||
    !feedback ||
    !explanation
  ) {
    return;
  }

  switcher.innerHTML = "";

  availableTracks.forEach((key) => {
    const value = basicPracticeSets[key];
    if (!value) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = `level-button${state.basicPracticeTrack === key ? " is-active" : ""}`;
    button.textContent = basicPracticeTrackLabels[key] || value.label;
    button.addEventListener("click", () => {
      state.basicPracticeTrack = key;
      saveState();
      renderBasicPractice();
    });
    switcher.appendChild(button);
  });

  trackLabel.textContent = basicPracticeTrackLabels[trackKey] || track.label;
  source.textContent = formatQuizLineBreaks(current.source);
  progress.textContent =
    `${(state.basicPracticeIndexes[trackKey] % track.items.length) + 1} / ${track.items.length}`;
  title.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(current.title));
  note.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(current.note));
  prompt.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(current.prompt));
  display.textContent = formatQuizLineBreaks(current.display);
  displaySub.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(current.displaySub || ""));
  feedback.textContent = "";
  explanation.textContent = formatQuizLineBreaks(softenExplanationCopy(current.explanation || ""));

  card.className = `basic-practice-card ${current.tone || "tone-coral"}`;

  optionsContainer.innerHTML = "";
  current.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "basic-practice-option";
    button.textContent = formatQuizLineBreaks(option);
    button.addEventListener("click", () => handleBasicPracticeAnswer(index));
    optionsContainer.appendChild(button);
  });

  resetQuizSessionTimer("basic", handleBasicPracticeTimeout);
}

function handleBasicPracticeAnswer(index) {
  const current = getCurrentBasicPracticeSet();
  const options = document.querySelectorAll("#basic-practice-options .basic-practice-option");
  const alreadyAnswered = Array.from(options).some((item) => item.disabled);

  if (alreadyAnswered) {
    return;
  }

  const correct = index === current.answer;
  finalizeQuizSession("basic", correct);

  options.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === index) {
      item.classList.add("is-selected");
    }
    if (optionIndex === current.answer) {
      item.classList.add("is-correct");
    }
    if (optionIndex === index && !correct) {
      item.classList.add("is-wrong");
    }
  });

  document.getElementById("basic-practice-feedback").textContent = correct
    ? "좋아요!"
    : "아깝네요! 정답 같이 볼까요?";
  document.getElementById("basic-practice-explanation").textContent = softenExplanationCopy(current.explanation);

  updateStudyStreak();
  saveState();
  renderStats();
}

function handleBasicPracticeTimeout() {
  const current = getCurrentBasicPracticeSet();
  const options = document.querySelectorAll("#basic-practice-options .basic-practice-option");
  const alreadyAnswered = Array.from(options).some((item) => item.disabled);

  if (alreadyAnswered) {
    return;
  }

  finalizeQuizSession("basic", false);

  options.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === current.answer) {
      item.classList.add("is-correct");
    }
  });

  document.getElementById("basic-practice-feedback").textContent = "";
  document.getElementById("basic-practice-explanation").textContent = softenExplanationCopy(current.explanation);

  updateStudyStreak();
  saveState();
  renderStats();
}

function nextBasicPracticeSet() {
  const trackKey = basicPracticeSets[state.basicPracticeTrack] ? state.basicPracticeTrack : "hiragana";
  const track = basicPracticeSets[trackKey];
  state.basicPracticeIndexes[trackKey] =
    (state.basicPracticeIndexes[trackKey] + 1) % track.items.length;
  saveState();
  renderBasicPractice();
}

function saveKanjiToReviewList(id) {
  if (!id) {
    return;
  }

  if (!state.kanjiReviewIds.includes(id)) {
    state.kanjiReviewIds.push(id);
  }

  state.kanjiMasteredIds = state.kanjiMasteredIds.filter((itemId) => itemId !== id);
}

function removeKanjiFromReviewList(id) {
  if (!id) {
    return;
  }

  state.kanjiReviewIds = state.kanjiReviewIds.filter((itemId) => itemId !== id);
}

function saveKanjiToMasteredList(id) {
  if (!id) {
    return;
  }

  if (!state.kanjiMasteredIds.includes(id)) {
    state.kanjiMasteredIds.push(id);
  }

  state.kanjiReviewIds = state.kanjiReviewIds.filter((itemId) => itemId !== id);
}

function removeKanjiFromMasteredList(id) {
  if (!id) {
    return;
  }

  state.kanjiMasteredIds = state.kanjiMasteredIds.filter((itemId) => itemId !== id);
}

function isKanjiSavedToReviewList(id) {
  return Boolean(id) && state.kanjiReviewIds.includes(id);
}

function isKanjiSavedToMasteredList(id) {
  return Boolean(id) && state.kanjiMasteredIds.includes(id);
}

function getKanjiCollectionItems(collectionFilter = state?.kanjiCollectionFilter) {
  const items = basicPracticeSets.kanji?.items || [];
  const activeCollectionFilter = getKanjiCollectionFilter(collectionFilter);

  if (activeCollectionFilter === "review") {
    return items.filter((item) => isKanjiSavedToReviewList(item.id));
  }

  if (activeCollectionFilter === "mastered") {
    return items.filter((item) => isKanjiSavedToMasteredList(item.id));
  }

  if (activeCollectionFilter === "unmarked") {
    return items.filter((item) => !isKanjiSavedToReviewList(item.id) && !isKanjiSavedToMasteredList(item.id));
  }

  return items;
}

function getVisibleKanjiItems(grade = state?.kanjiGrade, collectionFilter = state?.kanjiCollectionFilter) {
  const items = getKanjiCollectionItems(collectionFilter);
  const activeGrade = getKanjiGrade(grade);
  return activeGrade === allLevelValue ? items : items.filter((item) => item.grade === activeGrade);
}

function getKanjiCollectionCounts(items = basicPracticeSets.kanji?.items || []) {
  return {
    all: items.length,
    review: items.filter((item) => isKanjiSavedToReviewList(item.id)).length,
    mastered: items.filter((item) => isKanjiSavedToMasteredList(item.id)).length,
    unmarked: items.filter((item) => !isKanjiSavedToReviewList(item.id) && !isKanjiSavedToMasteredList(item.id)).length
  };
}

function getKanjiGradeCounts(items = basicPracticeSets.kanji?.items || []) {
  const counts = kanjiGradeOptions.reduce((map, grade) => {
    map[grade] = 0;
    return map;
  }, {});

  counts[allLevelValue] = items.length;
  items.forEach((item) => {
    const grade = String(item?.grade || "");
    if (Object.prototype.hasOwnProperty.call(counts, grade)) {
      counts[grade] += 1;
    }
  });

  return counts;
}

function populateKanjiCollectionSelect(select, counts, activeFilter = getKanjiCollectionFilter()) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  Object.entries(kanjiCollectionFilterLabels).forEach(([filter, label]) => {
    const option = document.createElement("option");
    option.value = filter;
    option.textContent = `${label} (${counts[filter] ?? 0})`;
    select.appendChild(option);
  });

  select.value = getKanjiCollectionFilter(activeFilter);
}

function populateKanjiGradeSelect(select, counts, activeGrade = getKanjiGrade()) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  kanjiGradeOptions.forEach((grade) => {
    const option = document.createElement("option");
    option.value = grade;
    option.textContent =
      grade === allLevelValue
        ? `전체 (${counts[grade] ?? 0})`
        : `${grade}학년 (${counts[grade] ?? 0})`;
    select.appendChild(option);
  });

  select.value = getKanjiGrade(activeGrade);
}

function buildStarterKanjiOptions(
  item,
  pool = getVisibleKanjiItems(),
  optionField = getStarterKanjiOptionField()
) {
  const correctAnswer = getStarterKanjiItemValue(item, optionField);
  const poolReadings = shuffleQuizArray(
    uniqueQuizValues(
      pool
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => getStarterKanjiItemValue(candidate, optionField))
        .filter((value) => value && value !== correctAnswer)
    )
  );
  const fallbackReadings = shuffleQuizArray(
    uniqueQuizValues(
      (basicPracticeSets.kanji?.items || [])
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => getStarterKanjiItemValue(candidate, optionField))
        .filter((value) => value && value !== correctAnswer && !poolReadings.includes(value))
    )
  );
  const options = [correctAnswer];

  [...poolReadings, ...fallbackReadings].forEach((value) => {
    if (options.length < 4 && !options.includes(value)) {
      options.push(value);
    }
  });

  return shuffleQuizArray(options);
}

function buildStarterKanjiQuestion(item, pool = getVisibleKanjiItems()) {
  if (!item) {
    return null;
  }

  const questionField = getStarterKanjiQuestionField();
  const optionField = getStarterKanjiOptionField();
  const options = buildStarterKanjiOptions(item, pool, optionField);
  const answerValue = getStarterKanjiItemValue(item, optionField);
  const answer = options.indexOf(answerValue);

  return {
    ...item,
    baseDisplay: item.display,
    baseReading: item.reading,
    questionField,
    optionField,
    prompt: getStarterKanjiPrompt(questionField),
    display: getStarterKanjiItemValue(item, questionField),
    displaySub: "",
    options,
    answer: answer >= 0 ? answer : 0
  };
}

function resetStarterKanjiQuestionOrder() {
  const items = getVisibleKanjiItems();

  if (!items.length) {
    starterKanjiQuestionOrder = [];
    starterKanjiOptionOrders = {};
    return;
  }

  starterKanjiQuestionOrder = shuffleQuizArray(items.map((_, index) => index));
  starterKanjiOptionOrders = {};
}

function getStarterKanjiQuestionCount() {
  const total = getVisibleKanjiItems().length;
  return Math.min(getStarterKanjiQuizCount(), total);
}

function resetStarterKanjiSessionState(resetIndex = false) {
  starterKanjiState.results = [];
  starterKanjiState.showResults = false;
  starterKanjiState.resultFilter = "all";
  resetStarterKanjiQuestionOrder();
  quizSessions.starterKanji.correct = 0;
  quizSessions.starterKanji.streak = 0;
  setQuizSessionDuration("starterKanji", getStarterKanjiQuizDuration());
  stopQuizSessionTimer("starterKanji");

  if (resetIndex) {
    state.basicPracticeIndexes.kanji = 0;
  }
}

function invalidateStarterKanjiSession() {
  resetStarterKanjiSessionState(true);
  state.starterKanjiQuizStarted = false;
  state.starterKanjiQuizFinished = false;
  state.starterKanjiQuizOptionsOpen = false;
}

function startNewStarterKanjiSession() {
  const questionCount = getStarterKanjiQuestionCount();

  if (questionCount <= 0) {
    state.starterKanjiQuizStarted = false;
    state.starterKanjiQuizFinished = false;
    return false;
  }

  resetStarterKanjiSessionState(true);
  state.starterKanjiQuizStarted = true;
  state.starterKanjiQuizFinished = false;
  return true;
}

function ensureStarterKanjiQuestionOrder() {
  const items = getVisibleKanjiItems();
  const questionCount = getStarterKanjiQuestionCount();

  if (!items.length) {
    starterKanjiQuestionOrder = [];
    state.basicPracticeIndexes.kanji = 0;
    return;
  }

  const hasValidOrder =
    starterKanjiQuestionOrder.length === items.length &&
    starterKanjiQuestionOrder.every(
      (value, index, source) =>
        Number.isInteger(value) &&
        value >= 0 &&
        value < items.length &&
        source.indexOf(value) === index
    );

  if (!hasValidOrder) {
    resetStarterKanjiQuestionOrder();
  }

  if (
    !Number.isFinite(Number(state.basicPracticeIndexes.kanji)) ||
    state.basicPracticeIndexes.kanji < 0 ||
    state.basicPracticeIndexes.kanji >= questionCount
  ) {
    state.basicPracticeIndexes.kanji = 0;
  }
}

function getCurrentStarterKanjiPracticeSet() {
  const items = getVisibleKanjiItems();
  ensureStarterKanjiQuestionOrder();

  if (!items.length || !starterKanjiQuestionOrder.length || getStarterKanjiQuestionCount() <= 0) {
    return null;
  }

  const questionIndex = starterKanjiQuestionOrder[state.basicPracticeIndexes.kanji];
  return buildStarterKanjiQuestion(items[questionIndex], items);
}

function getStarterKanjiOptionOrder(current) {
  if (!current?.options?.length) {
    return [];
  }

  const orderKey = current.id || `${current.source || "kanji"}-${current.display || "item"}`;
  const existingOrder = starterKanjiOptionOrders[orderKey];
  const hasValidOrder =
    Array.isArray(existingOrder) &&
    existingOrder.length === current.options.length &&
    existingOrder.every(
      (value, index, source) =>
        Number.isInteger(value) &&
        value >= 0 &&
        value < current.options.length &&
        source.indexOf(value) === index
    );

  if (!hasValidOrder) {
    starterKanjiOptionOrders[orderKey] = shuffleQuizArray(current.options.map((_, index) => index));
  }

  return starterKanjiOptionOrders[orderKey];
}

function getStarterKanjiResultFilter(value = starterKanjiState.resultFilter) {
  return Object.prototype.hasOwnProperty.call(starterKanjiResultFilterLabels, value) ? value : "all";
}

function getStarterKanjiOptionsSummaryText() {
  return [
    getStarterKanjiQuizConfigLabel(),
    getKanjiCollectionSummaryLabel(),
    getKanjiGradeSummaryLabel(),
    `${getStarterKanjiQuestionCount()}문제`,
    getDurationLabel(getStarterKanjiQuizDuration())
  ].join(" · ");
}

function getKanjiEmptyMessage(collectionFilter = state?.kanjiCollectionFilter, grade = state?.kanjiGrade) {
  const activeCollectionFilter = getKanjiCollectionFilter(collectionFilter);
  const activeGrade = getKanjiGrade(grade);

  if (activeCollectionFilter === "review") {
    return activeGrade === allLevelValue ? "다시 볼래요 한자가 아직 없어요." : `${getKanjiGradeSummaryLabel(activeGrade)} 다시 볼래요 한자가 아직 없어요.`;
  }

  if (activeCollectionFilter === "mastered") {
    return activeGrade === allLevelValue ? "익혔어요 한자가 아직 없어요." : `${getKanjiGradeSummaryLabel(activeGrade)} 익혔어요 한자가 아직 없어요.`;
  }

  if (activeCollectionFilter === "unmarked") {
    return activeGrade === allLevelValue ? "아직 안 정한 한자가 없어요." : `${getKanjiGradeSummaryLabel(activeGrade)} 아직 안 정한 한자가 없어요.`;
  }

  return activeGrade === allLevelValue ? "한자를 준비하고 있어요." : `${getKanjiGradeSummaryLabel(activeGrade)} 한자를 준비하고 있어요.`;
}

function getStudyResultCounts(results) {
  const safeResults = Array.isArray(results) ? results : [];

  return {
    all: safeResults.length,
    correct: safeResults.filter((item) => item.status === "correct").length,
    wrong: safeResults.filter((item) => item.status === "wrong").length
  };
}

function getFilteredStudyResults(results, filter = "all") {
  const safeResults = Array.isArray(results) ? results : [];

  if (filter === "all") {
    return [...safeResults];
  }

  return safeResults.filter((item) => item.status === filter);
}

function getStarterKanjiResultCounts() {
  return getStudyResultCounts(starterKanjiState.results);
}

function getFilteredStarterKanjiResults(filter = getStarterKanjiResultFilter(starterKanjiState.resultFilter)) {
  return getFilteredStudyResults(starterKanjiState.results, getStarterKanjiResultFilter(filter));
}

function setStarterKanjiResult(current, selectedIndex, correct, timedOut = false) {
  const answerText = current.options[current.answer] || "";
  const selected = timedOut ? "" : current.options[selectedIndex] || "";
  const result = {
    id: current.id,
    source: current.gradeLabel || current.source,
    char: current.baseDisplay || current.display,
    reading: current.baseReading || current.reading,
    questionField: current.questionField,
    optionField: current.optionField,
    answerText,
    meta: current.gradeLabel || current.note || "",
    selected,
    status: correct ? "correct" : "wrong",
    timedOut
  };
  const currentResultIndex = starterKanjiState.results.findIndex((item) => item.id === current.id);

  if (currentResultIndex >= 0) {
    starterKanjiState.results[currentResultIndex] = result;
    return;
  }

  starterKanjiState.results.push(result);
}

function renderStarterKanjiResultFilterOptions(counts) {
  const filterSelect = document.getElementById("starter-kanji-result-filter");

  renderResultFilterOptions({
    select: filterSelect,
    labels: starterKanjiResultFilterLabels,
    counts,
    activeValue: getStarterKanjiResultFilter(starterKanjiState.resultFilter)
  });
}

function renderStarterKanjiBulkActionButton(results) {
  const bulkActionButton = document.getElementById("starter-kanji-result-bulk-action");
  const bulkActionLabel = document.getElementById("starter-kanji-result-bulk-label");
  const bulkActionIcon = bulkActionButton?.querySelector(".material-symbols-rounded");

  renderResultBulkActionButton({
    button: bulkActionButton,
    label: bulkActionLabel,
    icon: bulkActionIcon,
    results,
    getId: (item) => item.id,
    isSaved: isKanjiSavedToReviewList,
    datasetKey: "starterKanjiBulkAction",
    saveActionValue: "save-review",
    removeActionValue: "remove-review",
    saveLabel: "전체 다시 볼래요",
    removeLabel: "전체 빼기",
    emptyTitle: "지금은 담을 한자가 없어요.",
    saveTitle: "지금 보이는 한자를 다시 볼래요에 모두 담을게요.",
    removeTitle: "지금 보이는 한자를 다시 볼래요에서 모두 뺄게요."
  });
}

function getStarterKanjiResultDetail(item) {
  const parts = [];

  if (item.status === "wrong" && item.timedOut) {
    parts.push("시간 초과");
  }

  if (item.optionField !== "reading" && item.reading) {
    parts.push(`발음 ${item.reading}`);
  }

  if (item.meta) {
    parts.push(item.meta);
  }

  return parts.join(" · ");
}

function createStudyStatusBadgesMarkup(review, mastered) {
  return [
    review ? '<span class="vocab-review-badge">다시 볼래요</span>' : "",
    mastered ? '<span class="vocab-mastered-badge">익혔어요!</span>' : ""
  ]
    .filter(Boolean)
    .join("");
}

function createStudyStatusButtonsMarkup({
  id,
  groupClassName,
  buttonClassName,
  reviewAttribute,
  masteredAttribute,
  reviewSelected,
  masteredSelected
}) {
  return `
    <div class="${groupClassName}">
      <button class="secondary-btn ${buttonClassName}${reviewSelected ? " is-selected-review" : ""}" type="button" ${reviewAttribute}="${id}" aria-pressed="${reviewSelected ? "true" : "false"}">다시 볼래요</button>
      <button class="secondary-btn ${buttonClassName}${masteredSelected ? " is-selected-mastered" : ""}" type="button" ${masteredAttribute}="${id}" aria-pressed="${masteredSelected ? "true" : "false"}">익혔어요!</button>
    </div>
  `;
}

function createKanjiStatusButtonsMarkup(id) {
  return createStudyStatusButtonsMarkup({
    id,
    groupClassName: "kanji-status-actions",
    buttonClassName: "kanji-status-btn",
    reviewAttribute: "data-kanji-review",
    masteredAttribute: "data-kanji-mastered",
    reviewSelected: isKanjiSavedToReviewList(id),
    masteredSelected: isKanjiSavedToMasteredList(id)
  });
}

function applyStudyActionButtonState(button, selected, selectedClass, idleClass, disabled) {
  if (!button) {
    return;
  }

  button.disabled = disabled;
  button.classList.toggle(selectedClass, selected);
  button.classList.toggle(idleClass, !selected);
}

function renderStudyFlashcardComponent({
  flashcard,
  toggle,
  prev,
  next,
  level,
  word,
  reading,
  meaning,
  hint,
  hasCards,
  isRevealed,
  revealWhenEmpty = false,
  levelText,
  wordText,
  readingText = "",
  meaningText = "",
  hintText = "",
  hideReading = false,
  toggleOpenLabel,
  toggleClosedLabel,
  toggleEmptyLabel,
  prevDisabled = false,
  nextDisabled = false,
  actionButtons = []
}) {
  if (!flashcard || !toggle || !level || !word || !reading || !meaning || !hint) {
    return;
  }

  level.textContent = formatQuizLineBreaks(levelText || "");
  word.textContent = formatQuizLineBreaks(wordText || "");
  reading.textContent = formatQuizLineBreaks(readingText || "");
  reading.hidden = hideReading || !normalizeQuizText(readingText || "");
  meaning.textContent = formatQuizLineBreaks(meaningText || "");
  hint.textContent = hintText;

  flashcard.classList.toggle("is-revealed", isRevealed || (revealWhenEmpty && !hasCards));
  flashcard.classList.toggle("is-empty", !hasCards);
  toggle.disabled = !hasCards;
  toggle.setAttribute("aria-expanded", String(isRevealed));
  toggle.setAttribute(
    "aria-label",
    hasCards ? (isRevealed ? toggleOpenLabel : toggleClosedLabel) : toggleEmptyLabel
  );

  if (prev) {
    prev.disabled = !hasCards || prevDisabled;
  }

  if (next) {
    next.disabled = !hasCards || nextDisabled;
  }

  actionButtons.forEach((action) => {
    applyStudyActionButtonState(
      action.button,
      action.selected,
      action.selectedClass,
      action.idleClass,
      !hasCards || action.disabled === true
    );
  });
}

function createStudyListCardMarkup({
  index,
  headMetaMarkup = "",
  badgesMarkup = "",
  mainClassName = "vocab-list-main",
  titleClassName = "vocab-list-word",
  titleText = "",
  subtitleClassName = "vocab-list-reading",
  subtitleText = "",
  descriptionMarkup = "",
  actionsMarkup = ""
}) {
  return `
    <article class="vocab-list-card">
      <div class="vocab-list-card-head">
        <div class="kanji-list-head-meta">
          <span class="vocab-list-index">${index}</span>
          ${headMetaMarkup}
        </div>
        <div class="vocab-status-badges">${badgesMarkup}</div>
      </div>
      <div class="${mainClassName}">
        <strong class="${titleClassName}">${titleText}</strong>
        <p class="${subtitleClassName}">${subtitleText}</p>
      </div>
      ${descriptionMarkup}
      ${actionsMarkup}
    </article>
  `;
}

function syncStudyViewButtons(selector, attributeName, activeValue) {
  document.querySelectorAll(selector).forEach((button) => {
    const active = button.getAttribute(attributeName) === activeValue;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderPagedStudyList({
  list,
  pageInfo,
  prev,
  next,
  items,
  page,
  pageSize,
  emptyMessage,
  onPageChange,
  renderItem
}) {
  if (!list || !pageInfo || !prev || !next) {
    return;
  }

  const safeItems = Array.isArray(items) ? items : [];
  const pageCount = Math.max(1, Math.ceil(safeItems.length / pageSize));
  const activePage = Math.min(Math.max(page, 1), pageCount);
  const startIndex = (activePage - 1) * pageSize;
  const pageItems = safeItems.slice(startIndex, startIndex + pageSize);

  if (activePage !== page && typeof onPageChange === "function") {
    onPageChange(activePage);
  }

  pageInfo.textContent = `${activePage} / ${pageCount}`;
  prev.disabled = activePage <= 1;
  next.disabled = activePage >= pageCount;

  if (!pageItems.length) {
    list.innerHTML = `<p class="vocab-list-empty">${emptyMessage}</p>`;
    return;
  }

  list.innerHTML = pageItems
    .map((item, index) => renderItem(item, startIndex + index + 1))
    .join("");
}

function toggleStudyFlashcardReveal(revealedKey, render) {
  state[revealedKey] = !state[revealedKey];
  updateStudyStreak();
  saveState();
  render();
}

function moveStudyFlashcard(step, { getCards, indexKey, revealedKey, render }) {
  const cards = getCards();

  if (!cards.length) {
    return;
  }

  state[indexKey] = (state[indexKey] + step + cards.length) % cards.length;
  state[revealedKey] = false;
  saveState();
  render();
}

function markStudyFlashcardStatus({
  getCards,
  indexKey,
  revealedKey,
  saveItem,
  syncIndexAfterUpdate,
  render
}) {
  const cards = getCards();

  if (!cards.length) {
    return;
  }

  const currentIndex = state[indexKey] % cards.length;
  const currentCard = cards[currentIndex];

  saveItem(currentCard.id);
  updateStudyStreak();
  state[revealedKey] = false;
  syncIndexAfterUpdate(currentCard.id, currentIndex);
  saveState();
  render();
}

function setElementHidden(element, hidden) {
  if (element) {
    element.hidden = hidden;
  }
}

function scrollElementIntoView(element) {
  if (!element?.scrollIntoView) {
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      element.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  });
}

function scrollToElementById(id) {
  scrollElementIntoView(document.getElementById(id));
}

function applyPageHeading(titleElement, copyElement, heading) {
  if (titleElement) {
    titleElement.textContent = heading?.title || "";
  }

  if (copyElement) {
    copyElement.textContent = heading?.description || "";
    copyElement.hidden = !heading?.description;
  }
}

function syncTabButtonsAndPanels({
  buttonSelector,
  panelSelector,
  buttonAttribute,
  panelAttribute,
  activeValue
}) {
  document.querySelectorAll(buttonSelector).forEach((button) => {
    const isActive = button.dataset[buttonAttribute] === activeValue;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  document.querySelectorAll(panelSelector).forEach((panel) => {
    const isActive = panel.dataset[panelAttribute] === activeValue;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", String(!isActive));
  });
}

function syncStudyViewPanels(cardView, listView, activeView) {
  setElementHidden(cardView, activeView !== "card");
  setElementHidden(listView, activeView !== "list");
}

function renderStudyCatalogSection({ cardView, listView, activeView, renderFlashcard, renderList }) {
  syncStudyViewPanels(cardView, listView, activeView);

  if (typeof renderFlashcard === "function") {
    renderFlashcard();
  }

  if (typeof renderList === "function") {
    renderList();
  }
}

function renderCollapsibleSettingsSection({
  shell,
  toggle,
  panel,
  summary,
  summaryText,
  isLocked,
  shouldShowPanel
}) {
  if (summary) {
    summary.textContent = summaryText;
  }

  if (shell) {
    shell.classList.toggle("is-open", shouldShowPanel);
  }

  if (toggle) {
    toggle.disabled = isLocked;
    toggle.setAttribute("aria-expanded", String(shouldShowPanel));
  }

  if (panel) {
    panel.hidden = !shouldShowPanel;
    panel.setAttribute("aria-hidden", String(!shouldShowPanel));
  }
}

function renderOpenableSettingsSection({ shell, toggle, panel, summary, summaryText, isOpen }) {
  renderCollapsibleSettingsSection({
    shell,
    toggle,
    panel,
    summary,
    summaryText,
    isLocked: false,
    shouldShowPanel: isOpen
  });
}

function syncSelectionButtonState(buttons, getValue, activeValue) {
  buttons.forEach((button) => {
    const active = getValue(button) === activeValue;

    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderRestartableActionButton(button, label, isStarted, canStart) {
  if (button) {
    button.classList.toggle("primary-btn", !isStarted);
    button.classList.toggle("secondary-btn", isStarted);
    button.disabled = !canStart;
  }

  if (label) {
    label.textContent = isStarted ? "다시 해볼까요?" : "시작해볼까요?";
  }

  setActionButtonIcon(button, isStarted ? "autorenew" : "play_arrow");
}

function formatQuestionCountLabel(count) {
  return `${Number(count)}문제`;
}

function renderSpinnerControl({ spinner, options = [], activeValue, formatValue, disabled = false }) {
  if (!spinner) {
    return;
  }

  const valueElement = spinner.querySelector("[data-spinner-value]");
  const directionButtons = spinner.querySelectorAll("[data-spinner-direction]");
  const currentIndex = options.indexOf(activeValue);
  const safeValue = currentIndex >= 0 ? activeValue : options[0];

  if (valueElement) {
    valueElement.textContent = typeof formatValue === "function" ? formatValue(safeValue) : String(safeValue ?? "");
  }

  spinner.classList.toggle("is-disabled", Boolean(disabled));

  directionButtons.forEach((button) => {
    const direction = Number(button.dataset.spinnerDirection);
    const nextIndex = currentIndex + direction;
    button.disabled = Boolean(disabled) || currentIndex < 0 || nextIndex < 0 || nextIndex >= options.length;
  });
}

function renderSpinnerControls(configs = []) {
  configs.forEach((config) => {
    renderSpinnerControl(config);
  });
}

function applySelectFieldState({ element, value, populate, disabled }) {
  if (!element) {
    return;
  }

  if (typeof populate === "function") {
    populate(element, value);
  } else if (value !== undefined) {
    element.value = value;
  }

  element.disabled = Boolean(disabled);
}

function renderStudyOptionsControls({
  shell,
  toggle,
  panel,
  summary,
  summaryText,
  isLocked,
  isOpen,
  spinnerConfigs = [],
  selectConfigs = [],
  actionButton
}) {
  renderCollapsibleSettingsSection({
    shell,
    toggle,
    panel,
    summary,
    summaryText,
    isLocked,
    shouldShowPanel: !isLocked && isOpen
  });

  if (actionButton) {
    renderRestartableActionButton(actionButton.button, actionButton.label, actionButton.isStarted, actionButton.canStart);
  }

  renderSpinnerControls(spinnerConfigs);

  selectConfigs.forEach(({ element, value, populate, disabled = isLocked }) => {
    applySelectFieldState({
      element,
      value,
      populate,
      disabled
    });
  });
}

function renderStudyCatalogControls({
  summary,
  summaryText,
  viewSelector,
  viewAttribute,
  activeView,
  selectConfigs = []
}) {
  if (summary) {
    summary.textContent = summaryText;
  }

  if (viewSelector && viewAttribute) {
    syncStudyViewButtons(viewSelector, viewAttribute, activeView);
  }

  selectConfigs.forEach(({ element, populate }) => {
    if (typeof populate === "function") {
      populate(element);
    }
  });
}

function renderChoiceOptionButtons({
  container,
  options = [],
  buttonClassName,
  getButtonText = (option) => option,
  getOptionValue = (_, index) => index,
  formatText = (text) => String(text ?? ""),
  onSelect,
  datasetKey,
  setPressedState = false
}) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  options.forEach((option, index) => {
    const value = getOptionValue(option, index);
    const button = document.createElement("button");

    button.type = "button";
    button.className = buttonClassName;
    button.textContent = formatText(getButtonText(option, index, value));

    if (datasetKey) {
      button.dataset[datasetKey] = String(value);
    }

    if (setPressedState) {
      button.setAttribute("aria-pressed", "false");
    }

    button.addEventListener("click", () => {
      if (typeof onSelect === "function") {
        onSelect(value, option, index);
      }
    });
    container.appendChild(button);
  });
}

function applyChoiceOptionFeedback({
  options,
  isCorrectOption,
  isSelectedOption = () => false,
  markSelected = true,
  setPressedState = false
}) {
  options.forEach((item, optionIndex) => {
    const isSelected = isSelectedOption(item, optionIndex);
    const isCorrect = isCorrectOption(item, optionIndex);

    item.disabled = true;

    if (setPressedState) {
      item.setAttribute("aria-pressed", String(isSelected));
    }

    if (markSelected && isSelected) {
      item.classList.add("is-selected");
    }

    if (isCorrect) {
      item.classList.add("is-correct");
    }

    if (isSelected && !isCorrect) {
      item.classList.add("is-wrong");
    }
  });
}

function hasAnsweredChoiceOptions(options) {
  return Array.from(options).some((item) => item.disabled);
}

function hasAnsweredAllChoiceOptions(options) {
  const list = Array.from(options);
  return list.length > 0 && list.every((item) => item.disabled);
}

function attachStateSpinner({
  spinner,
  options = [],
  getCurrentValue,
  setValue,
  invalidate,
  render
}) {
  if (!spinner) {
    return;
  }

  spinner.querySelectorAll("[data-spinner-direction]").forEach((button) => {
    button.addEventListener("click", () => {
      const currentValue = getCurrentValue();
      const currentIndex = options.indexOf(currentValue);

      if (currentIndex < 0) {
        return;
      }

      const nextIndex = currentIndex + Number(button.dataset.spinnerDirection);

      if (nextIndex < 0 || nextIndex >= options.length) {
        return;
      }

      const nextValue = options[nextIndex];

      if (currentValue === nextValue) {
        return;
      }

      setValue(nextValue);
      invalidate();
      saveState();
      render();
    });
  });
}

function attachStateOptionsToggle(button, stateKey, render) {
  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    state[stateKey] = !state[stateKey];
    saveState();
    render();
  });
}

function attachValueButtonListeners(buttons, getValue, onChange) {
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      onChange(getValue(button), button);
    });
  });
}

function attachSelectValueListener(element, handler) {
  if (!element) {
    return;
  }

  element.addEventListener("change", () => {
    handler(element.value);
  });
}

function attachLinkedFieldSelectors({
  questionSelect,
  optionSelect,
  getQuestionField,
  getOptionField,
  normalizeQuestionField,
  normalizeOptionField,
  normalizeStoredQuestionField,
  normalizeStoredOptionField,
  getDefaultOptionField,
  getDefaultQuestionField,
  questionStateKey,
  optionStateKey,
  invalidate,
  render
}) {
  if (questionSelect) {
    questionSelect.addEventListener("change", () => {
      const previousQuestionField = getQuestionField();
      const previousOptionField = getOptionField();
      const nextQuestionField = normalizeQuestionField(questionSelect.value);

      if (previousQuestionField === nextQuestionField) {
        return;
      }

      state[questionStateKey] = nextQuestionField;

      if (previousOptionField === nextQuestionField) {
        state[optionStateKey] =
          previousQuestionField !== nextQuestionField
            ? previousQuestionField
            : getDefaultOptionField(nextQuestionField);
      }

      state[optionStateKey] = normalizeStoredOptionField(state[optionStateKey], state[questionStateKey]);
      invalidate();
      saveState();
      render();
    });
  }

  if (optionSelect) {
    optionSelect.addEventListener("change", () => {
      const previousQuestionField = getQuestionField();
      const previousOptionField = getOptionField();
      const nextOptionField = normalizeOptionField(optionSelect.value, previousOptionField);

      if (previousOptionField === nextOptionField) {
        return;
      }

      state[optionStateKey] = nextOptionField;

      if (previousQuestionField === nextOptionField) {
        state[questionStateKey] =
          previousOptionField !== nextOptionField
            ? previousOptionField
            : getDefaultQuestionField(nextOptionField);
      }

      state[questionStateKey] = normalizeStoredQuestionField(state[questionStateKey]);
      state[optionStateKey] = normalizeStoredOptionField(state[optionStateKey], state[questionStateKey]);
      invalidate();
      saveState();
      render();
    });
  }
}

function renderResultFilterOptions({ select, labels, counts, activeValue }) {
  if (!select) {
    return;
  }

  select.innerHTML = Object.keys(labels)
    .map((filter) => `<option value="${filter}">${labels[filter]} (${counts[filter] ?? 0})</option>`)
    .join("");
  select.value = activeValue;
}

function getUniqueStudyResultIds(results, getId = (item) => item?.id) {
  return Array.from(
    new Set((Array.isArray(results) ? results : []).map((item) => getId(item)).filter(Boolean))
  );
}

function renderResultBulkActionButton({
  button,
  label,
  icon,
  results,
  getId,
  isSaved,
  datasetKey,
  saveActionValue = "save",
  removeActionValue = "remove",
  saveLabel,
  removeLabel,
  emptyTitle,
  saveTitle,
  removeTitle
}) {
  if (!button || !label || !icon) {
    return;
  }

  const uniqueIds = getUniqueStudyResultIds(results, getId);
  const allSaved = uniqueIds.length > 0 && uniqueIds.every((id) => isSaved(id));
  const actionTitle =
    uniqueIds.length === 0
      ? emptyTitle
      : allSaved
        ? removeTitle
        : saveTitle;

  button.disabled = uniqueIds.length === 0;
  button.dataset[datasetKey] = allSaved ? removeActionValue : saveActionValue;
  button.setAttribute("aria-label", actionTitle);
  button.title = actionTitle;
  label.textContent = allSaved ? removeLabel : saveLabel;
  icon.textContent = allSaved ? "delete_sweep" : "bookmark_add";
}

function renderStudyResultSection({
  total,
  correct,
  wrong,
  empty,
  list,
  counts,
  filteredResults,
  emptyMessage,
  renderItems
}) {
  total.textContent = String(counts.all);
  correct.textContent = String(counts.correct);
  wrong.textContent = String(counts.wrong);

  if (!filteredResults.length) {
    empty.hidden = false;
    empty.textContent = emptyMessage;
    list.innerHTML = "";
    return false;
  }

  empty.hidden = true;
  list.innerHTML = "";
  renderItems(filteredResults, list);
  return true;
}

function createQuizResultSaveButton({
  id,
  saved,
  actionLabel,
  datasetKey
}) {
  const actionButton = document.createElement("button");
  const actionIcon = document.createElement("span");

  actionButton.className = `secondary-btn match-save-btn icon-only-btn${saved ? " is-saved" : ""}`;
  actionButton.type = "button";
  actionButton.dataset[datasetKey] = id;
  actionButton.setAttribute("aria-label", actionLabel);
  actionButton.setAttribute("aria-pressed", saved ? "true" : "false");
  actionButton.title = actionLabel;

  actionIcon.className = "material-symbols-rounded";
  actionIcon.setAttribute("aria-hidden", "true");
  actionIcon.textContent = saved ? "delete" : "bookmark_add";

  actionButton.appendChild(actionIcon);
  return actionButton;
}

function appendQuizResultItem({
  container,
  status,
  levelText,
  titleText,
  descriptionText,
  saved,
  saveActionLabel,
  saveDatasetKey,
  saveId
}) {
  const article = document.createElement("article");
  const head = document.createElement("div");
  const badges = document.createElement("div");
  const statusBadge = document.createElement("span");
  const levelBadge = document.createElement("span");
  const main = document.createElement("div");
  const title = document.createElement("strong");
  const description = document.createElement("p");
  const statusLabel = status === "correct" ? "정답" : "오답";

  article.className = `match-result-item is-${status}`;
  head.className = "match-result-item-head";
  badges.className = "match-result-item-badges";
  statusBadge.className = `match-result-badge is-${status}`;
  statusBadge.textContent = statusLabel;
  levelBadge.className = "match-result-level";
  levelBadge.textContent = levelText;
  main.className = "match-result-item-main";
  title.textContent = titleText;
  description.textContent = descriptionText;

  badges.append(statusBadge, levelBadge);
  head.append(
    badges,
    createQuizResultSaveButton({
      id: saveId,
      saved,
      actionLabel: saveActionLabel,
      datasetKey: saveDatasetKey
    })
  );
  main.append(title, description);
  article.append(head, main);
  container.appendChild(article);
}

function attachResultFilterSelectListener({
  select,
  getNextValue,
  getCurrentValue,
  setValue,
  shouldSaveState = false,
  render
}) {
  if (!select) {
    return;
  }

  select.addEventListener("change", () => {
    const nextValue = getNextValue(select.value);

    if (getCurrentValue() === nextValue) {
      return;
    }

    setValue(nextValue);

    if (shouldSaveState) {
      saveState();
    }

    render();
  });
}

function attachBulkResultActionListener({
  button,
  getResults,
  getId = (item) => item?.id,
  datasetKey,
  removeActionValue = "remove",
  removeItem,
  saveItem,
  shouldSaveState = true,
  render
}) {
  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    const uniqueIds = getUniqueStudyResultIds(getResults(), getId);

    if (!uniqueIds.length) {
      return;
    }

    const shouldRemove = button.dataset[datasetKey] === removeActionValue;

    uniqueIds.forEach((id) => {
      if (shouldRemove) {
        removeItem(id);
      } else {
        saveItem(id);
      }
    });

    if (shouldSaveState) {
      saveState();
    }

    render();
  });
}

function attachToggleResultActionListener({
  list,
  selector,
  getId,
  isSelected,
  selectItem,
  unselectItem,
  shouldSaveState = true,
  shouldUpdateStudyStreak = false,
  render
}) {
  if (!list) {
    return;
  }

  list.addEventListener("click", (event) => {
    const button = event.target.closest(selector);

    if (!button) {
      return;
    }

    const id = getId(button);

    if (!id) {
      return;
    }

    if (isSelected(id)) {
      unselectItem(id);
    } else {
      selectItem(id);
    }

    if (shouldUpdateStudyStreak) {
      updateStudyStreak();
    }

    if (shouldSaveState) {
      saveState();
    }

    render();
  });
}

function renderStarterKanjiResults() {
  const total = document.getElementById("starter-kanji-result-total");
  const correct = document.getElementById("starter-kanji-result-correct");
  const wrong = document.getElementById("starter-kanji-result-wrong");
  const empty = document.getElementById("starter-kanji-result-empty");
  const list = document.getElementById("starter-kanji-result-list");
  const filterSelect = document.getElementById("starter-kanji-result-filter");
  const bulkActionButton = document.getElementById("starter-kanji-result-bulk-action");
  const counts = getStarterKanjiResultCounts();
  const filteredResults = getFilteredStarterKanjiResults();

  if (!total || !correct || !wrong || !empty || !list || !filterSelect || !bulkActionButton) {
    return;
  }

  renderStarterKanjiResultFilterOptions(counts);
  renderStarterKanjiBulkActionButton(filteredResults);

  const hasResults = renderStudyResultSection({
    total,
    correct,
    wrong,
    empty,
    list,
    counts,
    filteredResults,
    emptyMessage: `${starterKanjiResultFilterLabels[getStarterKanjiResultFilter(starterKanjiState.resultFilter)]} 결과가 없어요.`,
    renderItems: (results, container) => {
      results.forEach((item) => {
        const saved = isKanjiSavedToReviewList(item.id);
        const actionLabel = saved ? "다시 볼래요에서 빼기" : "다시 볼래요에 담기";

        appendQuizResultItem({
          container,
          status: item.status,
          levelText: item.source || "한자",
          titleText: item.reading ? `${item.char || "-"} · ${item.reading}` : item.char || "-",
          descriptionText: getStarterKanjiResultDetail(item),
          saved,
          saveActionLabel: actionLabel,
          saveDatasetKey: "kanjiResultSave",
          saveId: item.id
        });
      });
    }
  });

  if (!hasResults) {
    return;
  }
}

function setActionButtonIcon(button, iconName) {
  const icon = button?.querySelector(".material-symbols-rounded");

  if (icon) {
    icon.textContent = iconName;
  }
}

function renderStarterKanjiControls() {
  const optionsShell = document.getElementById("starter-kanji-options-shell");
  const optionsToggle = document.getElementById("starter-kanji-options-toggle");
  const optionsPanel = document.getElementById("starter-kanji-options-panel");
  const optionsSummary = document.getElementById("starter-kanji-options-summary");
  const questionFieldSelect = document.getElementById("starter-kanji-question-field");
  const optionFieldSelect = document.getElementById("starter-kanji-option-field");
  const collectionSelect = document.getElementById("starter-kanji-collection-select");
  const gradeSelect = document.getElementById("starter-kanji-grade-select");
  const startButton = document.getElementById("starter-kanji-start");
  const startLabel = document.getElementById("starter-kanji-start-label");
  const countSpinner = document.querySelector('[data-spinner-id="starter-kanji-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="starter-kanji-time"]');
  const isOptionsOpen = state.starterKanjiQuizOptionsOpen === true;
  const activeCount = getStarterKanjiQuizCount();
  const activeDuration = getStarterKanjiQuizDuration();
  const activeQuestionField = getStarterKanjiQuestionField();
  const activeOptionField = getStarterKanjiOptionField();
  const collectionCounts = getKanjiCollectionCounts();
  const gradeCounts = getKanjiGradeCounts(getKanjiCollectionItems());
  const canStart = getStarterKanjiQuestionCount() > 0;
  const isSettingsLocked = state.starterKanjiQuizStarted && !state.starterKanjiQuizFinished;

  renderStudyOptionsControls({
    shell: optionsShell,
    toggle: optionsToggle,
    panel: optionsPanel,
    summary: optionsSummary,
    summaryText: getStarterKanjiOptionsSummaryText(),
    isLocked: isSettingsLocked,
    isOpen: isOptionsOpen,
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: starterKanjiQuizCountOptions,
        activeValue: activeCount,
        formatValue: formatQuestionCountLabel,
        disabled: isSettingsLocked
      },
      {
        spinner: timeSpinner,
        options: quizDurationOptions,
        activeValue: activeDuration,
        formatValue: getDurationLabel,
        disabled: isSettingsLocked
      }
    ],
    selectConfigs: [
      {
        element: questionFieldSelect,
        value: activeQuestionField
      },
      {
        element: optionFieldSelect,
        value: activeOptionField
      },
      {
        element: collectionSelect,
        populate: (element) => populateKanjiCollectionSelect(element, collectionCounts, getKanjiCollectionFilter())
      },
      {
        element: gradeSelect,
        populate: (element) => populateKanjiGradeSelect(element, gradeCounts, getKanjiGrade())
      }
    ],
    actionButton: {
      button: startButton,
      label: startLabel,
      isStarted: state.starterKanjiQuizStarted,
      canStart
    }
  });
}

function renderStarterKanjiPractice() {
  const card = document.getElementById("starter-kanji-card");
  const nextButton = document.getElementById("starter-kanji-next");
  const optionsContainer = document.getElementById("starter-kanji-options");
  const source = document.getElementById("starter-kanji-source");
  const progress = document.getElementById("starter-kanji-progress");
  const display = document.getElementById("starter-kanji-display");
  const displaySub = document.getElementById("starter-kanji-display-sub");
  const visibleItems = getVisibleKanjiItems();
  const questionCount = getStarterKanjiQuestionCount();
  const current = getCurrentStarterKanjiPracticeSet();

  if (!card || !nextButton || !optionsContainer || !source || !progress || !display || !displaySub) {
    return;
  }

  if (!visibleItems.length || !current) {
    optionsContainer.innerHTML = "";
    delete optionsContainer.dataset.answered;
    nextButton.disabled = true;
    return;
  }

  source.textContent = formatQuizLineBreaks(current.gradeLabel || current.source || "한자");
  progress.textContent = `${state.basicPracticeIndexes.kanji + 1} / ${questionCount}`;
  display.textContent = formatQuizLineBreaks(current.display);
  displaySub.textContent = formatQuizLineBreaks(current.displaySub || "");
  displaySub.hidden = !normalizeQuizText(current.displaySub || "");

  card.className = `basic-practice-card kanji-practice-card ${current.tone || "tone-gold"}`;
  nextButton.textContent =
    state.basicPracticeIndexes.kanji >= questionCount - 1 ? "결과 볼까요?" : "다음 한자 볼까요?";
  nextButton.disabled = true;

  delete optionsContainer.dataset.answered;
  renderChoiceOptionButtons({
    container: optionsContainer,
    options: getStarterKanjiOptionOrder(current),
    buttonClassName: "basic-practice-option",
    getButtonText: (optionIndex) => current.options[optionIndex],
    getOptionValue: (optionIndex) => optionIndex,
    formatText: formatQuizLineBreaks,
    onSelect: handleStarterKanjiPracticeAnswer,
    datasetKey: "optionIndex",
    setPressedState: true
  });

  setQuizSessionDuration("starterKanji", getStarterKanjiQuizDuration());
  resetQuizSessionTimer("starterKanji", handleStarterKanjiPracticeTimeout);
}

function getKanjiSummaryText(count, collectionFilter = state?.kanjiCollectionFilter, grade = state?.kanjiGrade) {
  const activeCollectionFilter = getKanjiCollectionFilter(collectionFilter);
  const collectionLabel = getKanjiCollectionSummaryLabel(activeCollectionFilter);
  const gradeLabel = getKanjiGradeSummaryLabel(grade);
  const subject = activeCollectionFilter === "all" ? "한자" : `${collectionLabel} 한자`;

  return `${gradeLabel} ${subject} ${count}개를 보고 있어요`;
}

function getVisibleKanjiCards() {
  return getOrderedStudyCards("kanji", getVisibleKanjiItems());
}

function getKanjiPageCount(items) {
  return Math.max(1, Math.ceil((Array.isArray(items) ? items.length : 0) / kanjiPageSize));
}

function clampKanjiPage(items) {
  state.kanjiPage = Math.min(Math.max(state.kanjiPage, 1), getKanjiPageCount(items));
}

function resetKanjiStudyPointers() {
  state.kanjiPage = 1;
  state.kanjiFlashcardIndex = 0;
  state.kanjiFlashcardRevealed = false;
}

function syncKanjiFlashcardIndexAfterUpdate(currentCardId, previousIndex) {
  const nextCards = getVisibleKanjiCards();
  const currentVisibleIndex = nextCards.findIndex((item) => item.id === currentCardId);

  if (!nextCards.length) {
    state.kanjiFlashcardIndex = 0;
    return;
  }

  if (currentVisibleIndex !== -1) {
    state.kanjiFlashcardIndex =
      nextCards.length > 1 ? (currentVisibleIndex + 1) % nextCards.length : currentVisibleIndex;
    return;
  }

  state.kanjiFlashcardIndex = Math.min(previousIndex, nextCards.length - 1);
}

function getKanjiFlashcardPlaceholder() {
  const activeCollectionFilter = getKanjiCollectionFilter();

  return {
    id: "kanji-empty",
    gradeLabel: getKanjiGradeSummaryLabel(),
    display: "漢字",
    statusText: getKanjiEmptyMessage(),
    readingsDisplay:
      activeCollectionFilter === "review"
        ? "다른 학년이나 모아보기로 바꿔보세요."
        : activeCollectionFilter === "mastered"
          ? "아직 익힌 한자가 없어요."
          : "학년별 한자를 차근차근 익혀볼 수 있어요."
  };
}

function renderKanjiStudyControls() {
  const summary = document.getElementById("kanji-summary");
  const collectionSelect = document.getElementById("kanji-collection-select");
  const gradeSelect = document.getElementById("kanji-grade-select");
  const collectionCounts = getKanjiCollectionCounts();
  const gradeCounts = getKanjiGradeCounts(getKanjiCollectionItems());
  const activeView = getKanjiView();
  const visibleItems = getVisibleKanjiItems();

  renderStudyCatalogControls({
    summary,
    summaryText: getKanjiSummaryText(visibleItems.length),
    viewSelector: "[data-kanji-view]",
    viewAttribute: "data-kanji-view",
    activeView,
    selectConfigs: [
      {
        element: collectionSelect,
        populate: (element) => populateKanjiCollectionSelect(element, collectionCounts, getKanjiCollectionFilter())
      },
      {
        element: gradeSelect,
        populate: (element) => populateKanjiGradeSelect(element, gradeCounts, getKanjiGrade())
      }
    ]
  });
}

function renderKanjiFlashcard() {
  const flashcard = document.getElementById("kanji-flashcard");
  const toggle = document.getElementById("kanji-flashcard-toggle");
  const prev = document.getElementById("kanji-flashcard-prev");
  const next = document.getElementById("kanji-flashcard-next");
  const reviewButton = document.getElementById("kanji-flashcard-review");
  const masteredButton = document.getElementById("kanji-flashcard-mastered");
  const level = document.getElementById("kanji-flashcard-level");
  const word = document.getElementById("kanji-flashcard-word");
  const reading = document.getElementById("kanji-flashcard-reading");
  const meaning = document.getElementById("kanji-flashcard-meaning");
  const hint = document.getElementById("kanji-flashcard-hint");
  const cards = getVisibleKanjiCards();

  if (
    !flashcard ||
    !toggle ||
    !prev ||
    !next ||
    !reviewButton ||
    !masteredButton ||
    !level ||
    !word ||
    !reading ||
    !meaning ||
    !hint
  ) {
    return;
  }

  const hasCards = cards.length > 0;
  const currentIndex = hasCards ? state.kanjiFlashcardIndex % cards.length : 0;
  const currentCard = hasCards ? cards[currentIndex] : getKanjiFlashcardPlaceholder();
  const review = hasCards && isKanjiSavedToReviewList(currentCard.id);
  const mastered = hasCards && isKanjiSavedToMasteredList(currentCard.id);
  const isRevealed = hasCards && state.kanjiFlashcardRevealed;
  const hintText = hasCards
    ? isRevealed
      ? review
        ? "다시 볼래요에 담긴 한자예요"
        : mastered
          ? "익혔어요에 담긴 한자예요"
          : "저장 상태를 바로 바꿔볼 수 있어요"
      : "눌러서 읽기를 확인해볼까요?"
    : "필터를 바꾸면 다른 한자를 바로 볼 수 있어요.";

  renderStudyFlashcardComponent({
    flashcard,
    toggle,
    prev,
    next,
    level,
    word,
    reading,
    meaning,
    hint,
    hasCards,
    isRevealed,
    revealWhenEmpty: true,
    levelText: currentCard.gradeLabel || "한자",
    wordText: currentCard.display || "漢字",
    meaningText: hasCards
      ? currentCard.readingsDisplay || currentCard.reading || ""
      : currentCard.statusText || getKanjiEmptyMessage(),
    hintText,
    hideReading: true,
    toggleOpenLabel: "읽기를 다시 접어둘까요?",
    toggleClosedLabel: "읽기를 확인해볼까요?",
    toggleEmptyLabel: "표시할 한자가 없어요",
    prevDisabled: cards.length <= 1,
    nextDisabled: cards.length <= 1,
    actionButtons: [
      {
        button: reviewButton,
        selected: review,
        selectedClass: "primary-btn",
        idleClass: "secondary-btn"
      },
      {
        button: masteredButton,
        selected: mastered,
        selectedClass: "primary-btn",
        idleClass: "secondary-btn"
      }
    ]
  });
}

function renderKanjiList() {
  const list = document.getElementById("kanji-list");
  const pageInfo = document.getElementById("kanji-page-info");
  const prev = document.getElementById("kanji-page-prev");
  const next = document.getElementById("kanji-page-next");
  const items = getVisibleKanjiItems();

  renderPagedStudyList({
    list,
    pageInfo,
    prev,
    next,
    items,
    page: state.kanjiPage,
    pageSize: kanjiPageSize,
    emptyMessage: getKanjiEmptyMessage(),
    onPageChange: (page) => {
      state.kanjiPage = page;
      saveState();
    },
    renderItem: (item, displayIndex) => {
      const review = isKanjiSavedToReviewList(item.id);
      const mastered = isKanjiSavedToMasteredList(item.id);
      const gradeLabel = item.gradeLabel || getKanjiGradeLabel(item.grade);

      return createStudyListCardMarkup({
        index: displayIndex,
        headMetaMarkup: gradeLabel ? `<span class="vocab-list-index">${gradeLabel}</span>` : "",
        badgesMarkup: createStudyStatusBadgesMarkup(review, mastered),
        mainClassName: "vocab-list-main kanji-list-main",
        titleClassName: "vocab-list-word kanji-list-char",
        titleText: formatQuizLineBreaks(item.display),
        subtitleText: formatQuizLineBreaks(item.readingsDisplay || item.reading),
        actionsMarkup: createKanjiStatusButtonsMarkup(item.id)
      });
    }
  });
}

function renderKanjiPageLayout() {
  const activeTab = getKanjiTab(state.kanjiTab);
  const cardView = document.getElementById("kanji-card-view");
  const listView = document.getElementById("kanji-list-view");
  const empty = document.getElementById("starter-kanji-empty");
  const practiceView = document.getElementById("starter-kanji-practice-view");
  const resultView = document.getElementById("starter-kanji-result-view");

  renderStarterKanjiControls();
  renderKanjiStudyControls();

  syncTabButtonsAndPanels({
    buttonSelector: "[data-kanji-tab]",
    panelSelector: "[data-kanji-tab-panel]",
    buttonAttribute: "kanjiTab",
    panelAttribute: "kanjiTabPanel",
    activeValue: activeTab
  });

  if (activeTab === "list") {
    stopQuizSessionTimer("starterKanji");
    renderQuizSessionHud("starterKanji");
    renderStudyCatalogSection({
      cardView,
      listView,
      activeView: getKanjiView(),
      renderFlashcard: renderKanjiFlashcard,
      renderList: renderKanjiList
    });
    return;
  }

  if (activeTab === "match") {
    stopQuizSessionTimer("starterKanji");
    renderQuizSessionHud("starterKanji");
    return;
  }

  if (!state.starterKanjiQuizStarted) {
    stopQuizSessionTimer("starterKanji");
    quizSessions.starterKanji.correct = 0;
    quizSessions.starterKanji.streak = 0;
    setQuizSessionDuration("starterKanji", getStarterKanjiQuizDuration());
    if (empty) {
      empty.textContent = getStarterKanjiQuestionCount() > 0
        ? "준비됐다면 시작해볼까요?"
        : getKanjiEmptyMessage();
    }
    setElementHidden(empty, false);
    setElementHidden(practiceView, true);
    setElementHidden(resultView, true);
    renderQuizSessionHud("starterKanji");
    return;
  }

  setElementHidden(empty, true);
  setElementHidden(practiceView, starterKanjiState.showResults);
  setElementHidden(resultView, !starterKanjiState.showResults);

  if (starterKanjiState.showResults) {
    stopQuizSessionTimer("starterKanji");
    renderQuizSessionHud("starterKanji");
    renderStarterKanjiResults();
    return;
  }

  renderStarterKanjiPractice();
}

function setKanjiTab(tab) {
  const nextTab = getKanjiTab(tab);

  if (state.kanjiTab === nextTab) {
    return;
  }

  state.kanjiTab = nextTab;
  saveState();
  renderKanjiPageLayout();

  const activePanel = document.querySelector(`[data-kanji-tab-panel="${nextTab}"]`);
  if (activePanel?.scrollIntoView) {
    activePanel.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

function handleStarterKanjiPracticeAnswer(index) {
  const current = getCurrentStarterKanjiPracticeSet();
  const nextButton = document.getElementById("starter-kanji-next");
  const optionsContainer = document.getElementById("starter-kanji-options");
  const options = document.querySelectorAll("#starter-kanji-options .basic-practice-option");
  const alreadyAnswered = optionsContainer?.dataset.answered === "true";

  if (!current || !nextButton || !optionsContainer || alreadyAnswered) {
    return;
  }

  const correct = index === current.answer;
  const totalQuestions = getStarterKanjiQuestionCount();

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (item) => Number(item.dataset.optionIndex) === current.answer,
    isSelectedOption: (item) => Number(item.dataset.optionIndex) === index,
    setPressedState: true
  });
  optionsContainer.dataset.answered = "true";
  finalizeQuizSession("starterKanji", correct);
  setStarterKanjiResult(current, index, correct);

  updateStudyStreak();
  saveState();
  renderStats();

  nextButton.textContent =
    starterKanjiState.results.length >= totalQuestions ? "결과 볼까요?" : "다음 한자 볼까요?";
  nextButton.disabled = false;
}

function handleStarterKanjiPracticeTimeout() {
  const current = getCurrentStarterKanjiPracticeSet();
  const nextButton = document.getElementById("starter-kanji-next");
  const optionsContainer = document.getElementById("starter-kanji-options");
  const options = document.querySelectorAll("#starter-kanji-options .basic-practice-option");
  const alreadyAnswered = optionsContainer?.dataset.answered === "true";
  const totalQuestions = getStarterKanjiQuestionCount();

  if (!current || !nextButton || !optionsContainer || alreadyAnswered) {
    return;
  }

  finalizeQuizSession("starterKanji", false);

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (item) => Number(item.dataset.optionIndex) === current.answer,
    setPressedState: true
  });

  optionsContainer.dataset.answered = "true";
  setStarterKanjiResult(current, -1, false, true);
  updateStudyStreak();
  saveState();
  renderStats();
  nextButton.textContent =
    starterKanjiState.results.length >= totalQuestions ? "결과 볼까요?" : "다음 한자 볼까요?";
  nextButton.disabled = false;
}

function nextStarterKanjiPracticeSet() {
  const items = getVisibleKanjiItems();
  const optionsContainer = document.getElementById("starter-kanji-options");
  const answered = optionsContainer?.dataset.answered === "true";
  const questionCount = getStarterKanjiQuestionCount();

  if (!items.length || !answered) {
    return;
  }

  ensureStarterKanjiQuestionOrder();

  if (starterKanjiState.results.length >= questionCount || state.basicPracticeIndexes.kanji >= questionCount - 1) {
    starterKanjiState.showResults = true;
    state.starterKanjiQuizFinished = true;
    saveState();
    renderKanjiPageLayout();
    return;
  }

  state.basicPracticeIndexes.kanji += 1;

  saveState();
  renderStarterKanjiPractice();
}

function restartStarterKanjiPractice() {
  invalidateStarterKanjiSession();
  saveState();
  renderKanjiPageLayout();
}

function setKanjiGrade(grade) {
  const nextGrade = getKanjiGrade(grade);

  if (state.kanjiGrade === nextGrade) {
    return;
  }

  state.kanjiGrade = nextGrade;
  resetKanjiStudyPointers();
  invalidateStarterKanjiSession();
  saveState();
  renderKanjiPageLayout();
}

function setKanjiCollectionFilter(filter) {
  const nextFilter = getKanjiCollectionFilter(filter);

  if (state.kanjiCollectionFilter === nextFilter) {
    return;
  }

  state.kanjiCollectionFilter = nextFilter;
  resetKanjiStudyPointers();
  invalidateStarterKanjiSession();
  saveState();
  renderKanjiPageLayout();
}

function setKanjiView(view) {
  const nextView = getKanjiView(view);

  if (state.kanjiView === nextView) {
    return;
  }

  state.kanjiView = nextView;
  saveState();
  renderKanjiPageLayout();
}

function toggleKanjiFlashcardReveal() {
  toggleStudyFlashcardReveal("kanjiFlashcardRevealed", () => {
    renderKanjiPageLayout();
    renderStats();
  });
}

function moveKanjiFlashcard(step) {
  moveStudyFlashcard(step, {
    getCards: getVisibleKanjiCards,
    indexKey: "kanjiFlashcardIndex",
    revealedKey: "kanjiFlashcardRevealed",
    render: renderKanjiPageLayout
  });
}

function markKanjiFlashcardForReview() {
  markStudyFlashcardStatus({
    getCards: getVisibleKanjiCards,
    indexKey: "kanjiFlashcardIndex",
    revealedKey: "kanjiFlashcardRevealed",
    saveItem: saveKanjiToReviewList,
    syncIndexAfterUpdate: syncKanjiFlashcardIndexAfterUpdate,
    render: () => {
      renderKanjiPageLayout();
      renderStats();
    }
  });
}

function markKanjiFlashcardMastered() {
  markStudyFlashcardStatus({
    getCards: getVisibleKanjiCards,
    indexKey: "kanjiFlashcardIndex",
    revealedKey: "kanjiFlashcardRevealed",
    saveItem: saveKanjiToMasteredList,
    syncIndexAfterUpdate: syncKanjiFlashcardIndexAfterUpdate,
    render: () => {
      renderKanjiPageLayout();
      renderStats();
    }
  });
}

function getVocabFilter(filter = state.vocabFilter) {
  return Object.prototype.hasOwnProperty.call(vocabFilterLabels, filter) ? filter : "all";
}

function getAvailableVocabParts(items = vocabListItems) {
  if (!Array.isArray(items)) {
    return [];
  }

  const counts = items.reduce((map, item) => {
    const part = getVocabItemPart(item);
    map.set(part, (map.get(part) || 0) + 1);
    return map;
  }, new Map());

  return Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], "ko");
    })
    .map(([value, count]) => ({ value, count }));
}

function getVocabPartFilter(part = state.vocabPartFilter, items = vocabListItems) {
  const normalizedPart = normalizeQuizText(part);

  if (!normalizedPart || normalizedPart === vocabPartAllValue) {
    return vocabPartAllValue;
  }

  const exists = getAvailableVocabParts(items).some((item) => item.value === normalizedPart);
  return exists ? normalizedPart : vocabPartAllValue;
}

function getVocabPartSummaryLabel(part = state.vocabPartFilter) {
  const activePart = getVocabPartFilter(part);
  return activePart === vocabPartAllValue ? "전체 품사" : activePart;
}

function getVocabView(view = state.vocabView) {
  return view === "list" ? "list" : "card";
}

function getVocabViewLabel(view = state.vocabView) {
  const labels = {
    card: "카드",
    list: "목록"
  };

  return labels[getVocabView(view)];
}

function invalidateVocabQuizSession() {
  activeVocabQuizQuestions = [];
  activeVocabQuizSignature = "";
  activeVocabQuizResults = [];
  state.vocabQuizStarted = false;
  state.vocabQuizResultFilter = "all";
  state.vocabQuizIndex = 0;
  state.vocabQuizFinished = false;
  quizSessions.vocab.correct = 0;
  quizSessions.vocab.streak = 0;
  setQuizSessionDuration("vocab", getVocabQuizDuration());
  stopQuizSessionTimer("vocab");
}

function isVocabPagePath() {
  return window.location.pathname.endsWith("vocab.html") || window.location.pathname.endsWith("/vocab.html");
}

function getVocabQuizConfigLabel(
  questionField = state?.vocabQuizQuestionField,
  optionField = state?.vocabQuizOptionField
) {
  return `${getVocabQuizFieldLabel(questionField)} → ${getVocabQuizFieldLabel(optionField)}`;
}

function getVocabQuizResultFilter(value = state.vocabQuizResultFilter) {
  return ["all", "correct", "wrong"].includes(value) ? value : "all";
}

function getVocabQuizOptionsSummaryText() {
  return [
    getVocabQuizConfigLabel(),
    `${getVocabQuizCount()}문제`,
    getDurationLabel(getVocabQuizDuration())
  ].join(" · ");
}

function syncVocabLocationHash(tab = state.vocabTab) {
  if (!isVocabPagePath()) {
    return;
  }

  const activeTab = getVocabTab(tab);
  const nextHash = activeTab === "quiz" ? "#quiz" : activeTab === "match" ? "#match" : "";
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;

  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === nextUrl) {
    return;
  }

  try {
    window.history.replaceState(null, "", nextUrl);
  } catch (error) {
    if (nextHash) {
      window.location.hash = nextHash;
      return;
    }

    if (window.location.hash) {
      try {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      } catch (innerError) {
        window.location.hash = "";
      }
    }
  }
}

function setVocabTab(tab) {
  const nextTab = getVocabTab(tab);

  if (state.vocabTab === nextTab) {
    return;
  }

  state.vocabTab = nextTab;

  if (nextTab !== "quiz") {
    stopQuizSessionTimer("vocab");
  }

  renderVocabTabLayout();

  saveState();

  try {
    renderVocabPage();
  } catch (error) {
    console.error("Failed to render vocab tab.", error);
    renderVocabTabLayout();
  }

  const activePanel = document.querySelector(`[data-vocab-tab-panel="${nextTab}"]`);
  if (activePanel?.scrollIntoView) {
    activePanel.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

function setVocabView(view) {
  const nextView = getVocabView(view);

  if (state.vocabView === nextView) {
    return;
  }

  state.vocabView = nextView;
  saveState();
  renderVocabPage();
}

function getVocabEmptyMessage(filter = state.vocabFilter, part = state.vocabPartFilter) {
  const activeFilter = getVocabFilter(filter);
  const activePart = getVocabPartFilter(part);
  const partLabel = activePart === vocabPartAllValue ? "단어" : `${activePart} 단어`;

  if (activeFilter === "review") {
    return `다시 볼 ${partLabel}가 아직 없어요.`;
  }

  if (activeFilter === "mastered") {
    return `익힌 ${partLabel}가 아직 없어요.`;
  }

  if (activeFilter === "unmarked") {
    return `아직 안 정한 ${partLabel}가 없어요.`;
  }

  return `${partLabel}가 아직 없어요.`;
}

function filterVocabItems(items, filter = state.vocabFilter, partFilter = state.vocabPartFilter) {
  const activeFilter = getVocabFilter(filter);
  const activePartFilter = getVocabPartFilter(partFilter, items);

  if (!Array.isArray(items)) {
    return [];
  }

  const filteredByPart =
    activePartFilter === vocabPartAllValue
      ? items
      : items.filter((item) => getVocabItemPart(item) === activePartFilter);

  if (activeFilter === "review") {
    return filteredByPart.filter((item) => state.reviewIds.includes(item.id));
  }

  if (activeFilter === "mastered") {
    return filteredByPart.filter((item) => state.masteredIds.includes(item.id));
  }

  if (activeFilter === "unmarked") {
    return filteredByPart.filter((item) => !state.reviewIds.includes(item.id) && !state.masteredIds.includes(item.id));
  }

  return filteredByPart;
}

function getVocabFilterCounts() {
  return {
    all: filterVocabItems(vocabListItems, "all", state.vocabPartFilter).length,
    review: filterVocabItems(vocabListItems, "review", state.vocabPartFilter).length,
    mastered: filterVocabItems(vocabListItems, "mastered", state.vocabPartFilter).length,
    unmarked: filterVocabItems(vocabListItems, "unmarked", state.vocabPartFilter).length
  };
}

function getVocabSummaryText(count) {
  const activeFilter = getVocabFilter();
  const activeLevel = getVocabLevel();
  const levelLabel = getLevelSummaryLabel(activeLevel);
  const activePart = getVocabPartFilter();
  const partLabel = activePart === vocabPartAllValue ? "단어" : `${activePart} 단어`;

  if (activeFilter === "review") {
    return `${levelLabel} 다시 볼 ${partLabel} ${count}개예요`;
  }

  if (activeFilter === "mastered") {
    return `${levelLabel} 익힌 ${partLabel} ${count}개 모였어요`;
  }

  if (activeFilter === "unmarked") {
    return `${levelLabel} 아직 안 정한 ${partLabel} ${count}개예요`;
  }

  return `${levelLabel} ${activePart === vocabPartAllValue ? "단어" : partLabel} ${count}개예요`;
}

function setVocabLevel(level) {
  const nextLevel = getVocabLevel(level);

  if (state.vocabLevel === nextLevel) {
    return;
  }

  state.vocabLevel = nextLevel;
  state.flashcardIndex = 0;
  state.flashcardRevealed = false;
  state.vocabPage = 1;
  invalidateVocabQuizSession();
  refreshVocabPageContent(nextLevel);
  state.vocabPartFilter = getVocabPartFilter(state.vocabPartFilter);
  saveState();
  renderVocabPage();
}

function setVocabFilter(filter) {
  const nextFilter = getVocabFilter(filter);

  if (state.vocabFilter === nextFilter) {
    return;
  }

  state.vocabFilter = nextFilter;
  state.flashcardIndex = 0;
  state.flashcardRevealed = false;
  state.vocabPage = 1;
  invalidateVocabQuizSession();
  saveState();
  renderVocabPage();
}

function setVocabPartFilter(part) {
  const nextPart = getVocabPartFilter(part);

  if (state.vocabPartFilter === nextPart) {
    return;
  }

  state.vocabPartFilter = nextPart;
  state.flashcardIndex = 0;
  state.flashcardRevealed = false;
  state.vocabPage = 1;
  invalidateVocabQuizSession();
  saveState();
  renderVocabPage();
}

function syncFlashcardIndexAfterVocabUpdate(currentCardId, previousIndex) {
  const nextCards = getVisibleFlashcards();
  const currentVisibleIndex = nextCards.findIndex((item) => item.id === currentCardId);

  if (!nextCards.length) {
    state.flashcardIndex = 0;
    return;
  }

  if (currentVisibleIndex !== -1) {
    state.flashcardIndex =
      nextCards.length > 1 ? (currentVisibleIndex + 1) % nextCards.length : currentVisibleIndex;
    return;
  }

  state.flashcardIndex = Math.min(previousIndex, nextCards.length - 1);
}

function getVisibleFlashcards() {
  return getOrderedStudyCards("vocab", filterVocabItems(flashcards));
}

function getVisibleVocabList() {
  return filterVocabItems(vocabListItems);
}

function getVocabQuizItems() {
  return getVisibleVocabList();
}

function getVocabPageCount(items) {
  return Math.max(1, Math.ceil(items.length / vocabPageSize));
}

function clampVocabPage(items) {
  state.vocabPage = Math.min(Math.max(state.vocabPage, 1), getVocabPageCount(items));
}

function getVocabQuizSignature(items = getVocabQuizItems()) {
  return [
    getVocabLevel(),
    getVocabFilter(),
    getVocabPartFilter(),
    getVocabQuizQuestionField(),
    getVocabQuizOptionField(),
    getVocabQuizCount(),
    items.map((item) => item.id).join("|")
  ].join("::");
}

function getVocabQuizSourceLabel() {
  return [getVocabLevelLabel(), vocabFilterLabels[getVocabFilter()], getVocabPartSummaryLabel()].join(" · ");
}

function getCurrentVocabQuizQuestion() {
  return activeVocabQuizQuestions[state.vocabQuizIndex] || activeVocabQuizQuestions[0] || null;
}

function resetVocabQuizSessionStats() {
  quizSessions.vocab.correct = 0;
  quizSessions.vocab.streak = 0;
  setQuizSessionDuration("vocab", getVocabQuizDuration());
  renderQuizSessionHud("vocab");
}

function startNewVocabQuizSession(force = false) {
  const items = getVocabQuizItems();
  const nextSignature = getVocabQuizSignature(items);

  if (!force && nextSignature === activeVocabQuizSignature && activeVocabQuizQuestions.length) {
    state.vocabQuizStarted = true;
    return true;
  }

  const nextQuestions = buildWordPracticeQuestionSet(items, getVocabLevel(), [], {
    questionField: getVocabQuizQuestionField(),
    optionField: getVocabQuizOptionField(),
    count: getVocabQuizCount()
  });

  activeVocabQuizSignature = nextSignature;
  activeVocabQuizQuestions = nextQuestions;
  activeVocabQuizResults = [];
  state.vocabQuizStarted = nextQuestions.length > 0;
  state.vocabQuizResultFilter = "all";
  state.vocabQuizIndex = 0;
  state.vocabQuizFinished = false;
  resetVocabQuizSessionStats();
  saveState();
  return nextQuestions.length > 0;
}

function ensureVocabQuizSession(force = false) {
  if (!state.vocabQuizStarted) {
    return false;
  }

  const nextSignature = getVocabQuizSignature();

  if (
    force ||
    nextSignature !== activeVocabQuizSignature ||
    (activeVocabQuizQuestions.length > 0 && state.vocabQuizIndex >= activeVocabQuizQuestions.length)
  ) {
    return startNewVocabQuizSession(true);
  }

  return true;
}

function getVocabQuizEmptyText(items = getVocabQuizItems()) {
  if (!items.length) {
    return `${getVocabEmptyMessage()} 퀴즈는 단어가 준비되면 같이 풀어봐요.`;
  }

  if (items.length < 4) {
    return "선택한 단어가 4개보다 적어서 퀴즈를 만들기 어려워요. 모아보기나 품사를 조금 넓혀봐요.";
  }

  return "선택한 단어로는 퀴즈를 만들기 어려워요. 다른 모아보기도 골라봐요.";
}

function saveWordToReviewList(id) {
  if (!id) {
    return;
  }

  if (!state.reviewIds.includes(id)) {
    state.reviewIds.push(id);
  }

  state.masteredIds = state.masteredIds.filter((itemId) => itemId !== id);
}

function removeWordFromReviewList(id) {
  if (!id) {
    return;
  }

  state.reviewIds = state.reviewIds.filter((itemId) => itemId !== id);
}

function isWordSavedToReviewList(id) {
  return Boolean(id) && state.reviewIds.includes(id);
}

function saveWordToMasteredList(id) {
  if (!id) {
    return;
  }

  if (!state.masteredIds.includes(id)) {
    state.masteredIds.push(id);
  }

  state.reviewIds = state.reviewIds.filter((itemId) => itemId !== id);
}

function removeWordFromMasteredList(id) {
  if (!id) {
    return;
  }

  state.masteredIds = state.masteredIds.filter((itemId) => itemId !== id);
}

function isWordSavedToMasteredList(id) {
  return Boolean(id) && state.masteredIds.includes(id);
}

function createVocabStatusButtonsMarkup(id) {
  return createStudyStatusButtonsMarkup({
    id,
    groupClassName: "vocab-list-actions",
    buttonClassName: "vocab-status-btn",
    reviewAttribute: "data-word-review",
    masteredAttribute: "data-word-mastered",
    reviewSelected: isWordSavedToReviewList(id),
    masteredSelected: isWordSavedToMasteredList(id)
  });
}

function getVocabQuizResultCounts() {
  return getStudyResultCounts(activeVocabQuizResults);
}

function getFilteredVocabQuizResults() {
  return getFilteredStudyResults(activeVocabQuizResults, getVocabQuizResultFilter());
}

function renderVocabQuizResultFilterOptions(counts) {
  const filterSelect = document.getElementById("vocab-quiz-result-filter");

  renderResultFilterOptions({
    select: filterSelect,
    labels: vocabQuizResultFilterLabels,
    counts,
    activeValue: getVocabQuizResultFilter()
  });
}

function renderVocabQuizBulkActionButton(results) {
  const bulkActionButton = document.getElementById("vocab-quiz-result-bulk-action");
  const bulkActionLabel = document.getElementById("vocab-quiz-result-bulk-label");
  const bulkActionIcon = bulkActionButton?.querySelector(".material-symbols-rounded");

  renderResultBulkActionButton({
    button: bulkActionButton,
    label: bulkActionLabel,
    icon: bulkActionIcon,
    results,
    getId: (item) => item.id,
    isSaved: isWordSavedToReviewList,
    datasetKey: "vocabQuizBulkAction",
    saveLabel: "전체 담기",
    removeLabel: "전체 빼기",
    emptyTitle: "지금 담아둘 단어가 없어요.",
    saveTitle: "지금 보이는 단어를 다시 볼래요에 모두 담아둘게요.",
    removeTitle: "지금 보이는 단어를 다시 볼래요에서 모두 뺄게요."
  });
}

function recordVocabQuizResult(question, selectedIndex, correct, timedOut = false) {
  if (!question) {
    return;
  }

  activeVocabQuizResults.push({
    id: question.sourceId || question.id,
    status: correct ? "correct" : "wrong",
    level: question.level || getVocabLevelLabel(),
    questionField: getVocabQuizField(question.questionField, getVocabQuizQuestionField()),
    optionField: getVocabQuizField(question.optionField, getVocabQuizOptionField()),
    word: question.word || "",
    reading: question.reading || "",
    meaning: question.meaning || "",
    selectedOption: selectedIndex >= 0 ? question.options[selectedIndex] || "" : "",
    answerOption: question.options[question.answer] || "",
    timedOut
  });
}

function renderVocabQuizResults() {
  const total = document.getElementById("vocab-quiz-result-total");
  const correct = document.getElementById("vocab-quiz-result-correct");
  const wrong = document.getElementById("vocab-quiz-result-wrong");
  const empty = document.getElementById("vocab-quiz-result-empty");
  const list = document.getElementById("vocab-quiz-result-list");
  const filterSelect = document.getElementById("vocab-quiz-result-filter");
  const bulkActionButton = document.getElementById("vocab-quiz-result-bulk-action");
  const counts = getVocabQuizResultCounts();
  const filteredResults = getFilteredVocabQuizResults();

  if (!total || !correct || !wrong || !empty || !list || !filterSelect || !bulkActionButton) {
    return;
  }

  renderVocabQuizResultFilterOptions(counts);
  renderVocabQuizBulkActionButton(filteredResults);

  const hasResults = renderStudyResultSection({
    total,
    correct,
    wrong,
    empty,
    list,
    counts,
    filteredResults,
    emptyMessage: `${vocabQuizResultFilterLabels[getVocabQuizResultFilter()]} 결과는 아직 없어요.`,
    renderItems: (results, container) => {
      results.forEach((item) => {
        const saved = isWordSavedToReviewList(item.id);
        const actionLabel = saved ? "다시 볼래요에서 빼기" : "다시 볼래요에 담기";

        appendQuizResultItem({
          container,
          status: item.status,
          levelText: item.level || getVocabLevelLabel(),
          titleText: item.reading ? `${item.word} · ${item.reading}` : item.word,
          descriptionText: item.meaning,
          saved,
          saveActionLabel: actionLabel,
          saveDatasetKey: "vocabQuizSave",
          saveId: item.id
        });
      });
    }
  });

  if (!hasResults) {
    return;
  }
}

function revealVocabQuizAnswer(question, selectedIndex, correct) {
  const options = document.querySelectorAll("#vocab-quiz-options .basic-practice-option");

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === question.answer,
    isSelectedOption: (_, optionIndex) => optionIndex === selectedIndex
  });
}

function finalizeVocabQuizQuestion(selectedIndex, timedOut = false) {
  const question = getCurrentVocabQuizQuestion();
  const feedback = document.getElementById("vocab-quiz-feedback");
  const explanation = document.getElementById("vocab-quiz-explanation");
  const nextButton = document.getElementById("vocab-quiz-next");

  if (!question || !feedback || !explanation || !nextButton) {
    return;
  }

  const correct = selectedIndex === question.answer;
  const isLastQuestion = state.vocabQuizIndex >= activeVocabQuizQuestions.length - 1;

  finalizeQuizSession("vocab", correct);
  state.quizAnsweredCount += 1;

  if (correct) {
    state.quizCorrectCount += 1;
  }

  recordVocabQuizResult(question, selectedIndex, correct, timedOut);
  revealVocabQuizAnswer(question, selectedIndex, correct);
  feedback.textContent = correct
    ? "좋아요!"
    : timedOut
      ? ""
      : "아깝네요! 정답 같이 볼까요?";
  explanation.textContent = softenExplanationCopy(question.explanation || "");
  nextButton.disabled = false;
  nextButton.hidden = false;
  nextButton.textContent = isLastQuestion ? "결과 볼까요?" : "다음 문제 볼까요?";

  updateStudyStreak();
  saveState();
  renderStats();
}

function handleVocabQuizAnswer(index) {
  const options = document.querySelectorAll("#vocab-quiz-options .basic-practice-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);

  if (alreadyAnswered) {
    return;
  }

  finalizeVocabQuizQuestion(index, false);
}

function handleVocabQuizTimeout() {
  const question = getCurrentVocabQuizQuestion();
  const options = document.querySelectorAll("#vocab-quiz-options .basic-practice-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);

  if (alreadyAnswered || !question) {
    return;
  }

  finalizeVocabQuizQuestion(-1, true);
}

function nextVocabQuizQuestion() {
  if (state.vocabQuizFinished) {
    invalidateVocabQuizSession();
    saveState();
    renderVocabPage();
    return;
  }

  const options = document.querySelectorAll("#vocab-quiz-options .basic-practice-option");
  const answered = Array.from(options).length > 0 && Array.from(options).every((item) => item.disabled);

  if (!answered) {
    return;
  }

  if (state.vocabQuizIndex >= activeVocabQuizQuestions.length - 1) {
    state.vocabQuizFinished = true;
    stopQuizSessionTimer("vocab");
    saveState();
    renderVocabQuiz();
    return;
  }

  state.vocabQuizIndex += 1;
  saveState();
  renderVocabQuiz();
}

function restartVocabQuiz() {
  if (state.vocabQuizStarted) {
    invalidateVocabQuizSession();
    saveState();
    renderVocabPage();
    return;
  }

  const started = startNewVocabQuizSession(true);
  renderVocabPage();

  if (started) {
    scrollToElementById("vocab-quiz-card");
  }
}

function renderFlashcard() {
  const activeFilter = getVocabFilter();
  const activeLevel = getVocabLevel();
  const activePart = getVocabPartFilter();
  const cards = getVisibleFlashcards();
  const flashcard = document.getElementById("flashcard");
  const flashcardToggle = document.getElementById("flashcard-toggle");
  const flashcardPrev = document.getElementById("flashcard-prev");
  const flashcardNext = document.getElementById("flashcard-next");
  const flashcardAgain = document.getElementById("flashcard-again");
  const flashcardMastered = document.getElementById("flashcard-mastered");
  const level = document.getElementById("flashcard-level");
  const word = document.getElementById("flashcard-word");
  const reading = document.getElementById("flashcard-reading");
  const meaning = document.getElementById("flashcard-meaning");
  const hint = document.getElementById("flashcard-hint");

  if (!flashcard || !flashcardToggle || !level || !word || !reading || !meaning || !hint) {
    return;
  }

  const emptyWordLabel = activePart === vocabPartAllValue ? "아직 단어가 없어요" : `아직 ${activePart} 단어가 없어요`;
  const emptyReadingLabel =
    activePart === vocabPartAllValue ? "단어가 채워지면 여기서 바로 볼 수 있어요." : `${activePart} 단어가 채워지면 여기서 바로 볼 수 있어요.`;
  const emptyMeaningLabel =
    activePart === vocabPartAllValue ? "필터를 바꾸면 다른 단어를 먼저 볼 수 있어요." : "다른 품사나 모아보기를 고르면 바로 이어서 볼 수 있어요.";
  const emptyCardMap = {
    all: {
      level: activeLevel,
      word: emptyWordLabel,
      reading: emptyReadingLabel,
      meaning: emptyMeaningLabel,
      id: "empty-all"
    },
    review: {
      level: "REVIEW",
      word: activePart === vocabPartAllValue ? "다시 볼래요 단어가 없어요" : `다시 볼래요 ${activePart} 단어가 없어요`,
      reading: "조금 더 담아두면 여기서 모아 볼 수 있어요.",
      meaning:
        activePart === vocabPartAllValue
          ? "카드에서 다시 볼래요를 누르면 여기로 모여요."
          : "다른 품사를 고르거나 상태를 바꾸면 바로 이어서 볼 수 있어요.",
      id: "empty-review"
    },
    mastered: {
      level: "MASTERED",
      word: activePart === vocabPartAllValue ? "익혔어요 단어가 없어요" : `익혔어요 ${activePart} 단어가 없어요`,
      reading: "아직 담아둔 단어가 없어요.",
      meaning:
        activePart === vocabPartAllValue
          ? "카드에서 익혔어요를 누르면 여기로 모여요."
          : "선택한 품사에서 익힌 단어가 생기면 여기서 다시 볼 수 있어요.",
      id: "empty-mastered"
    },
    unmarked: {
      level: "UNMARKED",
      word: activePart === vocabPartAllValue ? "아직 안 정한 단어가 없어요" : `아직 안 정한 ${activePart} 단어가 없어요`,
      reading: "상태를 고르지 않은 단어를 따로 모아 보고 있어요.",
      meaning:
        activePart === vocabPartAllValue
          ? "다시 볼래요나 익혔어요를 누르면 이 목록에서 빠져요."
          : "다른 품사나 상태를 고르면 바로 다른 카드로 이어집니다.",
      id: "empty-unmarked"
    }
  };
  const hasCards = cards.length > 0;
  const currentIndex = hasCards ? state.flashcardIndex % cards.length : 0;
  const currentCard = hasCards ? cards[currentIndex] : emptyCardMap[activeFilter] || emptyCardMap.all;
  const review = hasCards && isWordSavedToReviewList(currentCard.id);
  const mastered = hasCards && isWordSavedToMasteredList(currentCard.id);
  const isRevealed = hasCards && state.flashcardRevealed;
  const hintText = hasCards
    ? isRevealed
      ? review
        ? "다시 볼래요에 담긴 단어예요"
        : mastered
          ? "익혔어요에 담긴 단어예요"
          : "지금 상태를 바로 정할 수 있어요"
      : "눌러서 뜻을 확인해볼까요?"
    : activeFilter === "review"
      ? "다시 볼래요 상태를 담아두면 여기서 모아 볼 수 있어요."
      : activeFilter === "mastered"
        ? "익혔어요 상태를 담아두면 여기서 다시 볼 수 있어요."
        : activeFilter === "unmarked"
          ? "아직 안 정한 단어만 따로 보고 있어요."
          : "필터를 바꾸면 다른 단어를 먼저 볼 수 있어요.";

  renderStudyFlashcardComponent({
    flashcard,
    toggle: flashcardToggle,
    prev: flashcardPrev,
    next: flashcardNext,
    level,
    word,
    reading,
    meaning,
    hint,
    hasCards,
    isRevealed,
    revealWhenEmpty: true,
    levelText: formatStudyLevelLabel(currentCard.level, "N5"),
    wordText: currentCard.word || "",
    readingText: currentCard.reading || "",
    meaningText: currentCard.meaning || "",
    hintText,
    toggleOpenLabel: "뜻을 다시 가릴까요?",
    toggleClosedLabel: "뜻을 확인해볼까요?",
    toggleEmptyLabel: "지금 볼 수 있는 단어가 없어요",
    prevDisabled: cards.length <= 1,
    nextDisabled: cards.length <= 1,
    actionButtons: [
      {
        button: flashcardAgain,
        selected: review,
        selectedClass: "primary-btn",
        idleClass: "secondary-btn"
      },
      {
        button: flashcardMastered,
        selected: mastered,
        selectedClass: "primary-btn",
        idleClass: "secondary-btn"
      }
    ]
  });
}

function renderVocabList() {
  const list = document.getElementById("vocab-list");
  const pageInfo = document.getElementById("vocab-page-info");
  const prev = document.getElementById("vocab-page-prev");
  const next = document.getElementById("vocab-page-next");
  const activeFilter = getVocabFilter();
  const items = getVisibleVocabList();

  renderPagedStudyList({
    list,
    pageInfo,
    prev,
    next,
    items,
    page: state.vocabPage,
    pageSize: vocabPageSize,
    emptyMessage: getVocabEmptyMessage(activeFilter),
    onPageChange: (page) => {
      state.vocabPage = page;
      saveState();
    },
    renderItem: (item, displayIndex) => {
      const review = isWordSavedToReviewList(item.id);
      const mastered = isWordSavedToMasteredList(item.id);
      const vocabLevel = item.level || "";

      return createStudyListCardMarkup({
        index: displayIndex,
        headMetaMarkup: vocabLevel ? `<span class="vocab-list-index">${vocabLevel}</span>` : "",
        badgesMarkup: createStudyStatusBadgesMarkup(review, mastered),
        titleText: formatQuizLineBreaks(item.word),
        subtitleText: formatQuizLineBreaks(item.reading),
        descriptionMarkup: `<p class="vocab-list-meaning">${formatQuizLineBreaks(item.meaning)}</p>`,
        actionsMarkup: createVocabStatusButtonsMarkup(item.id)
      });
    }
  });
}

function renderVocabTabLayout() {
  syncTabButtonsAndPanels({
    buttonSelector: "[data-vocab-tab]",
    panelSelector: "[data-vocab-tab-panel]",
    buttonAttribute: "vocabTab",
    panelAttribute: "vocabTabPanel",
    activeValue: getVocabTab()
  });
}

function populateVocabFilterSelect(select, counts) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  Object.entries(vocabFilterLabels).forEach(([filter, label]) => {
    const option = document.createElement("option");
    option.value = filter;
    option.textContent = `${label} (${counts[filter] ?? 0})`;
    select.appendChild(option);
  });

  select.value = getVocabFilter();
}

function populateContentLevelSelect(select, activeLevel, { includeAll = false } = {}) {
  if (!select) {
    return;
  }

  const levelOptions = includeAll ? [allLevelValue, ...contentLevels] : [...contentLevels];
  select.innerHTML = "";

  levelOptions.forEach((level) => {
    const option = document.createElement("option");
    option.value = level;
    option.textContent = level === allLevelValue ? "전체" : level;
    select.appendChild(option);
  });

  select.value = levelOptions.includes(activeLevel) ? activeLevel : levelOptions[0];
}

function populateVocabLevelSelect(select) {
  populateContentLevelSelect(select, getVocabLevel(), { includeAll: true });
}

function populateVocabPartSelect(select, availableParts, activePart) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  const partOptions = [{ value: vocabPartAllValue, count: vocabListItems.length }, ...availableParts];
  partOptions.forEach((partOption) => {
    const option = document.createElement("option");
    const label = partOption.value === vocabPartAllValue ? "전체 품사" : partOption.value;

    option.value = partOption.value;
    option.textContent = `${label} (${partOption.count})`;
    select.appendChild(option);
  });

  select.value = activePart;
}

function populateVocabQuizFieldSelect(select, activeField) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  vocabQuizFieldOptions.forEach((field) => {
    const option = document.createElement("option");
    option.value = field;
    option.textContent = getVocabQuizFieldLabel(field);
    select.appendChild(option);
  });

  select.value = getVocabQuizField(activeField);
}

function renderVocabStudyControls(counts, availableParts, activePart) {
  const levelSelect = document.getElementById("vocab-level-select");
  const filterSelect = document.getElementById("vocab-filter-select");
  const partSelect = document.getElementById("vocab-part-select");
  const activeView = getVocabView();

  renderStudyCatalogControls({
    viewSelector: "[data-vocab-view]",
    viewAttribute: "data-vocab-view",
    activeView,
    selectConfigs: [
      {
        element: levelSelect,
        populate: populateVocabLevelSelect
      },
      {
        element: filterSelect,
        populate: (element) => populateVocabFilterSelect(element, counts)
      },
      {
        element: partSelect,
        populate: (element) => populateVocabPartSelect(element, availableParts, activePart)
      }
    ]
  });
}

function renderVocabQuizControls(counts, availableParts, activePart) {
  const optionsShell = document.getElementById("vocab-quiz-options-shell");
  const optionsToggle = document.getElementById("vocab-quiz-options-toggle");
  const optionsPanel = document.getElementById("vocab-quiz-options-panel");
  const optionsSummary = document.getElementById("vocab-quiz-options-summary");
  const questionFieldSelect = document.getElementById("vocab-quiz-question-field");
  const optionFieldSelect = document.getElementById("vocab-quiz-option-field");
  const levelSelect = document.getElementById("vocab-quiz-level-select");
  const filterSelect = document.getElementById("vocab-quiz-filter-select");
  const partSelect = document.getElementById("vocab-quiz-part-select");
  const countSpinner = document.querySelector('[data-spinner-id="vocab-quiz-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="vocab-quiz-time"]');
  const isOptionsOpen = state.vocabQuizOptionsOpen === true;
  const activeQuestionField = getVocabQuizQuestionField();
  const activeOptionField = getVocabQuizOptionField();
  const activeCount = getVocabQuizCount();
  const activeDuration = getVocabQuizDuration();
  const isSettingsLocked = state.vocabQuizStarted && !state.vocabQuizFinished;
  const isFilterLocked = state.vocabQuizStarted && !state.vocabQuizFinished;

  renderStudyOptionsControls({
    shell: optionsShell,
    toggle: optionsToggle,
    panel: optionsPanel,
    summary: optionsSummary,
    summaryText: getVocabQuizOptionsSummaryText(),
    isLocked: isSettingsLocked,
    isOpen: isOptionsOpen,
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: vocabQuizCountOptions,
        activeValue: activeCount,
        formatValue: formatQuestionCountLabel,
        disabled: isSettingsLocked
      },
      {
        spinner: timeSpinner,
        options: quizDurationOptions,
        activeValue: activeDuration,
        formatValue: getDurationLabel,
        disabled: isSettingsLocked
      }
    ],
    selectConfigs: [
      {
        element: questionFieldSelect,
        value: activeQuestionField,
        populate: populateVocabQuizFieldSelect
      },
      {
        element: optionFieldSelect,
        value: activeOptionField,
        populate: populateVocabQuizFieldSelect
      },
      {
        element: levelSelect,
        populate: (element) => populateVocabLevelSelect(element),
        disabled: isFilterLocked
      },
      {
        element: filterSelect,
        populate: (element) => populateVocabFilterSelect(element, counts),
        disabled: isFilterLocked
      },
      {
        element: partSelect,
        populate: (element) => populateVocabPartSelect(element, availableParts, activePart),
        disabled: isFilterLocked
      }
    ]
  });
}

function renderVocabQuiz() {
  const view = document.getElementById("vocab-quiz");
  const resultView = document.getElementById("vocab-quiz-result-view");
  const empty = document.getElementById("vocab-quiz-empty");
  const card = document.getElementById("vocab-quiz-card");
  const track = document.getElementById("vocab-quiz-track");
  const source = document.getElementById("vocab-quiz-source");
  const progress = document.getElementById("vocab-quiz-progress");
  const title = document.getElementById("vocab-quiz-title");
  const note = document.getElementById("vocab-quiz-note");
  const prompt = document.getElementById("vocab-quiz-prompt");
  const display = document.getElementById("vocab-quiz-display");
  const displaySub = document.getElementById("vocab-quiz-display-sub");
  const options = document.getElementById("vocab-quiz-options");
  const feedback = document.getElementById("vocab-quiz-feedback");
  const explanation = document.getElementById("vocab-quiz-explanation");
  const restart = document.getElementById("vocab-quiz-restart");
  const restartLabel = document.getElementById("vocab-quiz-restart-label");
  const next = document.getElementById("vocab-quiz-next");
  const items = getVocabQuizItems();
  const canStart = items.length >= 4;

  if (
    !view ||
    !resultView ||
    !empty ||
    !card ||
    !track ||
    !source ||
    !progress ||
    !title ||
    !note ||
    !prompt ||
    !display ||
    !displaySub ||
    !options ||
    !feedback ||
    !explanation ||
    !restart ||
    !restartLabel ||
    !next
  ) {
    return;
  }

  if (!state.vocabQuizStarted) {
    stopQuizSessionTimer("vocab");
    quizSessions.vocab.correct = 0;
    quizSessions.vocab.streak = 0;
    setQuizSessionDuration("vocab", getVocabQuizDuration());
    view.hidden = false;
    resultView.hidden = true;
    empty.hidden = false;
    empty.textContent = canStart
      ? "준비됐다면 시작해볼까요?"
      : getVocabQuizEmptyText(items);
    card.hidden = true;
    progress.textContent = `0 / ${getVocabQuizCount()}`;
    restart.classList.add("primary-btn");
    restart.classList.remove("secondary-btn");
    restart.disabled = !canStart;
    restartLabel.textContent = "시작해볼까요?";
    setActionButtonIcon(restart, "play_arrow");
    next.hidden = true;
    next.disabled = true;
    renderQuizSessionHud("vocab");
    return;
  }

  ensureVocabQuizSession();
  const question = getCurrentVocabQuizQuestion();

  if (!question) {
    stopQuizSessionTimer("vocab");
    setQuizSessionDuration("vocab", getVocabQuizDuration());
    view.hidden = false;
    resultView.hidden = true;
    empty.hidden = false;
    empty.textContent = getVocabQuizEmptyText(items);
    card.hidden = true;
    progress.textContent = "0 / 0";
    restart.classList.add("primary-btn");
    restart.classList.remove("secondary-btn");
    restart.disabled = !canStart;
    restartLabel.textContent = "시작해볼까요?";
    setActionButtonIcon(restart, "play_arrow");
    state.vocabQuizStarted = false;
    renderQuizSessionHud("vocab");
    return;
  }

  view.hidden = false;
  resultView.hidden = true;
  empty.hidden = true;
  card.hidden = false;
  track.textContent = getVocabQuizConfigLabel();
  source.textContent = getVocabQuizSourceLabel();
  restart.classList.add("secondary-btn");
  restart.classList.remove("primary-btn");
  restart.disabled = false;
  restartLabel.textContent = "다시 해볼까요?";
  setActionButtonIcon(restart, "autorenew");

  if (state.vocabQuizFinished) {
    const total = activeVocabQuizQuestions.length;

    stopQuizSessionTimer("vocab");
    renderQuizSessionHud("vocab");
    view.hidden = true;
    resultView.hidden = false;
    progress.textContent = `${total} / ${total}`;
    next.hidden = true;
    next.disabled = false;
    restartLabel.textContent = "다시 해볼까요?";
    setActionButtonIcon(restart, "autorenew");
    renderVocabQuizResults();
    return;
  }

  renderQuizSessionHud("vocab");
  card.className = `basic-practice-card vocab-quiz-card ${question.tone || "tone-coral"}`;
  progress.textContent = `${state.vocabQuizIndex + 1} / ${activeVocabQuizQuestions.length}`;
  title.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(question.title));
  note.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(question.note));
  prompt.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(question.prompt));
  display.textContent = formatQuizLineBreaks(question.display);
  displaySub.textContent = formatQuizLineBreaks(softenVisibleKoreanCopy(question.displaySub || ""));
  feedback.textContent = "";
  explanation.textContent = "";
  next.hidden = false;
  next.disabled = true;
  next.textContent =
    state.vocabQuizIndex >= activeVocabQuizQuestions.length - 1 ? "결과 볼까요?" : "다음 문제 볼까요?";

  renderChoiceOptionButtons({
    container: options,
    options: question.options,
    buttonClassName: "basic-practice-option",
    formatText: (option) => formatQuizLineBreaks(softenVisibleKoreanCopy(option)),
    onSelect: handleVocabQuizAnswer
  });

  resetQuizSessionTimer("vocab", handleVocabQuizTimeout);
}

function renderVocabPage() {
  const cardView = document.getElementById("vocab-card-view");
  const listView = document.getElementById("vocab-list-view");
  const summary = document.getElementById("vocab-summary");
  const headingTitle = document.getElementById("vocab-heading-title");
  const headingCopy = document.getElementById("vocab-heading-copy");
  const items = getVisibleVocabList();
  const counts = getVocabFilterCounts();
  const activeLevel = getVocabLevel();
  const activePart = getVocabPartFilter();
  const activeTab = getVocabTab();
  const activeHeadingMap = activeTab === "quiz" ? quizHeadingCopy : vocabHeadingCopy;
  const heading = activeTab === "match" ? matchHeadingCopy : activeHeadingMap[activeLevel] || activeHeadingMap.N5;
  const availableParts = getAvailableVocabParts();

  applyPageHeading(headingTitle, headingCopy, heading);

  if (summary) {
    summary.textContent = getVocabSummaryText(items.length);
  }

  renderVocabTabLayout();
  renderVocabStudyControls(counts, availableParts, activePart);
  renderVocabQuizControls(counts, availableParts, activePart);
  renderStudyCatalogSection({
    cardView,
    listView,
    activeView: getVocabView(),
    renderFlashcard: renderFlashcard,
    renderList: renderVocabList
  });

  if (activeTab === "quiz") {
    syncVocabLocationHash("quiz");
    renderVocabQuiz();
  } else {
    stopQuizSessionTimer("vocab");
    syncVocabLocationHash(activeTab);
  }
}

function toggleFlashcardReveal() {
  toggleStudyFlashcardReveal("flashcardRevealed", () => {
    renderVocabPage();
    renderStats();
  });
}

function moveFlashcard(step) {
  moveStudyFlashcard(step, {
    getCards: getVisibleFlashcards,
    indexKey: "flashcardIndex",
    revealedKey: "flashcardRevealed",
    render: renderVocabPage
  });
}

function markFlashcardForReview() {
  markStudyFlashcardStatus({
    getCards: getVisibleFlashcards,
    indexKey: "flashcardIndex",
    revealedKey: "flashcardRevealed",
    saveItem: saveWordToReviewList,
    syncIndexAfterUpdate: syncFlashcardIndexAfterVocabUpdate,
    render: renderAll
  });
}

function markFlashcardMastered() {
  markStudyFlashcardStatus({
    getCards: getVisibleFlashcards,
    indexKey: "flashcardIndex",
    revealedKey: "flashcardRevealed",
    saveItem: saveWordToMasteredList,
    syncIndexAfterUpdate: syncFlashcardIndexAfterVocabUpdate,
    render: renderAll
  });
}

function renderGrammar() {
  const grammarGrid = document.getElementById("grammar-grid");

  if (!grammarGrid) {
    return;
  }

  grammarGrid.innerHTML = "";

  grammarItems.forEach((item) => {
    const article = document.createElement("article");
    article.className = "grammar-item";
    const checked = state.grammarDoneIds.includes(item.id);

    article.innerHTML = `
      <div class="grammar-header">
        <span class="grammar-level">${item.level}</span>
        <span>${checked ? "해봤어요" : "지금 해봐요"}</span>
      </div>
      <h3>${item.pattern}</h3>
      <p>${item.description}</p>
      <button class="secondary-btn grammar-toggle${checked ? " is-checked" : ""}" type="button">
        ${checked ? "한 번 더 해봐요" : "해봤어요"}
      </button>
    `;

    article.querySelector(".grammar-toggle").addEventListener("click", () => {
      if (checked) {
        state.grammarDoneIds = state.grammarDoneIds.filter((id) => id !== item.id);
      } else {
        state.grammarDoneIds.push(item.id);
        updateStudyStreak();
      }

      saveState();
      renderAll();
    });

    grammarGrid.appendChild(article);
  });
}

function renderGrammarPageLayout() {
  const activeTab = getGrammarTab(state.grammarTab);

  document.querySelectorAll("[data-grammar-tab]").forEach((button) => {
    const isActive = button.dataset.grammarTab === activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  document.querySelectorAll("[data-grammar-tab-panel]").forEach((panel) => {
    const isActive = panel.dataset.grammarTabPanel === activeTab;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", String(!isActive));
  });

  if (activeTab === "practice") {
    renderGrammarPractice();
    return;
  }

  stopQuizSessionTimer("grammar");
  renderQuizSessionHud("grammar");
}

function getGrammarPracticeOptionsSummaryText() {
  return [
    getLevelSummaryLabel(getGrammarPracticeLevel()),
    formatQuestionCountLabel(getGrammarPracticeCount()),
    getDurationLabel(getGrammarPracticeDuration())
  ].join(" · ");
}

function setGrammarPracticeLevel(level) {
  const nextLevel = getGrammarPracticeLevel(level);

  if (state.grammarPracticeLevel === nextLevel) {
    return;
  }

  state.grammarPracticeLevel = nextLevel;
  saveState();
  renderGrammarPractice();
}

function setGrammarPracticeDuration(duration) {
  const nextDuration = getGrammarPracticeDuration(duration);

  if (state.grammarPracticeDuration === nextDuration) {
    return;
  }

  state.grammarPracticeDuration = nextDuration;
  saveState();
  renderGrammarPractice();
}

function invalidateGrammarPracticeSession() {
  state.grammarPracticeStarted = false;
  state.grammarPracticeSessionQuestionIndex = 0;
  quizSessions.grammar.correct = 0;
  quizSessions.grammar.streak = 0;
  setQuizSessionDuration("grammar", getGrammarPracticeDuration());
  stopQuizSessionTimer("grammar");
}

function renderGrammarPracticeControls() {
  const optionsShell = document.getElementById("grammar-practice-options-shell");
  const optionsToggle = document.getElementById("grammar-practice-options-toggle");
  const optionsPanel = document.getElementById("grammar-practice-options-panel");
  const optionsSummary = document.getElementById("grammar-practice-options-summary");
  const levelSelect = document.getElementById("grammar-practice-level-select");
  const countSpinner = document.querySelector('[data-spinner-id="grammar-practice-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="grammar-practice-time"]');
  const startButton = document.getElementById("grammar-practice-start");
  const startLabel = document.getElementById("grammar-practice-start-label");
  const activeLevel = getGrammarPracticeLevel(state.grammarPracticeLevel);
  const activeCount = getGrammarPracticeCount(state.grammarPracticeCount);
  const activeDuration = getGrammarPracticeDuration(state.grammarPracticeDuration);
  const isOptionsOpen = state.grammarPracticeOptionsOpen === true;
  const canStart = (grammarPracticeSets[activeLevel] || []).length > 0;
  const isSettingsLocked = state.grammarPracticeStarted;

  renderStudyOptionsControls({
    shell: optionsShell,
    toggle: optionsToggle,
    panel: optionsPanel,
    summary: optionsSummary,
    summaryText: getGrammarPracticeOptionsSummaryText(),
    isLocked: isSettingsLocked,
    isOpen: isOptionsOpen,
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: grammarPracticeCountOptions,
        activeValue: activeCount,
        formatValue: formatQuestionCountLabel,
        disabled: isSettingsLocked
      },
      {
        spinner: timeSpinner,
        options: grammarPracticeDurationOptions,
        activeValue: activeDuration,
        formatValue: getDurationLabel,
        disabled: isSettingsLocked
      }
    ],
    selectConfigs: [
      {
        element: levelSelect,
        populate: (element) => populateContentLevelSelect(element, activeLevel, { includeAll: true })
      }
    ],
    actionButton: {
      button: startButton,
      label: startLabel,
      isStarted: state.grammarPracticeStarted,
      canStart: state.grammarPracticeStarted || canStart
    }
  });
}

function getPracticeLevelIndex(indexes, activeLevel) {
  const rawIndex = Number.isFinite(Number(indexes?.[activeLevel])) ? Number(indexes[activeLevel]) : 0;

  return Number.isFinite(rawIndex) ? rawIndex : 0;
}

function getCurrentGrammarPracticeSet() {
  const activeLevel = getGrammarPracticeLevel(state.grammarPracticeLevel);
  const sets = grammarPracticeSets[activeLevel] || [];
  const currentIndex = getPracticeLevelIndex(state.grammarPracticeIndexes, activeLevel) % (sets.length || 1);

  if (!sets.length) {
    return null;
  }
  return sets[currentIndex];
}

function renderGrammarPractice() {
  const empty = document.getElementById("grammar-practice-empty");
  const practiceView = document.getElementById("grammar-practice-view");
  const grammarCard = document.querySelector(".grammar-practice-card");
  const optionsContainer = document.getElementById("grammar-practice-options");
  const nextButton = document.getElementById("grammar-practice-next");
  const level = document.getElementById("grammar-practice-level");
  const source = document.getElementById("grammar-practice-source");
  const progress = document.getElementById("grammar-practice-progress");
  const title = document.getElementById("grammar-practice-title");
  const note = document.getElementById("grammar-practice-note");
  const sentence = document.getElementById("grammar-practice-sentence");
  const feedback = document.getElementById("grammar-practice-feedback");
  const explanation = document.getElementById("grammar-practice-explanation");
  const activeLevel = getGrammarPracticeLevel(state.grammarPracticeLevel);
  const activeDuration = getGrammarPracticeDuration(state.grammarPracticeDuration);
  const sets = grammarPracticeSets[activeLevel] || [];
  const current = getCurrentGrammarPracticeSet();
  const activeCount = getGrammarPracticeCount(state.grammarPracticeCount);
  const currentSessionIndex = Number.isFinite(Number(state.grammarPracticeSessionQuestionIndex))
    ? Number(state.grammarPracticeSessionQuestionIndex)
    : 0;

  renderGrammarPracticeControls();

  if (
    !empty ||
    !practiceView ||
    !grammarCard ||
    !optionsContainer ||
    !nextButton ||
    !level ||
    !source ||
    !progress ||
    !title ||
    !note ||
    !sentence ||
    !feedback ||
    !explanation
  ) {
    return;
  }

  if (!state.grammarPracticeStarted) {
    stopQuizSessionTimer("grammar");
    quizSessions.grammar.correct = 0;
    quizSessions.grammar.streak = 0;
    setQuizSessionDuration("grammar", activeDuration);
    empty.hidden = false;
    empty.textContent = sets?.length
      ? "준비됐다면 시작해볼까요?"
      : "문법 문제를 준비하고 있어요.";
    practiceView.hidden = true;
    renderQuizSessionHud("grammar");
    return;
  }

  if (currentSessionIndex >= activeCount) {
    state.grammarPracticeStarted = false;
    state.grammarPracticeSessionQuestionIndex = 0;
    saveState();
    renderGrammarPractice();
    return;
  }

  if (!current || !sets?.length) {
    stopQuizSessionTimer("grammar");
    setQuizSessionDuration("grammar", activeDuration);
    empty.hidden = false;
    empty.textContent = "문법 문제를 준비하고 있어요.";
    practiceView.hidden = true;
    renderQuizSessionHud("grammar");
    return;
  }

  empty.hidden = true;
  practiceView.hidden = false;

  level.textContent = activeLevel;
  source.textContent = current.source;
  progress.textContent =
    `${currentSessionIndex + 1} / ${activeCount}`;
  title.textContent = softenVisibleKoreanCopy(current.title);
  note.textContent = softenVisibleKoreanCopy(current.note);
  sentence.textContent = current.sentence;
  feedback.textContent = "";
  explanation.textContent = "";
  nextButton.textContent = currentSessionIndex >= activeCount - 1 ? "결과 보기" : "다음 문제 보기";
  nextButton.disabled = true;
  delete optionsContainer.dataset.answered;

  grammarCard.className = `grammar-practice-card ${current.tone}`;

  renderChoiceOptionButtons({
    container: optionsContainer,
    options: current.options,
    buttonClassName: "grammar-practice-option",
    formatText: softenVisibleKoreanCopy,
    onSelect: handleGrammarPracticeAnswer
  });

  setQuizSessionDuration("grammar", activeDuration);
  resetQuizSessionTimer("grammar", handleGrammarPracticeTimeout);
}

function handleGrammarPracticeAnswer(index) {
  const current = getCurrentGrammarPracticeSet();
  const options = document.querySelectorAll(".grammar-practice-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);
  const nextButton = document.getElementById("grammar-practice-next");
  const activeCount = getGrammarPracticeCount(state.grammarPracticeCount);
  const isLastQuestion = state.grammarPracticeSessionQuestionIndex >= activeCount - 1;

  if (alreadyAnswered) {
    return;
  }

  const correct = index === current.answer;
  finalizeQuizSession("grammar", correct);

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === current.answer,
    isSelectedOption: (_, optionIndex) => optionIndex === index,
    markSelected: false
  });

  document.getElementById("grammar-practice-feedback").textContent = correct
    ? "좋아요!"
    : "아깝네요! 정답 같이 볼까요?";
  document.getElementById("grammar-practice-explanation").textContent = softenExplanationCopy(current.explanation);
  if (nextButton) {
    nextButton.textContent = isLastQuestion ? "결과 보기" : "다음 문제 보기";
    nextButton.disabled = false;
  }
  const optionsContainer = document.getElementById("grammar-practice-options");

  if (optionsContainer) {
    optionsContainer.dataset.answered = "true";
  }

  updateStudyStreak();
  saveState();
  renderStats();
}

function handleGrammarPracticeTimeout() {
  const current = getCurrentGrammarPracticeSet();
  const options = document.querySelectorAll(".grammar-practice-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);
  const nextButton = document.getElementById("grammar-practice-next");
  const activeCount = getGrammarPracticeCount(state.grammarPracticeCount);
  const isLastQuestion = state.grammarPracticeSessionQuestionIndex >= activeCount - 1;

  if (alreadyAnswered) {
    return;
  }

  finalizeQuizSession("grammar", false);

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === current.answer,
    markSelected: false
  });

  document.getElementById("grammar-practice-feedback").textContent = "";
  document.getElementById("grammar-practice-explanation").textContent = softenExplanationCopy(current.explanation);
  if (nextButton) {
    nextButton.textContent = isLastQuestion ? "결과 보기" : "다음 문제 보기";
    nextButton.disabled = false;
  }
  if (document.getElementById("grammar-practice-options")) {
    document.getElementById("grammar-practice-options").dataset.answered = "true";
  }

  updateStudyStreak();
  saveState();
  renderStats();
}

function nextGrammarPracticeSet() {
  const nextButton = document.getElementById("grammar-practice-next");
  const activeLevel = getGrammarPracticeLevel(state.grammarPracticeLevel);
  const sets = grammarPracticeSets[activeLevel] || [];
  const questionLimit = getGrammarPracticeCount(state.grammarPracticeCount);
  const currentSessionIndex = Number.isFinite(Number(state.grammarPracticeSessionQuestionIndex))
    ? Number(state.grammarPracticeSessionQuestionIndex)
    : 0;

  if (!sets.length || !nextButton || nextButton.disabled) {
    return;
  }

  if (currentSessionIndex >= questionLimit - 1) {
    state.grammarPracticeStarted = false;
    state.grammarPracticeSessionQuestionIndex = 0;
    saveState();
    renderGrammarPractice();
    return;
  }

  state.grammarPracticeLevel = activeLevel;
  state.grammarPracticeSessionQuestionIndex = currentSessionIndex + 1;
  state.grammarPracticeIndexes[activeLevel] =
    (state.grammarPracticeIndexes[activeLevel] + 1) % sets.length;
  saveState();
  renderGrammarPractice();
}

function restartGrammarPractice() {
  if (state.grammarPracticeStarted) {
    invalidateGrammarPracticeSession();
    saveState();
    renderGrammarPractice();
    return;
  }

  stopQuizSessionTimer("grammar");
  quizSessions.grammar.correct = 0;
  quizSessions.grammar.streak = 0;
  setQuizSessionDuration("grammar", state.grammarPracticeDuration);
  state.grammarPracticeSessionQuestionIndex = 0;
  state.grammarPracticeStarted = true;
  saveState();
  renderGrammarPractice();
}

function getQuizQuestion() {
  if (!activeQuizQuestions.length) {
    activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize, state.quizLevel);
  }

  return activeQuizQuestions[state.quizIndex] || activeQuizQuestions[0];
}

function getQuizAccuracyValue(correct = quizSessions.quiz.correct, total = activeQuizQuestions.length) {
  return total ? Math.round((correct / total) * 100) : 0;
}

function getQuizModeLabel(mode = state.quizMode) {
  return quizModeLabels[getQuizMode(mode)];
}

function getQuizOptionsSummaryText() {
  return [
    getQuizLevelLabel(),
    getQuizModeLabel(),
    `${getQuizSessionSize(state.quizSessionSize)}문제`,
    getDurationLabel(getQuizDuration())
  ].join(" · ");
}

function setQuizLevel(level) {
  const nextLevel = getQuizLevel(level);

  if (state.quizLevel === nextLevel) {
    return;
  }

  state.quizLevel = nextLevel;
  refreshQuizContent(nextLevel);
  startNewQuizSession();
}

function setQuizDuration(duration) {
  const nextDuration = getQuizDuration(duration);

  if (state.quizDuration === nextDuration) {
    return;
  }

  state.quizDuration = nextDuration;
  startNewQuizSession();
}

function getQuizNextButton() {
  return document.getElementById("quiz-next");
}

function getQuizRestartButton() {
  return document.getElementById("quiz-restart");
}

function setQuizActionState({ nextLabel, nextDisabled = false, nextHidden = false, restartHidden = false }) {
  const nextButton = getQuizNextButton();
  const restartButton = getQuizRestartButton();

  if (nextButton) {
    nextButton.textContent = nextLabel;
    nextButton.disabled = nextDisabled;
    nextButton.hidden = nextHidden;
  }

  if (restartButton) {
    restartButton.hidden = restartHidden;
  }
}

function renderQuizControls() {
  const optionsShell = document.getElementById("quiz-options-shell");
  const optionsToggle = document.getElementById("quiz-options-toggle");
  const optionsPanel = document.getElementById("quiz-options-panel");
  const optionsSummary = document.getElementById("quiz-options-summary");
  const headingTitle = document.getElementById("quiz-heading-title");
  const headingCopy = document.getElementById("quiz-heading-copy");
  const activeLevel = getQuizLevel();
  const heading = quizHeadingCopy[activeLevel] || quizHeadingCopy.N5;
  const sizeButtons = document.querySelectorAll("[data-quiz-size]");
  const modeButtons = document.querySelectorAll("[data-quiz-mode]");
  const levelButtons = document.querySelectorAll("[data-quiz-level]");
  const timeButtons = document.querySelectorAll("[data-quiz-time]");
  const isOptionsOpen = state.quizOptionsOpen === true;

  if (headingTitle) {
    headingTitle.textContent = heading.title;
  }

  if (headingCopy) {
    headingCopy.textContent = heading.description;
  }

  renderOpenableSettingsSection({
    shell: optionsShell,
    toggle: optionsToggle,
    panel: optionsPanel,
    summary: optionsSummary,
    summaryText: getQuizOptionsSummaryText(),
    isOpen: isOptionsOpen
  });
  syncSelectionButtonState(levelButtons, (button) => button.dataset.quizLevel, activeLevel);
  syncSelectionButtonState(sizeButtons, (button) => Number(button.dataset.quizSize), state.quizSessionSize);
  syncSelectionButtonState(modeButtons, (button) => button.dataset.quizMode, state.quizMode);
  syncSelectionButtonState(timeButtons, (button) => Number(button.dataset.quizTime), getQuizDuration());
}

function renderQuizResult() {
  const result = document.getElementById("quiz-result");
  const score = document.getElementById("quiz-result-score");
  const accuracy = document.getElementById("quiz-result-accuracy");
  const wrong = document.getElementById("quiz-result-wrong");
  const copy = document.getElementById("quiz-result-copy");

  if (!result || !score || !accuracy || !wrong || !copy) {
    return;
  }

  const total = activeQuizQuestions.length;
  const correct = quizSessions.quiz.correct;
  const wrongCount = total - correct;

  result.hidden = false;
  score.textContent = `${correct} / ${total}`;
  accuracy.textContent = `${getQuizAccuracyValue(correct, total)}%`;
  wrong.textContent = `${wrongCount}개`;
  copy.textContent =
    wrongCount === 0
      ? `${getQuizModeLabel()} ${total}문제, 전부 맞혔어요!`
      : `${getQuizModeLabel()} ${total}문제까지 왔어요. 틀린 문제는 다시 볼까요?`;
}

function renderQuizMistakes() {
  const empty = document.getElementById("quiz-note-empty");
  const list = document.getElementById("quiz-note-list");

  if (!empty || !list) {
    return;
  }

  if (!state.quizMistakes.length) {
    empty.hidden = false;
    list.innerHTML = "";
    return;
  }

  empty.hidden = true;
  list.innerHTML = state.quizMistakes
    .map(
      (item) => `
        <article class="quiz-note-item">
          <div class="quiz-note-item-head">
            <span>${item.modeLabel}</span>
            <strong>${item.word || item.correctAnswer}</strong>
          </div>
          <p class="quiz-note-item-prompt">${item.prompt}</p>
          <p class="quiz-note-item-meta">정답 · ${item.correctAnswer}</p>
          <p class="quiz-note-item-meta">내 답 · ${item.userAnswer}</p>
          <p class="quiz-note-item-meta">읽기 · ${item.reading || "-"}</p>
          <p class="quiz-note-item-meta">뜻 · ${item.meaning || "-"}</p>
        </article>
      `
    )
    .join("");
}

function resetQuizSessionStats() {
  quizSessions.quiz.correct = 0;
  quizSessions.quiz.streak = 0;
  setQuizSessionDuration("quiz", state.quizDuration);
  renderQuizSessionHud("quiz");
}

function startNewQuizSession() {
  state.quizLevel = getQuizLevel(state.quizLevel);
  state.quizMode = getQuizMode(state.quizMode);
  state.quizSessionSize = getQuizSessionSize(state.quizSessionSize);
  state.quizDuration = getQuizDuration(state.quizDuration);
  state.quizIndex = 0;
  state.quizSessionFinished = false;
  state.quizSessionMistakeIds = [];
  refreshQuizContent(state.quizLevel);
  activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize, state.quizLevel);
  resetQuizSessionStats();
  saveState();
  renderQuiz();
}

function getQuizFeedbackText(question, correct, userAnswer) {
  const readingText = question.meta?.reading ? ` 읽기 · ${question.meta.reading}` : "";
  const meaningText = question.meta?.meaning ? ` 뜻 · ${question.meta.meaning}` : "";

  if (correct) {
    return question.meta?.mode === "reading"
      ? `좋아요!${meaningText}`
      : `좋아요!${readingText}`;
  }

  return `아깝네요! 정답은 "${question.answer}"예요.${question.meta?.mode === "reading" ? meaningText : readingText} ${
    userAnswer === "시간 초과" ? "시간 초과로 남겨둘게요." : ""
  }`.trim();
}

function rememberQuizMistake(question, userAnswer) {
  const noteId = `${question.meta?.mode || "meaning"}:${question.meta?.sourceId || question.id}`;
  const note = {
    id: noteId,
    modeLabel: getQuizModeLabel(question.meta?.mode),
    prompt: question.question,
    word: question.meta?.word || "",
    reading: question.meta?.reading || "",
    meaning: question.meta?.meaning || "",
    correctAnswer: question.answer,
    userAnswer,
    updatedAt: new Date().toISOString()
  };

  state.quizMistakes = [note, ...state.quizMistakes.filter((item) => item.id !== noteId)].slice(0, 30);

  if (!state.quizSessionMistakeIds.includes(noteId)) {
    state.quizSessionMistakeIds.push(noteId);
  }
}

function legacyRevealQuizAnswer(question, selectedOption, correct) {
  const answerIndex = question.options.indexOf(selectedOption);
  const options = document.querySelectorAll(".quiz-option");

  options.forEach((item) => {
    item.disabled = true;

    if (item.textContent === question.answer || item.textContent === selectedOption) {
      item.classList.add("is-correct");
    }
  });
}

function legacyRevealQuizAnswerWithIndex(question, selectedIndex, correct) {
  const answerIndex = question.options.indexOf(question.answer);
  const options = document.querySelectorAll(".quiz-option");

  options.forEach((item, optionIndex) => {
    item.disabled = true;

    if (optionIndex === answerIndex) {
      item.classList.add("is-correct");
    }

    if (!correct && selectedIndex === optionIndex) {
      item.classList.add("is-wrong");
    }
  });
}

function legacyFinalizeQuizQuestion(question, selectedOption, correct) {
  const feedback = document.getElementById("quiz-feedback");
  const lastQuestion = state.quizIndex >= activeQuizQuestions.length - 1;

  state.quizAnsweredCount += 1;
  finalizeQuizSession("quiz", correct);

  if (correct) {
    state.quizCorrectCount += 1;
  } else {
    rememberQuizMistake(question, selectedOption || "시간 초과");
  }

  if (feedback) {
    feedback.textContent = lastQuestion
      ? `${getQuizFeedbackText(question, correct, selectedOption || "시간 초과")} 마지막 문제예요. 결과 보러 가볼까요?`
      : getQuizFeedbackText(question, correct, selectedOption || "시간 초과");
  }

  legacyRevealQuizAnswer(question, selectedOption, correct);
  setQuizActionState({
    nextLabel: lastQuestion ? "결과 보러 갈까요?" : "다음 문제 볼까요?",
    nextDisabled: false,
    nextHidden: false,
    restartHidden: false
  });

  updateStudyStreak();
  saveState();
  renderStats();
  renderQuizMistakes();
}

function renderQuiz() {
  const result = document.getElementById("quiz-result");
  const optionsContainer = document.getElementById("quiz-options");
  const level = document.getElementById("quiz-level");
  const progress = document.getElementById("quiz-progress");
  const questionText = document.getElementById("quiz-question");
  const feedback = document.getElementById("quiz-feedback");

  renderQuizControls();
  renderQuizMistakes();

  if (!optionsContainer || !level || !progress || !questionText || !feedback) {
    return;
  }

  if (state.quizSessionFinished) {
    stopQuizSessionTimer("quiz");
    level.textContent = `${getQuizLevelLabel()} · ${getQuizModeLabel()}`;
    progress.textContent = `${activeQuizQuestions.length} / ${activeQuizQuestions.length}`;
    questionText.textContent = "이번 퀴즈 끝!";
    feedback.textContent = `${activeQuizQuestions.length}문제까지 잘 풀었어요.`;
    optionsContainer.innerHTML = "";
    optionsContainer.hidden = true;
    setQuizActionState({
      nextLabel: "다음 문제 볼까요?",
      nextDisabled: true,
      nextHidden: true,
      restartHidden: false
    });
    renderQuizResult();
    return;
  }

  const question = getQuizQuestion();

  if (!question) {
    return;
  }

  if (result) {
    result.hidden = true;
  }

  level.textContent = `${getQuizLevelLabel()} · ${getQuizModeLabel()}`;
  progress.textContent = `${state.quizIndex + 1} / ${activeQuizQuestions.length}`;
  questionText.textContent = softenVisibleKoreanCopy(question.question);
  feedback.textContent = "";
  optionsContainer.hidden = false;
  optionsContainer.innerHTML = "";

  renderChoiceOptionButtons({
    container: optionsContainer,
    options: question.options,
    buttonClassName: "quiz-option",
    formatText: softenVisibleKoreanCopy,
    getOptionValue: (_, index) => index,
    onSelect: (index) => handleQuizAnswer(question, index),
    setPressedState: true
  });

  setQuizActionState({
    nextLabel:
      state.quizIndex >= activeQuizQuestions.length - 1
        ? "결과 보러 갈까요?"
        : "다음 문제 볼까요?",
    nextDisabled: true,
    nextHidden: false,
    restartHidden: false
  });
  resetQuizSessionTimer("quiz", handleQuizTimeout);
}

function revealQuizAnswer(question, selectedOptionOrIndex, correct) {
  const answerIndex = question.options.indexOf(question.answer);
  const selectedIndex = Number.isFinite(selectedOptionOrIndex)
    ? selectedOptionOrIndex
    : question.options.indexOf(selectedOptionOrIndex);
  const options = document.querySelectorAll(".quiz-option");

  options.forEach((item, optionIndex) => {
    item.disabled = true;

    if (optionIndex === answerIndex) {
      item.classList.add("is-correct");
    }

    if (!correct && optionIndex === selectedIndex) {
      item.classList.add("is-wrong");
    }
  });
}

function finalizeQuizQuestion(question, selectedOptionOrIndex, correct) {
  const feedback = document.getElementById("quiz-feedback");
  const lastQuestion = state.quizIndex >= activeQuizQuestions.length - 1;
  const selectedOption = Number.isFinite(selectedOptionOrIndex)
    ? question.options[selectedOptionOrIndex] ?? ""
    : selectedOptionOrIndex || "";

  state.quizAnsweredCount += 1;
  finalizeQuizSession("quiz", correct);

  if (correct) {
    state.quizCorrectCount += 1;
  } else {
    rememberQuizMistake(question, selectedOption);
  }

  if (feedback) {
    feedback.textContent = lastQuestion
      ? `${getQuizFeedbackText(question, correct, selectedOption)} 문제를 처리했습니다.`
      : getQuizFeedbackText(question, correct, selectedOption);
  }

  revealQuizAnswer(question, selectedOptionOrIndex, correct);
  setQuizActionState({
    nextLabel: lastQuestion ? "결과 확인" : "다음 문제 풀이",
    nextDisabled: false,
    nextHidden: false,
    restartHidden: false
  });

  updateStudyStreak();
  saveState();
  renderStats();
  renderQuizMistakes();
}

function handleQuizAnswer(question, option) {
  const selectedIndex = Number.isFinite(option) ? option : question.options.indexOf(option);
  const options = document.querySelectorAll(".quiz-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);

  if (alreadyAnswered) {
    return;
  }

  const correctAnswer = question.options.indexOf(question.answer);
  finalizeQuizQuestion(question, selectedIndex, selectedIndex === correctAnswer);
}

function handleQuizTimeout() {
  const question = getQuizQuestion();
  const options = document.querySelectorAll(".quiz-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);

  if (alreadyAnswered || !question) {
    return;
  }

  finalizeQuizQuestion(question, -1, false);
}

function nextQuiz() {
  const options = document.querySelectorAll(".quiz-option");
  const answered = hasAnsweredAllChoiceOptions(options);
  const feedback = document.getElementById("quiz-feedback");

  if (state.quizSessionFinished) {
    startNewQuizSession();
    return;
  }

  if (!answered) {
    if (feedback) {
      feedback.textContent = "답을 고르면 다음으로 넘어가요.";
    }
    return;
  }

  if (state.quizIndex >= activeQuizQuestions.length - 1) {
    state.quizSessionFinished = true;
    saveState();
    renderQuiz();
    return;
  }

  state.quizIndex += 1;
  saveState();
  renderQuiz();
}

function clearQuizMistakes() {
  state.quizMistakes = [];
  state.quizSessionMistakeIds = [];
  saveState();
  renderQuizMistakes();
}

function getReadingOptionsSummaryText() {
  return [
    getLevelSummaryLabel(getReadingLevel()),
    formatQuestionCountLabel(getReadingCount()),
    getDurationLabel(getReadingDuration())
  ].join(" · ");
}

function setReadingLevel(level) {
  const nextLevel = getReadingLevel(level);

  if (state.readingLevel === nextLevel) {
    return;
  }

  state.readingLevel = nextLevel;
  saveState();
  renderReadingPractice();
}

function setReadingDuration(duration) {
  const nextDuration = getReadingDuration(duration);

  if (state.readingDuration === nextDuration) {
    return;
  }

  state.readingDuration = nextDuration;
  saveState();
  renderReadingPractice();
}

function invalidateReadingPracticeSession() {
  state.readingStarted = false;
  state.readingSessionQuestionIndex = 0;
  quizSessions.reading.correct = 0;
  quizSessions.reading.streak = 0;
  setQuizSessionDuration("reading", getReadingDuration());
  stopQuizSessionTimer("reading");
}

function renderReadingControls() {
  const optionsShell = document.getElementById("reading-options-shell");
  const optionsToggle = document.getElementById("reading-options-toggle");
  const optionsPanel = document.getElementById("reading-options-panel");
  const optionsSummary = document.getElementById("reading-options-summary");
  const levelSelect = document.getElementById("reading-level-select");
  const countSpinner = document.querySelector('[data-spinner-id="reading-count"]');
  const timeSpinner = document.querySelector('[data-spinner-id="reading-time"]');
  const startButton = document.getElementById("reading-start");
  const startLabel = document.getElementById("reading-start-label");
  const activeLevel = getReadingLevel(state.readingLevel);
  const activeCount = getReadingCount(state.readingCount);
  const activeDuration = getReadingDuration(state.readingDuration);
  const isOptionsOpen = state.readingOptionsOpen === true;
  const canStart = (readingSets[activeLevel] || []).length > 0;
  const isSettingsLocked = state.readingStarted;

  renderStudyOptionsControls({
    shell: optionsShell,
    toggle: optionsToggle,
    panel: optionsPanel,
    summary: optionsSummary,
    summaryText: getReadingOptionsSummaryText(),
    isLocked: isSettingsLocked,
    isOpen: isOptionsOpen,
    spinnerConfigs: [
      {
        spinner: countSpinner,
        options: readingCountOptions,
        activeValue: activeCount,
        formatValue: formatQuestionCountLabel,
        disabled: isSettingsLocked
      },
      {
        spinner: timeSpinner,
        options: readingDurationOptions,
        activeValue: activeDuration,
        formatValue: getDurationLabel,
        disabled: isSettingsLocked
      }
    ],
    selectConfigs: [
      {
        element: levelSelect,
        populate: (element) => populateContentLevelSelect(element, activeLevel, { includeAll: true })
      }
    ],
    actionButton: {
      button: startButton,
      label: startLabel,
      isStarted: state.readingStarted,
      canStart: state.readingStarted || canStart
    }
  });
}

function getCurrentReadingSet() {
  const activeLevel = getReadingLevel(state.readingLevel);
  const sets = readingSets[activeLevel] || [];
  const currentIndex = getPracticeLevelIndex(state.readingIndexes, activeLevel) % (sets.length || 1);

  if (!sets.length) {
    return null;
  }
  return sets[currentIndex];
}

function renderReadingPractice() {
  const empty = document.getElementById("reading-empty");
  const practiceView = document.getElementById("reading-practice-view");
  const readingCard = document.querySelector(".reading-card");
  const passage = document.getElementById("reading-passage");
  const optionsContainer = document.getElementById("reading-options");
  const nextButton = document.getElementById("reading-next");
  const level = document.getElementById("reading-level");
  const source = document.getElementById("reading-source");
  const progress = document.getElementById("reading-progress");
  const title = document.getElementById("reading-title");
  const korean = document.getElementById("reading-korean");
  const question = document.getElementById("reading-question");
  const feedback = document.getElementById("reading-feedback");
  const explanation = document.getElementById("reading-explanation");
  state.readingLevel = getReadingLevel(state.readingLevel);
  state.readingDuration = getReadingDuration(state.readingDuration);
  renderReadingControls();
  const current = getCurrentReadingSet();
  const sets = readingSets[state.readingLevel] || [];
  const activeCount = getReadingCount(state.readingCount);
  const currentSessionIndex = Number.isFinite(Number(state.readingSessionQuestionIndex))
    ? Number(state.readingSessionQuestionIndex)
    : 0;

  if (
    !empty ||
    !practiceView ||
    !readingCard ||
    !passage ||
    !optionsContainer ||
    !level ||
    !source ||
    !progress ||
    !title ||
    !korean ||
    !question ||
    !feedback ||
    !explanation
  ) {
    return;
  }

  if (!state.readingStarted) {
    stopQuizSessionTimer("reading");
    setQuizSessionDuration("reading", state.readingDuration);
    empty.hidden = false;
    empty.textContent = sets.length
      ? "준비됐다면 시작해볼까요?"
      : "독해 데이터를 준비하고 있어요.";
    practiceView.hidden = true;
    renderQuizSessionHud("reading");
    return;
  }

  if (currentSessionIndex >= activeCount) {
    state.readingStarted = false;
    state.readingSessionQuestionIndex = 0;
    saveState();
    renderReadingPractice();
    return;
  }

  if (!current || !sets.length) {
    stopQuizSessionTimer("reading");
    setQuizSessionDuration("reading", state.readingDuration);
    empty.hidden = false;
    empty.textContent = "독해 데이터를 준비하고 있어요.";
    practiceView.hidden = true;
    renderQuizSessionHud("reading");
    return;
  }

  empty.hidden = true;
  practiceView.hidden = false;

  level.textContent = state.readingLevel;
  source.textContent = current.source;
  progress.textContent = `${currentSessionIndex + 1} / ${activeCount}`;
  title.textContent = softenVisibleKoreanCopy(current.title);
  korean.textContent = softenVisibleKoreanCopy(current.korean);
  question.textContent = softenVisibleKoreanCopy(current.question);
  feedback.textContent = "";
  explanation.textContent = "";
  nextButton.textContent = currentSessionIndex >= activeCount - 1 ? "결과 보기" : "다음 글 보기";
  nextButton.disabled = true;
  delete optionsContainer.dataset.answered;

  readingCard.className = `reading-card ${current.tone}`;

  passage.className = `reading-passage${current.passageStyle === "note" ? " is-note" : ""}`;
  passage.innerHTML = current.passage.map((line) => `<p>${line}</p>`).join("");

  renderChoiceOptionButtons({
    container: optionsContainer,
    options: current.options,
    buttonClassName: "reading-option",
    formatText: softenVisibleKoreanCopy,
    onSelect: handleReadingAnswer
  });

  setQuizSessionDuration("reading", state.readingDuration);
  resetQuizSessionTimer("reading", handleReadingTimeout);
}

function handleReadingAnswer(index) {
  const current = getCurrentReadingSet();
  const options = document.querySelectorAll(".reading-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);
  const nextButton = document.getElementById("reading-next");
  const activeCount = getReadingCount(state.readingCount);
  const isLastQuestion = state.readingSessionQuestionIndex >= activeCount - 1;

  if (alreadyAnswered) {
    return;
  }

  const correct = index === current.answer;
  finalizeQuizSession("reading", correct);

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === current.answer,
    isSelectedOption: (_, optionIndex) => optionIndex === index,
    markSelected: false
  });

  document.getElementById("reading-feedback").textContent = correct
    ? "좋아요!"
    : "아깝네요! 정답 같이 볼까요?";
  document.getElementById("reading-explanation").textContent = softenExplanationCopy(current.explanation);
  if (nextButton) {
    nextButton.textContent = isLastQuestion ? "결과 보기" : "다음 글 보기";
    nextButton.disabled = false;
  }
  const optionsContainer = document.getElementById("reading-options");

  if (optionsContainer) {
    optionsContainer.dataset.answered = "true";
  }

  updateStudyStreak();
  saveState();
  renderStats();
}

function handleReadingTimeout() {
  const current = getCurrentReadingSet();
  const options = document.querySelectorAll(".reading-option");
  const alreadyAnswered = hasAnsweredChoiceOptions(options);
  const nextButton = document.getElementById("reading-next");
  const activeCount = getReadingCount(state.readingCount);
  const isLastQuestion = state.readingSessionQuestionIndex >= activeCount - 1;

  if (alreadyAnswered) {
    return;
  }

  finalizeQuizSession("reading", false);

  applyChoiceOptionFeedback({
    options,
    isCorrectOption: (_, optionIndex) => optionIndex === current.answer,
    markSelected: false
  });

  document.getElementById("reading-feedback").textContent = "";
  document.getElementById("reading-explanation").textContent = softenExplanationCopy(current.explanation);
  if (nextButton) {
    nextButton.textContent = isLastQuestion ? "결과 보기" : "다음 글 보기";
    nextButton.disabled = false;
  }
  if (document.getElementById("reading-options")) {
    document.getElementById("reading-options").dataset.answered = "true";
  }

  updateStudyStreak();
  saveState();
  renderStats();
}

function nextReadingSet() {
  const nextButton = document.getElementById("reading-next");
  const activeLevel = getReadingLevel(state.readingLevel);
  const sets = readingSets[activeLevel] || [];
  const questionLimit = getReadingCount(state.readingCount);
  const currentSessionIndex = Number.isFinite(Number(state.readingSessionQuestionIndex))
    ? Number(state.readingSessionQuestionIndex)
    : 0;

  if (!sets.length || !nextButton || nextButton.disabled) {
    return;
  }

  if (currentSessionIndex >= questionLimit - 1) {
    state.readingStarted = false;
    state.readingSessionQuestionIndex = 0;
    saveState();
    renderReadingPractice();
    return;
  }

  state.readingLevel = activeLevel;
  state.readingSessionQuestionIndex = currentSessionIndex + 1;
  state.readingIndexes[activeLevel] = (state.readingIndexes[activeLevel] + 1) % sets.length;
  saveState();
  renderReadingPractice();
}

function restartReadingPractice() {
  if (state.readingStarted) {
    invalidateReadingPracticeSession();
    saveState();
    renderReadingPractice();
    return;
  }

  stopQuizSessionTimer("reading");
  quizSessions.reading.correct = 0;
  quizSessions.reading.streak = 0;
  setQuizSessionDuration("reading", state.readingDuration);
  state.readingSessionQuestionIndex = 0;
  state.readingStarted = true;
  saveState();
  renderReadingPractice();
}

function renderStats() {
  const accuracy = state.quizAnsweredCount
    ? Math.round((state.quizCorrectCount / state.quizAnsweredCount) * 100)
    : 0;
  const streak = document.getElementById("streak-value");
  const mastered = document.getElementById("mastered-count");
  const grammar = document.getElementById("grammar-count");
  const quiz = document.getElementById("quiz-accuracy");

  if (streak) {
    streak.textContent = `${state.streak}일`;
  }
  if (mastered) {
    mastered.textContent = `${state.masteredIds.length}개`;
  }
  if (grammar) {
    grammar.textContent = `${state.grammarDoneIds.length}개`;
  }
  if (quiz) {
    quiz.textContent = `${accuracy}%`;
  }
}

function attachStudyViewButtonListeners(buttons, getValue, setValue) {
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      setValue(getValue(button));
    });
  });
}

function attachStudyFlashcardListeners({
  toggle,
  prev,
  next,
  review,
  mastered,
  onToggle,
  onMove,
  onReview,
  onMastered
}) {
  if (toggle) {
    toggle.addEventListener("click", onToggle);
  }

  if (prev) {
    prev.addEventListener("click", () => onMove(-1));
  }

  if (next) {
    next.addEventListener("click", () => onMove(1));
  }

  if (review) {
    review.addEventListener("click", onReview);
  }

  if (mastered) {
    mastered.addEventListener("click", onMastered);
  }
}

function attachStudyPaginationListeners({ prev, next, getPage, setPage, getPageCount, render }) {
  if (prev) {
    prev.addEventListener("click", () => {
      if (getPage() <= 1) {
        return;
      }

      setPage(getPage() - 1);
      saveState();
      render();
    });
  }

  if (next) {
    next.addEventListener("click", () => {
      const pageCount = getPageCount();

      if (getPage() >= pageCount) {
        return;
      }

      setPage(getPage() + 1);
      saveState();
      render();
    });
  }
}

function attachStudyStatusListListeners({
  list,
  reviewSelector,
  masteredSelector,
  getReviewId,
  getMasteredId,
  toggleReview,
  toggleMastered,
  shouldUpdateStudyStreak = true,
  render
}) {
  if (!list) {
    return;
  }

  list.addEventListener("click", (event) => {
    const reviewButton = event.target.closest(reviewSelector);
    const masteredButton = event.target.closest(masteredSelector);

    if (!reviewButton && !masteredButton) {
      return;
    }

    if (reviewButton) {
      toggleReview(getReviewId(reviewButton));
    } else if (masteredButton) {
      toggleMastered(getMasteredId(masteredButton));
    }

    if (shouldUpdateStudyStreak) {
      updateStudyStreak();
    }

    saveState();
    render();
  });
}

function attachStudyCatalogListeners({
  optionsToggle,
  optionsStateKey,
  renderOptions,
  viewButtons,
  getViewValue,
  setView,
  flashcardListeners,
  paginationListeners,
  statusListListeners,
  selectListeners = []
}) {
  if (optionsToggle && optionsStateKey && typeof renderOptions === "function") {
    attachStateOptionsToggle(optionsToggle, optionsStateKey, renderOptions);
  }

  if (viewButtons && typeof getViewValue === "function" && typeof setView === "function") {
    attachStudyViewButtonListeners(viewButtons, getViewValue, setView);
  }

  if (flashcardListeners) {
    attachStudyFlashcardListeners(flashcardListeners);
  }

  if (paginationListeners) {
    attachStudyPaginationListeners(paginationListeners);
  }

  if (statusListListeners) {
    attachStudyStatusListListeners(statusListListeners);
  }

  selectListeners.forEach(({ element, handler }) => {
    attachSelectValueListener(element, handler);
  });
}

function attachVocabStudyListeners({
  flashcardToggle,
  flashcardPrev,
  flashcardNext,
  flashcardAgain,
  flashcardMastered,
  vocabList,
  vocabTabButtons,
  vocabViewButtons,
  vocabLevelSelect,
  vocabFilterSelect,
  vocabPartSelect,
  vocabPagePrev,
  vocabPageNext
}) {
  attachStudyCatalogListeners({
    viewButtons: vocabViewButtons,
    getViewValue: (button) => button.dataset.vocabView,
    setView: setVocabView,
    flashcardListeners: {
      toggle: flashcardToggle,
      prev: flashcardPrev,
      next: flashcardNext,
      review: flashcardAgain,
      mastered: flashcardMastered,
      onToggle: toggleFlashcardReveal,
      onMove: moveFlashcard,
      onReview: markFlashcardForReview,
      onMastered: markFlashcardMastered
    },
    paginationListeners: {
      prev: vocabPagePrev,
      next: vocabPageNext,
      getPage: () => state.vocabPage,
      setPage: (page) => {
        state.vocabPage = page;
      },
      getPageCount: () => getVocabPageCount(getVisibleVocabList()),
      render: renderVocabPage
    },
    statusListListeners: {
      list: vocabList,
      reviewSelector: "[data-word-review]",
      masteredSelector: "[data-word-mastered]",
      getReviewId: (button) => button.dataset.wordReview,
      getMasteredId: (button) => button.dataset.wordMastered,
      toggleReview: (id) => {
        if (isWordSavedToReviewList(id)) {
          removeWordFromReviewList(id);
        } else {
          saveWordToReviewList(id);
        }
      },
      toggleMastered: (id) => {
        if (isWordSavedToMasteredList(id)) {
          removeWordFromMasteredList(id);
        } else {
          saveWordToMasteredList(id);
        }
      },
      render: renderAll
    },
    selectListeners: [
      { element: vocabLevelSelect, handler: setVocabLevel },
      { element: vocabFilterSelect, handler: setVocabFilter },
      { element: vocabPartSelect, handler: setVocabPartFilter }
    ]
  });
  vocabTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setVocabTab(button.dataset.vocabTab);
    });
  });
}

function attachKanjiStudyListeners({
  kanjiOptionsToggle,
  kanjiGradeButtons,
  kanjiViewButtons,
  kanjiCollectionSelect,
  kanjiGradeSelect,
  kanjiPagePrev,
  kanjiPageNext,
  kanjiFlashcardToggle,
  kanjiFlashcardPrev,
  kanjiFlashcardNext,
  kanjiFlashcardReview,
  kanjiFlashcardMastered,
  kanjiList
}) {
  attachStudyCatalogListeners({
    optionsToggle: kanjiOptionsToggle,
    optionsStateKey: "kanjiOptionsOpen",
    renderOptions: renderKanjiStudyControls,
    viewButtons: kanjiViewButtons,
    getViewValue: (button) => button.dataset.kanjiView,
    setView: setKanjiView,
    flashcardListeners: {
      toggle: kanjiFlashcardToggle,
      prev: kanjiFlashcardPrev,
      next: kanjiFlashcardNext,
      review: kanjiFlashcardReview,
      mastered: kanjiFlashcardMastered,
      onToggle: toggleKanjiFlashcardReveal,
      onMove: moveKanjiFlashcard,
      onReview: markKanjiFlashcardForReview,
      onMastered: markKanjiFlashcardMastered
    },
    paginationListeners: {
      prev: kanjiPagePrev,
      next: kanjiPageNext,
      getPage: () => state.kanjiPage,
      setPage: (page) => {
        state.kanjiPage = page;
      },
      getPageCount: () => getKanjiPageCount(getVisibleKanjiItems()),
      render: renderKanjiPageLayout
    },
    statusListListeners: {
      list: kanjiList,
      reviewSelector: "[data-kanji-review]",
      masteredSelector: "[data-kanji-mastered]",
      getReviewId: (button) => button.dataset.kanjiReview,
      getMasteredId: (button) => button.dataset.kanjiMastered,
      toggleReview: (id) => {
        if (isKanjiSavedToReviewList(id)) {
          removeKanjiFromReviewList(id);
        } else {
          saveKanjiToReviewList(id);
        }
      },
      toggleMastered: (id) => {
        if (isKanjiSavedToMasteredList(id)) {
          removeKanjiFromMasteredList(id);
        } else {
          saveKanjiToMasteredList(id);
        }
      },
      render: () => {
        renderStats();
        renderKanjiPageLayout();
      }
    },
    selectListeners: [
      { element: kanjiCollectionSelect, handler: setKanjiCollectionFilter },
      { element: kanjiGradeSelect, handler: setKanjiGrade }
    ]
  });
  kanjiGradeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setKanjiGrade(button.dataset.kanjiGradeOption);
    });
  });
}

function attachEventListeners() {
  const flashcardToggle = document.getElementById("flashcard-toggle");
  const flashcardPrev = document.getElementById("flashcard-prev");
  const flashcardNext = document.getElementById("flashcard-next");
  const flashcardAgain = document.getElementById("flashcard-again");
  const flashcardMastered = document.getElementById("flashcard-mastered");
  const vocabTabButtons = document.querySelectorAll("[data-vocab-tab]");
  const vocabViewButtons = document.querySelectorAll("[data-vocab-view]");
  const vocabLevelSelect = document.getElementById("vocab-level-select");
  const vocabFilterSelect = document.getElementById("vocab-filter-select");
  const vocabPartSelect = document.getElementById("vocab-part-select");
  const vocabList = document.getElementById("vocab-list");
  const vocabPagePrev = document.getElementById("vocab-page-prev");
  const vocabPageNext = document.getElementById("vocab-page-next");
  const vocabQuizOptionsToggle = document.getElementById("vocab-quiz-options-toggle");
  const vocabQuizQuestionField = document.getElementById("vocab-quiz-question-field");
  const vocabQuizOptionField = document.getElementById("vocab-quiz-option-field");
  const vocabQuizCountSpinner = document.querySelector('[data-spinner-id="vocab-quiz-count"]');
  const vocabQuizTimeSpinner = document.querySelector('[data-spinner-id="vocab-quiz-time"]');
  const vocabQuizLevelSelect = document.getElementById("vocab-quiz-level-select");
  const vocabQuizFilterSelect = document.getElementById("vocab-quiz-filter-select");
  const vocabQuizPartSelect = document.getElementById("vocab-quiz-part-select");
  const vocabQuizResultFilter = document.getElementById("vocab-quiz-result-filter");
  const vocabQuizResultBulkAction = document.getElementById("vocab-quiz-result-bulk-action");
  const vocabQuizResultList = document.getElementById("vocab-quiz-result-list");
  const vocabQuizNext = document.getElementById("vocab-quiz-next");
  const vocabQuizRestart = document.getElementById("vocab-quiz-restart");
  const quizNext = document.getElementById("quiz-next");
  const quizRestart = document.getElementById("quiz-restart");
  const quizClearMistakes = document.getElementById("quiz-clear-mistakes");
  const quizOptionsToggle = document.getElementById("quiz-options-toggle");
  const quizLevelButtons = document.querySelectorAll("[data-quiz-level]");
  const quizSizeButtons = document.querySelectorAll("[data-quiz-size]");
  const quizModeButtons = document.querySelectorAll("[data-quiz-mode]");
  const quizTimeButtons = document.querySelectorAll("[data-quiz-time]");
  const grammarPracticeOptionsToggle = document.getElementById("grammar-practice-options-toggle");
  const grammarPracticeLevelSelect = document.getElementById("grammar-practice-level-select");
  const grammarPracticeCountSpinner = document.querySelector('[data-spinner-id="grammar-practice-count"]');
  const grammarPracticeTimeSpinner = document.querySelector('[data-spinner-id="grammar-practice-time"]');
  const grammarPracticeStart = document.getElementById("grammar-practice-start");
  const readingOptionsToggle = document.getElementById("reading-options-toggle");
  const readingLevelSelect = document.getElementById("reading-level-select");
  const readingCountSpinner = document.querySelector('[data-spinner-id="reading-count"]');
  const readingTimeSpinner = document.querySelector('[data-spinner-id="reading-time"]');
  const readingStart = document.getElementById("reading-start");
  const readingNext = document.getElementById("reading-next");
  const basicPracticeNext = document.getElementById("basic-practice-next");
  const kanjiList = document.getElementById("kanji-list");
  const kanjiOptionsToggle = document.getElementById("kanji-options-toggle");
  const kanjiGradeButtons = document.querySelectorAll("[data-kanji-grade-option]");
  const kanjiViewButtons = document.querySelectorAll("[data-kanji-view]");
  const kanjiCollectionSelect = document.getElementById("kanji-collection-select");
  const kanjiGradeSelect = document.getElementById("kanji-grade-select");
  const kanjiPagePrev = document.getElementById("kanji-page-prev");
  const kanjiPageNext = document.getElementById("kanji-page-next");
  const kanjiFlashcardToggle = document.getElementById("kanji-flashcard-toggle");
  const kanjiFlashcardPrev = document.getElementById("kanji-flashcard-prev");
  const kanjiFlashcardNext = document.getElementById("kanji-flashcard-next");
  const kanjiFlashcardReview = document.getElementById("kanji-flashcard-review");
  const kanjiFlashcardMastered = document.getElementById("kanji-flashcard-mastered");
  const starterKanjiOptionsToggle = document.getElementById("starter-kanji-options-toggle");
  const starterKanjiQuestionField = document.getElementById("starter-kanji-question-field");
  const starterKanjiOptionField = document.getElementById("starter-kanji-option-field");
  const starterKanjiCollectionSelect = document.getElementById("starter-kanji-collection-select");
  const starterKanjiGradeSelect = document.getElementById("starter-kanji-grade-select");
  const starterKanjiStart = document.getElementById("starter-kanji-start");
  const starterKanjiCountSpinner = document.querySelector('[data-spinner-id="starter-kanji-count"]');
  const starterKanjiTimeSpinner = document.querySelector('[data-spinner-id="starter-kanji-time"]');
  const starterKanjiNext = document.getElementById("starter-kanji-next");
  const starterKanjiRestart = document.getElementById("starter-kanji-restart");
  const starterKanjiResultBulkAction = document.getElementById("starter-kanji-result-bulk-action");
  const starterKanjiResultFilter = document.getElementById("starter-kanji-result-filter");
  const starterKanjiResultList = document.getElementById("starter-kanji-result-list");
  const kanjiTabButtons = document.querySelectorAll("[data-kanji-tab]");
  const grammarPracticeNext = document.getElementById("grammar-practice-next");
  const kanaQuizNext = document.getElementById("kana-quiz-next");
  const kanaQuizRestart = document.getElementById("kana-quiz-restart");
  const kanaQuizResultFilter = document.getElementById("kana-quiz-result-filter");
  const kanaSetupToggle = document.getElementById("kana-setup-toggle");
  const kanaModeButtons = document.querySelectorAll("[data-kana-mode]");
  const kanaCountSpinner = document.querySelector('[data-spinner-id="kana-quiz-count"]');
  const kanaTimeSpinner = document.querySelector('[data-spinner-id="kana-quiz-time"]');
  const kanaSetupStart = document.getElementById("kana-setup-start");
  const charactersTabButtons = document.querySelectorAll("[data-characters-tab]");
  const charactersLibraryTabButtons = document.querySelectorAll("[data-characters-library-tab]");
  const grammarTabButtons = document.querySelectorAll("[data-grammar-tab]");
  const writingSetupToggle = document.getElementById("writing-setup-toggle");
  const writingModeButtons = document.querySelectorAll("[data-writing-mode]");
  const writingOrderButtons = document.querySelectorAll("[data-writing-order]");
  const writingReplay = document.getElementById("writing-practice-replay");
  const writingGuideToggle = document.getElementById("writing-guide-toggle");
  const writingRevealToggle = document.getElementById("writing-practice-reveal");
  const writingPrev = document.getElementById("writing-practice-prev");
  const writingClear = document.getElementById("writing-practice-clear");
  const writingScore = document.getElementById("writing-practice-score-btn");
  const writingNext = document.getElementById("writing-practice-next");
  const writingCanvas = document.getElementById("writing-overlay-canvas");

  attachVocabStudyListeners({
    flashcardToggle,
    flashcardPrev,
    flashcardNext,
    flashcardAgain,
    flashcardMastered,
    vocabList,
    vocabTabButtons,
    vocabViewButtons,
    vocabLevelSelect,
    vocabFilterSelect,
    vocabPartSelect,
    vocabPagePrev,
    vocabPageNext
  });
  attachStateOptionsToggle(vocabQuizOptionsToggle, "vocabQuizOptionsOpen", renderVocabPage);
  attachLinkedFieldSelectors({
    questionSelect: vocabQuizQuestionField,
    optionSelect: vocabQuizOptionField,
    getQuestionField: getVocabQuizQuestionField,
    getOptionField: getVocabQuizOptionField,
    normalizeQuestionField: getVocabQuizQuestionField,
    normalizeOptionField: (value, previousOptionField) => getVocabQuizField(value, previousOptionField),
    normalizeStoredQuestionField: getVocabQuizQuestionField,
    normalizeStoredOptionField: getVocabQuizOptionField,
    getDefaultOptionField: getDefaultVocabQuizOptionField,
    getDefaultQuestionField: getDefaultVocabQuizQuestionField,
    questionStateKey: "vocabQuizQuestionField",
    optionStateKey: "vocabQuizOptionField",
    invalidate: invalidateVocabQuizSession,
    render: renderVocabPage
  });
  attachStateSpinner({
    spinner: vocabQuizCountSpinner,
    options: vocabQuizCountOptions,
    getCurrentValue: () => state.vocabQuizCount,
    setValue: (value) => {
      state.vocabQuizCount = value;
    },
    invalidate: invalidateVocabQuizSession,
    render: renderVocabPage
  });
  attachStateSpinner({
    spinner: vocabQuizTimeSpinner,
    options: quizDurationOptions,
    getCurrentValue: () => state.vocabQuizDuration,
    setValue: (value) => {
      state.vocabQuizDuration = value;
    },
    invalidate: invalidateVocabQuizSession,
    render: renderVocabPage
  });
  if (vocabQuizLevelSelect) {
    vocabQuizLevelSelect.addEventListener("change", () => {
      setVocabLevel(vocabQuizLevelSelect.value);
    });
  }
  if (vocabQuizFilterSelect) {
    vocabQuizFilterSelect.addEventListener("change", () => {
      setVocabFilter(vocabQuizFilterSelect.value);
    });
  }
  if (vocabQuizPartSelect) {
    vocabQuizPartSelect.addEventListener("change", () => {
      setVocabPartFilter(vocabQuizPartSelect.value);
    });
  }
  attachResultFilterSelectListener({
    select: vocabQuizResultFilter,
    getNextValue: getVocabQuizResultFilter,
    getCurrentValue: getVocabQuizResultFilter,
    setValue: (value) => {
      state.vocabQuizResultFilter = value;
    },
    shouldSaveState: true,
    render: renderVocabQuizResults
  });
  attachBulkResultActionListener({
    button: vocabQuizResultBulkAction,
    getResults: getFilteredVocabQuizResults,
    datasetKey: "vocabQuizBulkAction",
    removeItem: removeWordFromReviewList,
    saveItem: saveWordToReviewList,
    render: renderVocabPage
  });
  attachToggleResultActionListener({
    list: vocabQuizResultList,
    selector: "[data-vocab-quiz-save]",
    getId: (button) => button.dataset.vocabQuizSave,
    isSelected: isWordSavedToReviewList,
    selectItem: saveWordToReviewList,
    unselectItem: removeWordFromReviewList,
    render: renderVocabPage
  });
  if (vocabQuizNext) {
    vocabQuizNext.addEventListener("click", nextVocabQuizQuestion);
  }
  if (vocabQuizRestart) {
    vocabQuizRestart.addEventListener("click", restartVocabQuiz);
  }
  if (quizNext) {
    quizNext.addEventListener("click", nextQuiz);
  }
  if (quizRestart) {
    quizRestart.addEventListener("click", startNewQuizSession);
  }
  if (quizClearMistakes) {
    quizClearMistakes.addEventListener("click", clearQuizMistakes);
  }
  attachStateOptionsToggle(quizOptionsToggle, "quizOptionsOpen", renderQuizControls);
  attachValueButtonListeners(quizLevelButtons, (button) => button.dataset.quizLevel, setQuizLevel);
  attachValueButtonListeners(quizSizeButtons, (button) => getQuizSessionSize(button.dataset.quizSize), (nextSize) => {
    if (state.quizSessionSize === nextSize) {
      return;
    }

    state.quizSessionSize = nextSize;
    startNewQuizSession();
  });
  attachValueButtonListeners(quizModeButtons, (button) => getQuizMode(button.dataset.quizMode), (nextMode) => {
    if (state.quizMode === nextMode) {
      return;
    }

    state.quizMode = nextMode;
    startNewQuizSession();
  });
  attachValueButtonListeners(quizTimeButtons, (button) => button.dataset.quizTime, setQuizDuration);
  attachStateOptionsToggle(grammarPracticeOptionsToggle, "grammarPracticeOptionsOpen", renderGrammarPracticeControls);
  if (grammarPracticeLevelSelect) {
    grammarPracticeLevelSelect.addEventListener("change", () => {
      setGrammarPracticeLevel(grammarPracticeLevelSelect.value);
    });
  }
  attachStateSpinner({
    spinner: grammarPracticeCountSpinner,
    options: grammarPracticeCountOptions,
    getCurrentValue: () => state.grammarPracticeCount,
    setValue: (value) => {
      state.grammarPracticeCount = value;
    },
    invalidate: () => {
      invalidateGrammarPracticeSession();
    },
    render: renderGrammarPractice
  });
  attachStateSpinner({
    spinner: grammarPracticeTimeSpinner,
    options: grammarPracticeDurationOptions,
    getCurrentValue: () => state.grammarPracticeDuration,
    setValue: (value) => {
      state.grammarPracticeDuration = value;
    },
    invalidate: () => {
      setQuizSessionDuration("grammar", state.grammarPracticeDuration);
    },
    render: renderGrammarPractice
  });
  if (grammarPracticeStart) {
    grammarPracticeStart.addEventListener("click", restartGrammarPractice);
  }
  attachStateOptionsToggle(readingOptionsToggle, "readingOptionsOpen", renderReadingControls);
  if (readingLevelSelect) {
    readingLevelSelect.addEventListener("change", () => {
      setReadingLevel(readingLevelSelect.value);
    });
  }
  attachStateSpinner({
    spinner: readingCountSpinner,
    options: readingCountOptions,
    getCurrentValue: () => state.readingCount,
    setValue: (value) => {
      state.readingCount = value;
    },
    invalidate: () => {
      invalidateReadingPracticeSession();
    },
    render: renderReadingPractice
  });
  attachStateSpinner({
    spinner: readingTimeSpinner,
    options: readingDurationOptions,
    getCurrentValue: () => state.readingDuration,
    setValue: (value) => {
      state.readingDuration = value;
    },
    invalidate: () => {
      setQuizSessionDuration("reading", state.readingDuration);
    },
    render: renderReadingPractice
  });
  if (readingStart) {
    readingStart.addEventListener("click", restartReadingPractice);
  }
  if (readingNext) {
    readingNext.addEventListener("click", nextReadingSet);
  }
  if (basicPracticeNext) {
    basicPracticeNext.addEventListener("click", nextBasicPracticeSet);
  }
  attachKanjiStudyListeners({
    kanjiOptionsToggle,
    kanjiGradeButtons,
    kanjiViewButtons,
    kanjiCollectionSelect,
    kanjiGradeSelect,
    kanjiPagePrev,
    kanjiPageNext,
    kanjiFlashcardToggle,
    kanjiFlashcardPrev,
    kanjiFlashcardNext,
    kanjiFlashcardReview,
    kanjiFlashcardMastered,
    kanjiList
  });
  attachStateOptionsToggle(starterKanjiOptionsToggle, "starterKanjiQuizOptionsOpen", renderStarterKanjiControls);
  attachLinkedFieldSelectors({
    questionSelect: starterKanjiQuestionField,
    optionSelect: starterKanjiOptionField,
    getQuestionField: getStarterKanjiQuestionField,
    getOptionField: getStarterKanjiOptionField,
    normalizeQuestionField: getStarterKanjiQuestionField,
    normalizeOptionField: (value, previousOptionField) => getStarterKanjiQuizField(value, previousOptionField),
    normalizeStoredQuestionField: getStarterKanjiQuestionField,
    normalizeStoredOptionField: getStarterKanjiOptionField,
    getDefaultOptionField: getDefaultStarterKanjiOptionField,
    getDefaultQuestionField: getDefaultStarterKanjiQuestionField,
    questionStateKey: "starterKanjiQuestionField",
    optionStateKey: "starterKanjiOptionField",
    invalidate: invalidateStarterKanjiSession,
    render: renderKanjiPageLayout
  });
  if (starterKanjiCollectionSelect) {
    starterKanjiCollectionSelect.addEventListener("change", () => {
      setKanjiCollectionFilter(starterKanjiCollectionSelect.value);
    });
  }
  if (starterKanjiGradeSelect) {
    starterKanjiGradeSelect.addEventListener("change", () => {
      setKanjiGrade(starterKanjiGradeSelect.value);
    });
  }
  if (starterKanjiStart) {
    starterKanjiStart.addEventListener("click", () => {
      if (state.starterKanjiQuizStarted) {
        invalidateStarterKanjiSession();
        saveState();
        renderKanjiPageLayout();
        return;
      }

      if (!startNewStarterKanjiSession()) {
        renderKanjiPageLayout();
        return;
      }

      saveState();
      renderKanjiPageLayout();
      scrollToElementById("starter-kanji-card");
    });
  }
  attachStateSpinner({
    spinner: starterKanjiCountSpinner,
    options: starterKanjiQuizCountOptions,
    getCurrentValue: () => state.starterKanjiQuizCount,
    setValue: (value) => {
      state.starterKanjiQuizCount = value;
    },
    invalidate: invalidateStarterKanjiSession,
    render: renderKanjiPageLayout
  });
  attachStateSpinner({
    spinner: starterKanjiTimeSpinner,
    options: quizDurationOptions,
    getCurrentValue: () => state.starterKanjiQuizDuration,
    setValue: (value) => {
      state.starterKanjiQuizDuration = value;
    },
    invalidate: invalidateStarterKanjiSession,
    render: renderKanjiPageLayout
  });
  if (starterKanjiNext) {
    starterKanjiNext.addEventListener("click", nextStarterKanjiPracticeSet);
  }
  if (starterKanjiRestart) {
    starterKanjiRestart.addEventListener("click", restartStarterKanjiPractice);
  }
  attachBulkResultActionListener({
    button: starterKanjiResultBulkAction,
    getResults: getFilteredStarterKanjiResults,
    datasetKey: "starterKanjiBulkAction",
    removeActionValue: "remove-review",
    removeItem: removeKanjiFromReviewList,
    saveItem: saveKanjiToReviewList,
    render: renderKanjiPageLayout
  });
  attachResultFilterSelectListener({
    select: starterKanjiResultFilter,
    getNextValue: getStarterKanjiResultFilter,
    getCurrentValue: () => getStarterKanjiResultFilter(starterKanjiState.resultFilter),
    setValue: (value) => {
      starterKanjiState.resultFilter = value;
    },
    render: renderStarterKanjiResults
  });
  attachToggleResultActionListener({
    list: starterKanjiResultList,
    selector: "[data-kanji-result-save]",
    getId: (button) => button.dataset.kanjiResultSave,
    isSelected: isKanjiSavedToReviewList,
    selectItem: saveKanjiToReviewList,
    unselectItem: removeKanjiFromReviewList,
    render: renderKanjiPageLayout
  });
  kanjiTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setKanjiTab(button.dataset.kanjiTab);
    });
  });
  if (grammarPracticeNext) {
    grammarPracticeNext.addEventListener("click", nextGrammarPracticeSet);
  }
  if (kanaQuizNext) {
    kanaQuizNext.addEventListener("click", nextKanaQuizSheetQuestion);
  }
  attachStateOptionsToggle(kanaSetupToggle, "kanaSetupOpen", renderKanaQuizSetup);
  attachValueButtonListeners(kanaModeButtons, (button) => button.dataset.kanaMode || "hiragana", (nextMode) => {
    kanaQuizSettings.mode = nextMode;
    renderKanaQuizSetup();
  });
  attachStateSpinner({
    spinner: kanaCountSpinner,
    options: kanaQuizCountOptions,
    getCurrentValue: () => kanaQuizSettings.count,
    setValue: (nextValue) => {
      kanaQuizSettings.count = nextValue;
    },
    render: renderKanaQuizSetup
  });
  attachStateSpinner({
    spinner: kanaTimeSpinner,
    options: kanaQuizDurationOptions,
    getCurrentValue: () => kanaQuizSettings.duration,
    setValue: (nextValue) => {
      kanaQuizSettings.duration = nextValue;
    },
    render: renderKanaQuizSetup
  });
  if (kanaSetupStart) {
    kanaSetupStart.addEventListener("click", () => {
      startKanaQuizSession(kanaQuizSettings.mode);
    });
  }
  if (kanaQuizRestart) {
    kanaQuizRestart.addEventListener("click", () => {
      startKanaQuizSession(kanaQuizSettings.mode);
    });
  }
  if (kanaQuizResultFilter) {
    kanaQuizResultFilter.addEventListener("change", (event) => {
      kanaQuizSheetState.resultFilter = getKanaQuizResultFilter(event.target.value);
      renderKanaQuizResults();
    });
  }
  charactersTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = getCharactersTab(button.dataset.charactersTab);

      if (state.charactersTab === nextTab) {
        return;
      }

      state.charactersTab = nextTab;
      saveState();
      renderCharactersPageLayout();
    });
  });
  charactersLibraryTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = getCharactersLibraryTab(button.dataset.charactersLibraryTab);

      if (state.charactersLibraryTab === nextTab) {
        return;
      }

      state.charactersLibraryTab = nextTab;
      saveState();
      renderCharactersPageLayout();
    });
  });
  grammarTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = getGrammarTab(button.dataset.grammarTab);

      if (state.grammarTab === nextTab) {
        return;
      }

      state.grammarTab = nextTab;
      saveState();
      renderGrammarPageLayout();
    });
  });
  attachValueButtonListeners(writingModeButtons, (button) => button.dataset.writingMode || "hiragana", (nextMode) => {
    if (nextMode === writingPracticeSettings.mode) {
      return;
    }

    startWritingPracticeSession(nextMode);
  });
  attachStateOptionsToggle(writingSetupToggle, "writingSetupOpen", renderWritingPracticeSetup);
  attachValueButtonListeners(
    writingOrderButtons,
    (button) => getWritingPracticeOrder(button.dataset.writingOrder),
    (nextOrder) => {
      if (nextOrder === writingPracticeSettings.order) {
        return;
      }

      startWritingPracticeSession(writingPracticeSettings.mode, nextOrder);
    }
  );
  if (writingReplay) {
    writingReplay.addEventListener("click", replayWritingStrokeAnimation);
  }
  if (writingGuideToggle) {
    writingGuideToggle.addEventListener("click", toggleWritingGuide);
  }
  if (writingRevealToggle) {
    writingRevealToggle.addEventListener("click", toggleWritingAnswer);
  }
  if (writingPrev) {
    writingPrev.addEventListener("click", previousWritingPracticeItem);
  }
  if (writingClear) {
    writingClear.addEventListener("click", () => {
      clearWritingPracticeCanvas(true);
    });
  }
  if (writingScore) {
    writingScore.addEventListener("click", scoreWritingPractice);
  }
  if (writingNext) {
    writingNext.addEventListener("click", nextWritingPracticeItem);
  }
  if (writingCanvas) {
    writingCanvas.addEventListener("pointerdown", handleWritingPointerDown);
    writingCanvas.addEventListener("pointermove", handleWritingPointerMove);
    writingCanvas.addEventListener("pointerup", finishWritingPointer);
    writingCanvas.addEventListener("pointercancel", finishWritingPointer);
  }
  observeWritingPracticeLayout();
  window.addEventListener("resize", () => {
    if (!document.getElementById("writing-practice-shell") || getCharactersTab(state.charactersTab) !== "writing") {
      return;
    }

    scheduleWritingPracticeLayout(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && kanaQuizSheetState.open) {
      closeKanaQuizSheet();
    }
  });
}

function renderAll() {
  renderReadingPractice();
  renderStarterPath();
  renderKanjiPageLayout();
  renderKanaQuizSetup();
  renderKanaLibrary();
  renderWritingPractice();
  renderCharactersPageLayout();
  renderBasicPractice();
  renderKanaQuizSheet();
  renderQuizSessionHud("kana");
  renderVocabPage();
  renderGrammar();
  renderGrammarPageLayout();
  renderQuiz();
  renderStats();
}

refreshDynamicVocabContent("N5");
refreshQuizContent(state.quizLevel);
activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize, state.quizLevel);
attachEventListeners();
window.addEventListener("hashchange", () => {
  if (!isVocabPagePath()) {
    return;
  }

  const hashTab = window.location.hash.replace(/^#/, "").toLowerCase();
  setVocabTab(["quiz", "match"].includes(hashTab) ? hashTab : "study");
});
window.addEventListener("japanote:storage-updated", (event) => {
  if (event.detail?.key !== storageKey || event.detail?.source !== "remote") {
    return;
  }

  applyExternalStudyState(event.detail.value);
});
renderAll();
