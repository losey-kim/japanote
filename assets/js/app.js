const storageKey = "jlpt-compass-state";

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
    title: "N5 한자 시작",
    detail: "자주 쓰는 N5 한자를 읽기랑 뜻으로 익혀봐요.",
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
        explanation: "あ는 일본어의 기본 모음 a 소리입니다."
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
        explanation: "き는 ki 소리입니다. 聞く, 今日 같은 단어에서 자주 보입니다."
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
        explanation: "コ는 ko 소리입니다. コーヒー 같은 단어에서 바로 나옵니다."
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
        explanation: "ケ는 ke 소리입니다. ケーキ처럼 초급 외래어에서 자주 보입니다."
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
        explanation: "ぬ는 nu 소리입니다. 비슷한 글자와 섞이면 여기서 많이 틀립니다."
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
        explanation: "たべる는 食べる이고 뜻은 먹다입니다."
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
        explanation: "がっこう는 学校, 즉 학교입니다."
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
        explanation: "みず는 水이고 뜻은 물입니다."
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
        explanation: "あした는 明日, 즉 내일입니다."
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
        explanation: "ともだち는 友だち, 뜻은 친구입니다."
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
        displaySub: "나는 학생입니다.",
        options: ["は", "を", "で", "に"],
        answer: 0,
        explanation: "주제를 말할 때는 「は」를 씁니다. 「わたしは がくせいです。」가 됩니다."
      },
      {
        id: "bp-p2",
        source: "조사 2",
        title: "도착점",
        note: "어디에 가는지",
        prompt: "빈칸에 어울리는 조사를 골라봐요.",
        display: "がっこう（　）いきます。",
        displaySub: "학교에 갑니다.",
        options: ["を", "に", "が", "と"],
        answer: 1,
        explanation: "이동의 도착점은 「に」를 씁니다. 학교에 간다는 뜻입니다."
      },
      {
        id: "bp-p3",
        source: "조사 3",
        title: "행동 장소",
        note: "어디에서 하는지",
        prompt: "빈칸에 어울리는 조사를 골라봐요.",
        display: "スーパー（　）みずを かいます。",
        displaySub: "슈퍼에서 물을 삽니다.",
        options: ["で", "に", "を", "は"],
        answer: 0,
        explanation: "행동이 일어나는 장소는 「で」를 씁니다."
      },
      {
        id: "bp-p4",
        source: "조사 4",
        title: "목적어",
        note: "무엇을 하는지",
        prompt: "빈칸에 어울리는 조사를 골라봐요.",
        display: "ほん（　）よみます。",
        displaySub: "책을 읽습니다.",
        options: ["に", "を", "で", "が"],
        answer: 1,
        explanation: "목적어는 「を」를 씁니다. 책을 읽다이므로 「ほんを よみます。」입니다."
      },
      {
        id: "bp-p5",
        source: "조사 5",
        title: "함께 하는 대상",
        note: "누구와 같이",
        prompt: "빈칸에 어울리는 조사를 골라봐요.",
        display: "ともだち（　）べんきょう します。",
        displaySub: "친구와 공부합니다.",
        options: ["と", "を", "で", "へ"],
        answer: 0,
        explanation: "함께하는 대상은 「と」를 씁니다. 친구와 같이 공부한다는 뜻입니다."
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
        explanation: "日의 대표 읽기는 ひ입니다. 초급에서는 날짜와 요일에서도 자주 보입니다."
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
        explanation: "人은 ひと, 사람입니다."
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
        explanation: "月은 대표적으로 つき라고 읽습니다."
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
        explanation: "火는 ひ, 불입니다."
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
        explanation: "水는 みず, 물입니다. 단어 카드와 같이 보면 더 빨리 익힙니다."
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
        title: "입니다 문장",
        note: "아주 짧은 단정 표현",
        prompt: "문장 뜻에 맞는 답을 골라봐요.",
        display: "これは ほん です。",
        displaySub: "이것은 책입니다.",
        options: ["이것은 책입니다.", "이것은 물입니다.", "저것은 학교입니다.", "이것은 친구입니다."],
        answer: 0,
        explanation: "これは는 이것은, ほん은 책, です는 입니다입니다."
      },
      {
        id: "bp-s2",
        source: "문장 2",
        title: "이동 문장",
        note: "장소 + 이동",
        prompt: "문장 뜻에 맞는 답을 골라봐요.",
        display: "あした がっこうへ いきます。",
        displaySub: "시간 표현 + 장소 + 가다",
        options: ["내일 학교에 갑니다.", "오늘 학교에서 공부합니다.", "내일 집에 옵니다.", "어제 학교에 갔습니다."],
        answer: 0,
        explanation: "あした는 내일, がっこうへ는 학교에, いきます는 갑니다입니다."
      },
      {
        id: "bp-s3",
        source: "문장 3",
        title: "행동 문장",
        note: "목적어 + 동사",
        prompt: "문장 뜻에 맞는 답을 골라봐요.",
        display: "みずを のみます。",
        displaySub: "을/를 + 마십니다",
        options: ["물을 마십니다.", "물을 봅니다.", "책을 읽습니다.", "밥을 먹습니다."],
        answer: 0,
        explanation: "みず를 のみます이므로 물을 마십니다입니다."
      },
      {
        id: "bp-s4",
        source: "문장 4",
        title: "같이 하는 행동",
        note: "と 조사 익히기",
        prompt: "문장 뜻에 맞는 답을 골라봐요.",
        display: "ともだちと べんきょう します。",
        displaySub: "친구와 공부합니다.",
        options: ["친구와 공부합니다.", "친구를 만납니다.", "친구와 갑니다.", "친구가 공부합니다."],
        answer: 0,
        explanation: "ともだちと는 친구와, べんきょうします는 공부합니다입니다."
      },
      {
        id: "bp-s5",
        source: "문장 5",
        title: "소유 표현",
        note: "나의 + 명사",
        prompt: "문장 뜻에 맞는 답을 골라봐요.",
        display: "わたしの せんせい です。",
        displaySub: "소유 표현 확인",
        options: ["제 선생님입니다.", "저는 선생님입니다.", "제 친구입니다.", "학생입니다."],
        answer: 0,
        explanation: "わたしの는 저의, せんせい는 선생님입니다."
      }
    ]
  }
};

const grammarItems = [
  { id: "g1", level: "N5", pattern: "〜たい", description: "무엇을 하고 싶은지 말할 때 자주 써요." },
  { id: "g2", level: "N5", pattern: "〜てください", description: "부드럽게 부탁할 때 쓰기 좋아요." },
  { id: "g3", level: "N4", pattern: "〜ようになる", description: "상태가 바뀌거나 가능해진 일을 말할 때 써요." },
  { id: "g4", level: "N4", pattern: "〜ながら", description: "두 동작을 함께 할 때 써요." },
  { id: "g5", level: "N3", pattern: "〜わけではない", description: "완전히 그렇진 않다는 느낌을 줄 때 써요." },
  { id: "g6", level: "N3", pattern: "〜ことになる", description: "그렇게 정해지거나 되기로 한 일을 말할 때 써요." },
  { id: "g7", level: "N2", pattern: "〜に違いない", description: "강하게 추측하거나 확신할 때 써요." },
  { id: "g8", level: "N2", pattern: "〜ざるを得ない", description: "하지 않을 수 없다는 뜻으로 써요." },
  { id: "g9", level: "N1", pattern: "〜を皮切りに", description: "어떤 일을 시작점으로 잡을 때 써요." },
  { id: "g10", level: "N1", pattern: "〜ずくめ", description: "특정한 성질로 가득 찬 상태를 말할 때 써요." }
];

const grammarPracticeSets = {
  N5: [
    {
      id: "n5-g1",
      source: "N5G 問題1-1",
      title: "조사 선택",
      note: "이동 수단을 나타내는 조사",
      tone: "tone-gold",
      sentence: "私は あしたの ひこうき（　）国へ 帰ります。",
      options: ["に", "で", "が", "を"],
      answer: 1,
      explanation: "교통수단이나 방법을 나타낼 때는 「で」를 씁니다. 비행기를 타고 귀국한다는 뜻입니다."
    },
    {
      id: "n5-g2",
      source: "N5G 問題1-4",
      title: "会う와 조사",
      note: "사람을 만날 때는 「に会う」",
      tone: "tone-coral",
      sentence: "きのう スーパーで 田中さん（　）会いました。",
      options: ["を", "の", "で", "に"],
      answer: 3,
      explanation: "사람을 만나다는 일본어에서 「人に会う」 형태를 씁니다. 장소는 앞의 スーパーで가 이미 맡고 있습니다."
    },
    {
      id: "n5-g3",
      source: "N5G 問題1-8",
      title: "な형용사 연결",
      note: "きれいだ는 な형용사처럼 연결",
      tone: "tone-sky",
      sentence: "南町は、海が きれい（　）、静かです。",
      options: ["も", "や", "で", "と"],
      answer: 2,
      explanation: "「きれい」는 な형용사라서 문장을 이어 줄 때 「きれいで」가 됩니다. 뒤의 静かです와 자연스럽게 연결됩니다."
    },
    {
      id: "n5-g4",
      source: "N5G 問題1-13",
      title: "ながら",
      note: "동시에 하는 두 동작",
      tone: "tone-mint",
      sentence: "父は 毎朝 コーヒーを（　）ながら 新聞を 読みます。",
      options: ["飲む", "飲み", "飲んで", "飲んだ"],
      answer: 1,
      explanation: "「ながら」 앞에는 동사ます형 어간이 옵니다. 그래서 「飲みながら」가 맞습니다."
    }
  ],
  N4: [
    {
      id: "n4-g1",
      source: "N4G 問題1-1",
      title: "시간 표현",
      note: "얼마 만에 끝났는지 말하기",
      tone: "tone-gold",
      sentence: "きのうの しゅくだいは 少なかったので、（　）終わりました。",
      options: ["20分", "20分しか", "20分で", "20分を"],
      answer: 2,
      explanation: "걸린 시간을 말할 때는 「20分で終わりました」처럼 「で」를 씁니다."
    },
    {
      id: "n4-g2",
      source: "N4G 問題1-5",
      title: "수동문의 행위자",
      note: "누가 만들었는지 나타내기",
      tone: "tone-coral",
      sentence: "この 日本語の じしょは、150年前に 外国人（　）作られました。",
      options: ["から", "を", "について", "によって"],
      answer: 3,
      explanation: "수동문에서 행위자를 나타낼 때는 「〜によって」를 씁니다. 누가 사전을 만들었는지 설명하는 문장입니다."
    },
    {
      id: "n4-g3",
      source: "N4G 問題1-9",
      title: "부사 선택",
      note: "기다렸지만 쉽게 오지 않음",
      tone: "tone-sky",
      sentence: "今朝は 駅に 行く バスが（　）来なかったので、タクシーで 行きました。",
      options: ["やっと", "なかなか", "きっと", "いつか"],
      answer: 1,
      explanation: "「なかなか〜ない」는 기대한 일이 쉽게 일어나지 않는다는 뜻입니다. 버스가 좀처럼 오지 않았다는 문맥과 맞습니다."
    },
    {
      id: "n4-g4",
      source: "N4G 問題1-13",
      title: "가능성 표현",
      note: "조금 늦을 가능성을 말하기",
      tone: "tone-mint",
      sentence:
        "木村「山田さん、あしたの 午後、サッカーの 練習に 行きますか。」\n山田「ええ、行きます。でも、午前中に 用事が あるので、（　）。」",
      options: [
        "遅れないで ください",
        "遅れない ほうが いいです",
        "遅れる かもしれません",
        "遅れては いけません"
      ],
      answer: 2,
      explanation: "오전 일정 때문에 정확히 맞추기 어려울 수 있으므로 「遅れるかもしれません」이 자연스럽습니다."
    }
  ],
  N3: [
    {
      id: "n3-g1",
      source: "N3G 問題1-1",
      title: "として",
      note: "자격이나 역할을 나타내기",
      tone: "tone-gold",
      sentence: "彼は小説家（　）有名になったが、普段は小さな病院で働く医者だ。",
      options: ["について", "として", "にしたがって", "と比べて"],
      answer: 1,
      explanation: "「小説家として」는 소설가라는 자격, 입장으로 유명해졌다는 뜻입니다."
    },
    {
      id: "n3-g2",
      source: "N3G 問題1-3",
      title: "どうしても",
      note: "강한 의지나 욕구",
      tone: "tone-coral",
      sentence: "昨日の夜、寝る前に（　）ヨーグルトが食べたくなって、コンビニに買いに行った。",
      options: ["どうか", "せっかく", "どうしても", "きっと"],
      answer: 2,
      explanation: "꼭, 아무래도라는 강한 마음이 들어 결국 사러 갔다는 흐름이므로 「どうしても」가 맞습니다."
    },
    {
      id: "n3-g3",
      source: "N3G 問題1-8",
      title: "ことになっている",
      note: "학교 규칙이나 정해진 운영 방식",
      tone: "tone-sky",
      sentence: "息子が通う高校では、昼休みに売店へ買いに行けないため、全員がお弁当を（　）。",
      options: [
        "持っていったばかりだ",
        "持っていくことになっている",
        "持っていきたい",
        "持っていくつもりだ"
      ],
      answer: 1,
      explanation: "규칙이나 제도로 정해져 있을 때는 「ことになっている」를 씁니다. 학생 전원이 도시락을 가져오도록 정해져 있다는 뜻입니다."
    },
    {
      id: "n3-g4",
      source: "N3G 問題1-12",
      title: "〜てもよさそうだ",
      note: "상태를 보고 허용 가능성을 판단",
      tone: "tone-mint",
      sentence:
        "（畑で）\n子「ねえ、このトマト、もう食べられる？赤くなっているよ。」\n父「うん。そろそろ（　）ね。」",
      options: ["食べやすそうだ", "食べていそうだ", "食べたがるようだ", "食べてもよさそうだ"],
      answer: 3,
      explanation: "색이 충분히 익었으니 이제 먹어도 될 것 같다는 뜻입니다. 허용 판단이므로 「食べてもよさそうだ」가 맞습니다."
    }
  ]
};

const quizQuestions = [
  {
    id: "q1",
    level: "N5",
    question: "「毎日 日本語を 勉強します。」에서 「毎日」의 뜻은 무엇인가요?",
    options: ["매일", "지금", "어제", "조금"],
    answer: "매일"
  },
  {
    id: "q2",
    level: "N4",
    question: "「雨が降りそうです。」의 자연스러운 해석은 무엇인가요?",
    options: ["비를 좋아합니다", "비가 올 것 같습니다", "비가 그쳤습니다", "비를 피했습니다"],
    answer: "비가 올 것 같습니다"
  },
  {
    id: "q3",
    level: "N3",
    question: "「〜わけではない」는 어떤 뉘앙스에 가장 가깝나요?",
    options: ["강한 명령", "부분 부정", "과거 회상", "희망 표현"],
    answer: "부분 부정"
  },
  {
    id: "q4",
    level: "N2",
    question: "「急がざるを得ない」의 의미로 가장 맞는 것은 무엇인가요?",
    options: ["급할 필요가 없다", "서둘러야만 한다", "급하게 말하다", "급하게 먹는다"],
    answer: "서둘러야만 한다"
  },
  {
    id: "q5",
    level: "N1",
    question: "「新製品の発売を皮切りに」가 나타내는 의미는 무엇인가요?",
    options: ["판매를 멈추고", "출시를 시작점으로 하여", "가격을 낮추고", "리뷰를 마치고"],
    answer: "출시를 시작점으로 하여"
  }
];

const dynamicQuizSource = Array.isArray(globalThis.jlptN5Vocab) ? globalThis.jlptN5Vocab : [];
const quizModeLabels = {
  meaning: "뜻 맞히기",
  reading: "읽기 맞히기"
};
const quizSessionSizeOptions = [10, 20];

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

function formatQuizLineBreaks(value) {
  return normalizeQuizText(value).replace(/\s*;\s*/g, "\n");
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

function getQuizMode(value) {
  return value === "reading" ? "reading" : "meaning";
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

const dynamicQuizPool = buildDynamicQuizPool(dynamicQuizSource);

function buildDynamicFlashcardPool(items) {
  const cards = items
    .map((item) => ({
      id: item.id,
      level: "N5",
      word: item.word,
      reading: item.reading,
      meaning: item.meaning
    }))
    .filter((item) => item.id && item.word && item.reading && item.meaning);

  return cards.length ? shuffleQuizArray(cards) : [...fallbackFlashcards];
}

function buildDynamicVocabListPool(items) {
  const cards = items
    .map((item) => ({
      id: item.id,
      level: "N5",
      word: item.word,
      reading: item.reading,
      meaning: item.meaning
    }))
    .filter((item) => item.id && item.word && item.reading && item.meaning);

  return cards.length ? cards : [...fallbackFlashcards];
}

flashcards = buildDynamicFlashcardPool(dynamicQuizPool);
vocabListItems = buildDynamicVocabListPool(dynamicQuizPool);

function buildDynamicWordPracticeItems(items) {
  const tones = ["tone-coral", "tone-mint", "tone-gold", "tone-sky"];
  const picked = shuffleQuizArray(items).slice(0, 12);

  const questions = picked
    .map((item, index) => {
      const distractors = uniqueQuizValues(
        shuffleQuizArray(
          items
            .filter((candidate) => candidate.id !== item.id && candidate.meaning !== item.meaning)
            .map((candidate) => candidate.meaning)
        )
      ).slice(0, 3);

      if (distractors.length < 3) {
        return null;
      }

      const options = shuffleQuizArray([item.meaning, ...distractors]);
      const answer = options.indexOf(item.meaning);

      return {
        id: `bp-dw-${item.id}-${index}`,
        source: `N5 단어 ${index + 1}`,
        title: item.part ? `${item.part} 읽기` : "N5 단어 읽기",
        note: "N5 단어를 랜덤으로 만나봐요.",
        prompt: "이 단어 뜻, 어떤 걸까요?",
        display: item.reading,
        displaySub: item.word,
        options,
        answer,
        explanation: `${item.reading}는 ${item.word}, 뜻은 ${item.meaning}입니다.`,
        tone: tones[index % tones.length]
      };
    })
    .filter(Boolean);

  return questions.length ? questions : basicPracticeSets.words.items;
}

basicPracticeSets.words.items = buildDynamicWordPracticeItems(dynamicQuizPool);

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

const kanaQuizSheetState = {
  open: false,
  mode: "hiragana",
  sessionIndex: 0,
  sessionItems: [],
  answered: false
};

function getKanaQuizModeLabel(mode) {
  if (mode === "random") {
    return "랜덤";
  }

  return mode === "katakana" ? "카타카나" : "히라가나";
}

const vocabFilterLabels = {
  all: "전체",
  review: "다시 보기",
  mastered: "익힌 단어"
};

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

function renderKanaQuizSetup() {
  document.querySelectorAll("[data-kana-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.kanaMode === kanaQuizSettings.mode);
  });

  document.querySelectorAll("[data-kana-count]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.kanaCount === String(kanaQuizSettings.count));
  });

  document.querySelectorAll("[data-kana-time]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.kanaTime === String(kanaQuizSettings.duration));
  });
}

function startKanaQuizSession(mode = kanaQuizSettings.mode) {
  const nextMode = ["hiragana", "katakana", "random"].includes(mode) ? mode : "hiragana";
  kanaQuizSettings.mode = nextMode;
  kanaQuizSheetState.mode = nextMode;
  kanaQuizSheetState.sessionItems = buildKanaQuizSession(nextMode);
  kanaQuizSheetState.sessionIndex = 0;
  kanaQuizSheetState.answered = false;
  kanaQuizSheetState.open = true;

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
  startKanaQuizSession(mode);
}

function closeKanaQuizSheet() {
  kanaQuizSheetState.open = false;
  stopQuizSessionTimer("kana");
  renderKanaQuizSheet();
}

function renderKanaQuizSheet() {
  const sheet = document.getElementById("kana-quiz-sheet");
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

  if (!sheet || !label || !title || !desc || !source || !progress || !promptBox || !note || !prompt || !display || !displaySub || !options || !feedback || !explanation || !next) {
    return;
  }

  const current = getKanaQuizSheetCurrentItem();

  sheet.hidden = !kanaQuizSheetState.open;
  sheet.classList.toggle("is-open", kanaQuizSheetState.open);
  sheet.setAttribute("aria-hidden", String(!kanaQuizSheetState.open));
  document.body.classList.toggle("is-kana-quiz-sheet-open", kanaQuizSheetState.open);

  if (!kanaQuizSheetState.open) {
    return;
  }

  if (!current) {
    label.textContent = "KANA QUIZ";
    title.textContent = "문자 퀴즈 해볼까요?";
    desc.textContent = "퀴즈를 불러오지 못했어요.";
    source.textContent = "-";
    progress.textContent = "-";
    promptBox.hidden = true;
    note.hidden = true;
    note.textContent = "";
    prompt.textContent = "";
    display.textContent = "-";
    displaySub.textContent = "";
    options.innerHTML = "";
    feedback.textContent = "";
    explanation.textContent = "";
    next.disabled = true;
    return;
  }

  const modeLabel = getKanaQuizModeLabel(kanaQuizSheetState.mode);
  label.textContent = `${modeLabel.toUpperCase()} QUIZ`;
  title.textContent = `${modeLabel} 퀴즈 해볼까요?`;
  desc.textContent = "문자를 보고 읽기를 골라보세요.";
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
  next.disabled = true;
  next.textContent =
    current.index + 1 >= current.total ? "처음부터 다시 해볼까요?" : "다음으로 가볼까요?";

  options.innerHTML = "";
  current.item.options.forEach((option, optionIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kana-quiz-option";
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
    feedback.textContent = "시간이 끝났어요.";
  }
  if (explanation) {
    explanation.textContent = "";
    explanation.hidden = true;
  }

  finalizeKanaQuizAnswer(false);
}

function nextKanaQuizSheetQuestion() {
  const current = getKanaQuizSheetCurrentItem();
  if (!current) {
    startKanaQuizSession(kanaQuizSettings.mode);
    return;
  }

  if (!kanaQuizSheetState.answered) {
    const feedback = document.getElementById("kana-quiz-feedback");
    if (feedback) {
      feedback.textContent = "답을 고르면 다음으로 갈 수 있어요.";
    }
    return;
  }

  if (current.index + 1 >= current.total) {
    startKanaQuizSession(kanaQuizSettings.mode);
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
  heading: "히라가나 전부",
  items: buildKanaPracticeItems("hiragana")
};

basicPracticeSets.katakana = {
  label: "카타카나",
  heading: "카타카나 전부",
  items: buildKanaPracticeItems("katakana")
};

delete basicPracticeSets.kana;

basicPracticeSets.hiragana.label = "히라가나";
basicPracticeSets.hiragana.heading = "히라가나 전부";
basicPracticeSets.katakana.label = "카타카나";
basicPracticeSets.katakana.heading = "카타카나 전부";

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
      title: "히라가나 전부",
      description: "기본음부터 요음까지 한 번에 쭉 살펴봐요."
    },
    {
      targetId: "katakana-table",
      track: "katakana",
      title: "카타카나 전부",
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
                    <div class="kana-tile${item.quiz ? "" : " is-muted"}">
                      <strong>${item.char}</strong>
                      <span>${item.reading}</span>
                    </div>
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
}

function createQuizMeta(item, mode, promptKind) {
  return {
    mode,
    promptKind,
    sourceId: item.id,
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
    id: `n5-meaning-${item.id}-${index}`,
    level: "N5",
    question: `다음 히라가나의 뜻으로 맞는 것은 무엇인가요? ${item.reading}${label}`,
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
    id: `n5-word-${item.id}-${index}`,
    level: "N5",
    question: `다음 뜻에 맞는 일본어 단어는 무엇인가요? ${item.meaning}`,
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
    id: `n5-reading-${item.id}-${index}`,
    level: "N5",
    question: `다음 단어의 읽기로 맞는 것은 무엇인가요? ${item.word}${label}`,
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

function createFallbackQuizSession(count) {
  return shuffleQuizArray(quizQuestions)
    .slice(0, Math.min(count, quizQuestions.length))
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

function createQuizSession(mode, size) {
  const sessionMode = getQuizMode(mode);
  const questionCount = getQuizSessionSize(size);
  const dynamicQuestions =
    sessionMode === "reading"
      ? buildReadingQuizSession(dynamicQuizPool, questionCount)
      : buildMeaningQuizSession(dynamicQuizPool, questionCount);

  return dynamicQuestions.length ? dynamicQuestions : createFallbackQuizSession(questionCount);
}

let activeQuizQuestions = [];

const readingSets = {
  N5: [
    {
      id: "n5-r1",
      source: "N5R p1",
      title: "아침 식사",
      korean: "늦잠을 자서 아침을 못 먹고 학교에 간 상황입니다.",
      tone: "tone-coral",
      passageStyle: "plain",
      passage: [
        "わたしは 毎朝 ご飯となっとうか、パンとたまごを 食べて、学校へ 行きます。",
        "でも、けさは 何も 食べませんでした。バナナを 学校へ 持って 行きました。",
        "起きた 時間が おそかったからです。"
      ],
      question: "けさ「わたし」は 学校へ 行く 前に、何を 食べましたか。",
      options: [
        "ご飯となっとうを 食べました。",
        "パンとたまごを 食べました。",
        "何も 食べませんでした。",
        "バナナを 食べました。"
      ],
      answer: 2,
      explanation: "늦게 일어나서 학교 가기 전에 아무것도 먹지 못했고, 바나나는 학교에 가져갔습니다."
    },
    {
      id: "n5-r2",
      source: "N5R p2",
      title: "수업 공지",
      korean: "일본어 1반 학생에게 전달하는 공지문입니다.",
      tone: "tone-gold",
      passageStyle: "note",
      passage: [
        "「日本語１」と「日本語２」の クラスの みなさんへ",
        "今日 出川先生は お昼まで お休みです。午前の「日本語１」の クラスは ありません。",
        "午後の「日本語２」の クラスは あります。",
        "・「日本語１」の しゅくだいは 来週 出してください。"
      ],
      question: "大学は「日本語１」の クラスの 学生に 何を 言いたいですか。",
      options: [
        "今日 クラスは ありません。しゅくだいは 午後 出してください。",
        "今日 クラスは ありません。しゅくだいは 来週 出してください。",
        "今日 クラスが ありますが、しゅくだいは 来週 出してください。",
        "今日 クラスが ありますから、しゅくだいを 出してください。"
      ],
      answer: 1,
      explanation: "일본어 1반은 오전 수업이 없고, 숙제는 다음 주에 제출하라고 공지하고 있습니다."
    },
    {
      id: "n5-r3",
      source: "N5R p3",
      title: "메모 확인",
      korean: "우체국 사람이 오기 전에 무엇을 먼저 해야 하는지 묻는 메모 문제입니다.",
      tone: "tone-sky",
      passageStyle: "note",
      passage: [
        "ボゴさん",
        "10時ごろ ゆうびんきょくの 人が この にもつを とりに 来ますから、にもつと お金を わたして ください。",
        "お金は 中西さんが 持って います。ゆうびんきょくの 人が 来る 前に もらいに 行って ください。",
        "よろしく おねがいします。"
      ],
      question: "この メモを 読んで、ボゴさんは はじめに 何を しますか。",
      options: [
        "中西さんに お金を もらいます。",
        "中西さんに にもつと お金を わたします。",
        "ゆうびんきょくの 人に にもつを もらいます。",
        "ゆうびんきょくの 人に にもつと お金を わたします。"
      ],
      answer: 0,
      explanation: "우체국 사람이 오기 전에 먼저 중西さん에게서 돈을 받아 와야 합니다."
    }
  ],
  N4: [
    {
      id: "n4-r1",
      source: "N4R p1",
      title: "분실물 안내",
      korean: "시험 기간에 분실물을 찾으러 가는 방법을 묻는 공지입니다.",
      tone: "tone-coral",
      passageStyle: "note",
      passage: [
        "忘れ物がありました",
        "忘れた人は、先生たちの部屋へ 取りに 来てください。",
        "① 辞書（103教室にありました）",
        "② 帽子（食堂にありました）",
        "12月5日（月）から 7日（水）までは、試験中ですから、先生たちの部屋には 入れません。",
        "教室で クラスの 先生に 言ってください。"
      ],
      question: "試験中の３日間に 忘れ物を 取りに 行きたい 人は、どうしなければ なりませんか。",
      options: [
        "試験が 終わるまで 待ちます。",
        "先生たちの 部屋へ 取りに 行きます。",
        "忘れ物が あった 場所へ 取りに 行きます。",
        "教室で、自分の クラスの 先生に 話します。"
      ],
      answer: 3,
      explanation: "시험 기간에는 선생님 방에 들어갈 수 없으므로 교실에서 자기 반 선생님에게 말해야 합니다."
    },
    {
      id: "n4-r2",
      source: "N4R p2",
      title: "겨울 아이스크림",
      korean: "글쓴이가 무엇을 즐거움으로 느끼는지 파악하는 문제입니다.",
      tone: "tone-gold",
      passageStyle: "plain",
      passage: [
        "アイスクリームは、夏に 食べると とても おいしいですが、私は 寒い 冬でも 時々 食べます。",
        "夏は 毎日 食べるので 安い ものしか 買いませんが、冬は 高い ものを 買います。",
        "暖かい 部屋で いい アイスクリームを 食べるのが、私の 楽しみなのです。"
      ],
      question: "私の 楽しみは 何ですか。",
      options: [
        "冬に 暖かい 部屋で 毎日 アイスクリームを 食べること",
        "冬に 暖かい 部屋で 高い アイスクリームを 食べること",
        "夏に 毎日 アイスクリームを 食べること",
        "夏に 高い アイスクリームを 食べること"
      ],
      answer: 1,
      explanation: "글쓴이는 겨울에 따뜻한 방에서 좋은 아이스크림을 먹는 것을 즐거움이라고 말합니다."
    },
    {
      id: "n4-r3",
      source: "N4R p3",
      title: "공장 견학 메모",
      korean: "견학 날짜와 시간, 인원 수까지 함께 알려야 하는 메모입니다.",
      tone: "tone-sky",
      passageStyle: "note",
      passage: [
        "高田先生",
        "みそ工場の 林さんから 電話が ありました。",
        "1月に 工場見学が できるのは、19日（木）10時、11時と 26日（木）14時、15時だそうです。",
        "見学の 日と 時間が 決まったら、電話が ほしいと 言っていました。",
        "行く 人の 数も 教えて もらいたいそうです。"
      ],
      question: "この メモを 読んで、高田先生は 林さんに 何を 知らせなければ なりませんか。",
      options: [
        "工場見学に 行く 人の 数だけ",
        "工場見学に 行く 日と 時間だけ",
        "工場見学に 行く 日と 時間と、行く 人の 数",
        "工場見学に 行く 日と 時間が、いつごろ 決まるか"
      ],
      answer: 2,
      explanation: "메모에는 날짜와 시간뿐 아니라 가는 사람 수까지 알려 달라고 적혀 있습니다."
    },
    {
      id: "n4-r4",
      source: "N4R p4",
      title: "검은 지우개",
      korean: "글쓴이가 검은 지우개를 산 이유를 찾는 짧은 독해입니다.",
      tone: "tone-mint",
      passageStyle: "plain",
      passage: [
        "昨日 初めて 黒い 消しゴムを 買いました。",
        "レジの 人が「白いのは、使うと 消しゴムが 黒く 汚れて いやだと 言う 人が 多いから、黒いのを 作ったそうですよ。」と 教えてくれました。",
        "私は 色が かっこいいから 買ったので、理由を 聞いて おもしろいなと 思いました。"
      ],
      question: "「私」は どうして 黒い 消しゴムを 買いましたか。",
      options: [
        "黒い 消しゴムは、使った 後で 汚れないから",
        "黒い 消しゴムを 買う 人が 多いと 店の 人に 聞いたから",
        "黒い 消しゴムの ほうが 字を きれいに 消せるから",
        "黒い 消しゴムは、色が かっこいいと 思ったから"
      ],
      answer: 3,
      explanation: "글쓴이는 성능 때문이 아니라 색이 멋있다고 생각해서 샀다고 말합니다."
    }
  ],
  N3: [
    {
      id: "n3-r1",
      source: "N3R p1",
      title: "폭설 안내 메일",
      korean: "오전 수업 취소와 오후 수업 여부 공지를 어떻게 이해해야 하는지 묻습니다.",
      tone: "tone-coral",
      passageStyle: "note",
      passage: [
        "件名: 大雪による休講のお知らせ",
        "現在、大雪のため、多くの公共交通機関が止まっています。そのため、午前の授業は行われません。",
        "午後の授業は、10時までに公共交通機関が動き始めれば、いつもの通り行います。",
        "授業を行うかどうか10時にメールでお知らせしますので、必ず確認してください。"
      ],
      question: "このメールから わかることは 何ですか。",
      options: [
        "今日の 午前の 授業は、10時から 始まる。",
        "午前も 午後も、今日は クラブ活動を 中止しなければ ならない。",
        "今日の 午後の 授業が あるか どうか、10時に メールが 届く。",
        "10時に メールが 届いたら、今日の 午後の 授業は ある。"
      ],
      answer: 2,
      explanation: "오전 수업은 취소됐고, 오후 수업 여부는 10시에 오는 메일을 확인해야 합니다."
    },
    {
      id: "n3-r2",
      source: "N3R p2",
      title: "휴대전화에 대한 생각",
      korean: "편리하지만 항상 신경 써야 하는 생활이 싫어서 갖고 싶지 않다는 의견입니다.",
      tone: "tone-gold",
      passageStyle: "plain",
      passage: [
        "「携帯電話は 持っていないんです。」と 私が そう 言うと、たいていの 人は 驚く。",
        "それは 私も よく わかっている。実は、私も 以前、携帯電話を 持っていた。",
        "しかし、いつでも どこにいても 電話に 出なければ いけない 気がして、それが いやで 持つのを やめてしまったのだ。",
        "最近は 料金が 安い ものも あるし、携帯電話が ない 生活には 不便な ことも ある。それでも、私は 今のままで いいと 思っている。"
      ],
      question: "携帯電話について、「私」は どのように 考えて いますか。",
      options: [
        "便利だと 言う 人も いるが、自分は そう 思わないので、今は 持つ つもりは ない。",
        "便利だと 思うが、いつも 電話を 気にする 生活は いやなので、今は 持つ つもりは ない。",
        "持っていると 便利だし、最近は 料金が 安くなったので、もう 一度 持つ つもりだ。",
        "持ちたくは なかったが、ないと 不便なので、もう 一度 持つ つもりだ。"
      ],
      answer: 1,
      explanation: "편리함은 인정하지만 항상 전화를 의식하는 생활이 싫어서 지금은 다시 가질 생각이 없습니다."
    },
    {
      id: "n3-r3",
      source: "N3R p3",
      title: "따뜻한 음료 자판기",
      korean: "겨울에도 따뜻한 음료를 살 수 있는 자판기가 생긴 이유를 묻는 문제입니다.",
      tone: "tone-sky",
      passageStyle: "plain",
      passage: [
        "日本には 飲み物の 自動販売機が たくさん ある。",
        "しかし、最初のころの 自動販売機は、冷たい 物しか 売ることが できなかった。",
        "ある 冬の日、高速道路の 駐車場で、トラックの 運転手たちが 自動販売機で 買った ジュースを 飲んでいた。",
        "みんな とても 寒そうだったので、それを 見た 飲料会社の 社長が、冬には 温かい 物を 飲んでほしいと 考えた。",
        "それから 10年近く かけて 作られたのが、今の 販売機なのだそうだ。"
      ],
      question: "今の 販売機が 作られることに なったのは、どうしてですか。",
      options: [
        "冬に 販売機で 冷たい 物を 買って 飲んだ 社長が、客が 気の毒だと 感じたから",
        "冷たい 物が 買える 販売機が あれば 便利だろうと、社長が 考えたから",
        "温かい 物が 買える 販売機が 欲しいと、運転手たちに 言われたから",
        "温かい 物も 買える 販売機が あれば 喜ばれるだろうと、社長が 考えたから"
      ],
      answer: 3,
      explanation: "추운 겨울에 따뜻한 음료도 살 수 있으면 좋겠다고 사장이 생각한 것이 계기였습니다."
    },
    {
      id: "n3-r4",
      source: "N3R p4",
      title: "설명회 보고 자료",
      korean: "보고 자료를 손보고 회의 전에 준비해야 하는 일을 묻는 메모입니다.",
      tone: "tone-mint",
      passageStyle: "note",
      passage: [
        "パクさん",
        "先週の 新しい 企業向け 説明会の 報告資料を 見ました。内容は わかりやすくて いいと 思います。",
        "明日の 午後、私が 会議に 出て、この 資料を 使って 報告することに なりました。",
        "参加企業の リストも 欲しいので、準備しておいて ください。",
        "明日は、モリムラ工業に 寄ってから 出勤するので、会社に 着くのは 11時ごろに なる 予定です。それまでに お願いします。"
      ],
      question: "この メモを 読んで、パクさんが しなければ ならないことは 何ですか。",
      options: [
        "11時ごろ までに、説明会に 参加した 企業の リストを 準備しておく。",
        "午後の 会議までに、説明会の 報告資料を わかりやすく 書き直す。",
        "午後の 会議までに 報告資料を 直し、会議で 説明会に ついて 報告する。",
        "黒田課長が モリムラ工業に 行く までに、説明会の 報告資料を 完成させる。"
      ],
      answer: 3,
      explanation: "보고 자료와 준비물이 오전 11시 전까지 필요하며, 회의에서 직접 보고하는 사람은 パクさん이 아니라 黒田課長입니다."
    }
  ]
};

const defaultState = {
  flashcardIndex: 0,
  flashcardRevealed: false,
  vocabView: "card",
  vocabFilter: "all",
  vocabPage: 1,
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
  grammarPracticeLevel: "N5",
  grammarPracticeIndexes: { N5: 0, N4: 0, N3: 0 },
  quizIndex: 0,
  quizMode: "meaning",
  quizSessionSize: 20,
  quizSessionFinished: false,
  quizMistakes: [],
  quizSessionMistakeIds: [],
  quizCorrectCount: 0,
  quizAnsweredCount: 0,
  readingLevel: "N5",
  readingIndexes: { N5: 0, N4: 0, N3: 0 },
  lastStudyDate: null,
  streak: 0
};

function loadState() {
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

let state = normalizeBasicPracticeState(loadState());
state.quizMode = getQuizMode(state.quizMode);
state.quizSessionSize = getQuizSessionSize(state.quizSessionSize);
state.quizSessionFinished = false;
state.quizIndex = 0;
state.quizMistakes = Array.isArray(state.quizMistakes) ? state.quizMistakes : [];
state.quizSessionMistakeIds = [];
state.masteredIds = Array.from(new Set(Array.isArray(state.masteredIds) ? state.masteredIds : []));
state.reviewIds = Array.from(
  new Set((Array.isArray(state.reviewIds) ? state.reviewIds : []).filter((id) => !state.masteredIds.includes(id)))
);
state.vocabView = state.vocabView === "list" ? "list" : "card";
state.vocabFilter = ["all", "review", "mastered"].includes(state.vocabFilter)
  ? state.vocabFilter
  : "all";
state.vocabPage = Number.isFinite(Number(state.vocabPage)) ? Math.max(1, Number(state.vocabPage)) : 1;
activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize);

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
  grammar: {
    duration: 25,
    timeLeft: 25,
    correct: 0,
    streak: 0,
    timerId: null,
    timerElement: "grammar-timer",
    correctElement: "grammar-correct",
    streakElement: "grammar-streak"
  },
  reading: {
    duration: 45,
    timeLeft: 45,
    correct: 0,
    streak: 0,
    timerId: null,
    timerElement: "reading-timer",
    correctElement: "reading-correct",
    streakElement: "reading-streak"
  },
  quiz: {
    duration: 15,
    timeLeft: 15,
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

function renderQuizSessionHud(key) {
  const session = quizSessions[key];

  if (!session) {
    return;
  }

  const timer = document.getElementById(session.timerElement);
  const correct = document.getElementById(session.correctElement);
  const streak = document.getElementById(session.streakElement);

  if (!timer || !correct || !streak) {
    return;
  }

  timer.textContent = session.duration <= 0 ? "천천히" : `${session.timeLeft}초`;
  timer.classList.toggle(
    "is-warning",
    session.duration > 0 && session.timeLeft <= Math.max(5, Math.floor(session.duration / 3))
  );
  correct.textContent = String(session.correct);
  streak.textContent = String(session.streak);
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
  localStorage.setItem(storageKey, JSON.stringify(state));
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
          ${done ? "다시 해볼래요" : "해봤어요"}
        </button>
      </div>
    `;

    article.querySelector(".starter-learn").addEventListener("click", () => {
      state.basicPracticeTrack = item.module;
      saveState();

      if (item.module === "hiragana" || item.module === "katakana") {
        window.location.href = "characters.html";
        return;
      }

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
  const card = document.querySelector(".basic-practice-card");
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
  title.textContent = formatQuizLineBreaks(current.title);
  note.textContent = formatQuizLineBreaks(current.note);
  prompt.textContent = formatQuizLineBreaks(current.prompt);
  display.textContent = formatQuizLineBreaks(current.display);
  displaySub.textContent = formatQuizLineBreaks(current.displaySub || "");
  feedback.textContent = "";
  explanation.textContent = formatQuizLineBreaks(current.explanation || "");

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
  const options = document.querySelectorAll(".basic-practice-option");
  const alreadyAnswered = Array.from(options).some((item) => item.disabled);

  if (alreadyAnswered) {
    return;
  }

  const correct = index === current.answer;
  finalizeQuizSession("basic", correct);

  options.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === current.answer) {
      item.classList.add("is-correct");
    }
    if (optionIndex === index && !correct) {
      item.classList.add("is-wrong");
    }
  });

  document.getElementById("basic-practice-feedback").textContent = correct
    ? "잘했어요!"
    : "아쉽지만 괜찮아요. 정답 같이 볼게요.";
  document.getElementById("basic-practice-explanation").textContent = current.explanation;

  updateStudyStreak();
  saveState();
  renderStats();
}

function handleBasicPracticeTimeout() {
  const current = getCurrentBasicPracticeSet();
  const options = document.querySelectorAll(".basic-practice-option");
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

  document.getElementById("basic-practice-feedback").textContent = "시간이 끝났어요.";
  document.getElementById("basic-practice-explanation").textContent = current.explanation;

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


function getVocabFilter(filter = state.vocabFilter) {
  return Object.prototype.hasOwnProperty.call(vocabFilterLabels, filter) ? filter : "all";
}

function filterVocabItems(items, filter = state.vocabFilter) {
  const activeFilter = getVocabFilter(filter);

  if (!Array.isArray(items)) {
    return [];
  }

  if (activeFilter === "review") {
    return items.filter((item) => state.reviewIds.includes(item.id));
  }

  if (activeFilter === "mastered") {
    return items.filter((item) => state.masteredIds.includes(item.id));
  }

  return items;
}

function getVocabFilterCounts() {
  return {
    all: vocabListItems.length,
    review: filterVocabItems(vocabListItems, "review").length,
    mastered: filterVocabItems(vocabListItems, "mastered").length
  };
}

function getVocabSummaryText(count) {
  const activeFilter = getVocabFilter();

  if (activeFilter === "review") {
    return `다시 볼 단어 ${count}개예요`;
  }

  if (activeFilter === "mastered") {
    return `익힌 단어 ${count}개 모였어요`;
  }

  return `전체 단어 ${count}개예요`;
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
  return filterVocabItems(flashcards);
}

function getVisibleVocabList() {
  return filterVocabItems(vocabListItems);
}

function getVocabPageCount(items) {
  return Math.max(1, Math.ceil(items.length / vocabPageSize));
}

function clampVocabPage(items) {
  state.vocabPage = Math.min(Math.max(state.vocabPage, 1), getVocabPageCount(items));
}

function renderFlashcard() {
  const activeFilter = getVocabFilter();
  const cards = getVisibleFlashcards();
  const emptyCardMap = {
    all: {
      level: "N5",
      word: "아직 단어가 없어요",
      reading: "단어가 들어오면 같이 볼게요.",
      meaning: "조금만 기다려주세요.",
      id: "empty-all"
    },
    review: {
      level: "REVIEW",
      word: "다시 볼 단어가 없어요",
      reading: "잘하고 있어요.",
      meaning: "헷갈린 단어가 생기면 여기 모아둘게요.",
      id: "empty-review"
    },
    mastered: {
      level: "MASTERED",
      word: "익힌 단어가 아직 없어요",
      reading: "하나씩 쌓아봐요.",
      meaning: "익혔어요!를 누른 단어가 여기 모여요.",
      id: "empty-mastered"
    }
  };
  const source = cards.length ? cards : [emptyCardMap[activeFilter]];
  const currentIndex = state.flashcardIndex % source.length;
  const card = source[currentIndex];
  const hasCards = cards.length > 0;
  const isRevealed = hasCards && state.flashcardRevealed;
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

  level.textContent = formatQuizLineBreaks(card.level);
  word.textContent = formatQuizLineBreaks(card.word);
  reading.textContent = formatQuizLineBreaks(card.reading);
  meaning.textContent = formatQuizLineBreaks(card.meaning);
  hint.textContent = hasCards
    ? isRevealed
      ? "뜻까지 확인했어요."
      : "눌러서 뜻을 확인해보세요."
    : activeFilter === "review"
      ? "헷갈린 단어가 생기면 여기서 다시 볼 수 있어요."
      : activeFilter === "mastered"
        ? "익힌 단어가 쌓이면 여기서 모아볼 수 있어요."
        : "단어가 준비되면 여기서 같이 익혀봐요.";
  flashcard.classList.toggle("is-revealed", isRevealed);
  flashcardToggle.disabled = !hasCards;
  flashcardToggle.setAttribute("aria-expanded", String(isRevealed));
  flashcardToggle.setAttribute(
    "aria-label",
    hasCards ? (isRevealed ? "뜻 다시 접어둘게요" : "뜻 확인해볼까요?") : "단어 준비 중이에요"
  );

  if (flashcardPrev) {
    flashcardPrev.disabled = cards.length <= 1;
  }
  if (flashcardNext) {
    flashcardNext.disabled = cards.length <= 1;
  }
  if (flashcardAgain) {
    flashcardAgain.disabled = !hasCards;
  }
  if (flashcardMastered) {
    flashcardMastered.disabled = !hasCards;
  }
}

function renderVocabList() {
  const list = document.getElementById("vocab-list");
  const pageInfo = document.getElementById("vocab-page-info");
  const prev = document.getElementById("vocab-page-prev");
  const next = document.getElementById("vocab-page-next");
  const summary = document.getElementById("vocab-summary");
  const activeFilter = getVocabFilter();
  const items = getVisibleVocabList();

  if (!list || !pageInfo || !prev || !next || !summary) {
    return;
  }

  const previousPage = state.vocabPage;
  clampVocabPage(items);
  if (state.vocabPage !== previousPage) {
    saveState();
  }

  const pageCount = getVocabPageCount(items);
  const startIndex = (state.vocabPage - 1) * vocabPageSize;
  const pageItems = items.slice(startIndex, startIndex + vocabPageSize);

  summary.textContent = getVocabSummaryText(items.length);
  pageInfo.textContent = `${state.vocabPage} / ${pageCount}`;
  prev.disabled = state.vocabPage <= 1;
  next.disabled = state.vocabPage >= pageCount;

  if (!pageItems.length) {
    list.innerHTML = `<p class="vocab-list-empty">${
      activeFilter === "review"
        ? "다시 볼 단어가 아직 없어요."
        : activeFilter === "mastered"
          ? "익힌 단어가 아직 없어요."
          : "아직 보여줄 단어가 없어요."
    }</p>`;
    return;
  }

  list.innerHTML = pageItems
    .map((item, index) => {
      const review = state.reviewIds.includes(item.id);
      const mastered = state.masteredIds.includes(item.id);
      const badges = [
        review ? '<span class="vocab-review-badge">다시 보기</span>' : "",
        mastered ? '<span class="vocab-mastered-badge">익혔어요!</span>' : ""
      ]
        .filter(Boolean)
        .join("");

      return `
        <article class="vocab-list-card">
          <div class="vocab-list-card-head">
            <span class="vocab-list-index">${startIndex + index + 1}</span>
            <div class="vocab-status-badges">${badges}</div>
          </div>
          <div class="vocab-list-main">
            <strong class="vocab-list-word">${formatQuizLineBreaks(item.word)}</strong>
            <p class="vocab-list-reading">${formatQuizLineBreaks(item.reading)}</p>
          </div>
          <p class="vocab-list-meaning">${formatQuizLineBreaks(item.meaning)}</p>
        </article>
      `;
    })
    .join("");
}

function renderVocabPage() {
  const cardView = document.getElementById("vocab-card-view");
  const listView = document.getElementById("vocab-list-view");
  const summary = document.getElementById("vocab-summary");
  const items = getVisibleVocabList();
  const counts = getVocabFilterCounts();

  if (summary) {
    summary.textContent = getVocabSummaryText(items.length);
  }

  document.querySelectorAll("[data-vocab-view]").forEach((button) => {
    const active = button.dataset.vocabView === state.vocabView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  document.querySelectorAll("[data-vocab-filter]").forEach((button) => {
    const filter = getVocabFilter(button.dataset.vocabFilter);
    const active = filter === getVocabFilter();
    const count = button.querySelector("[data-vocab-filter-count]");

    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");

    if (count) {
      count.textContent = String(counts[filter]);
    }
  });

  if (cardView) {
    cardView.hidden = state.vocabView !== "card";
  }

  if (listView) {
    listView.hidden = state.vocabView !== "list";
  }

  renderFlashcard();
  renderVocabList();
}

function toggleFlashcardReveal() {
  state.flashcardRevealed = !state.flashcardRevealed;
  updateStudyStreak();
  saveState();
  renderVocabPage();
  renderStats();
}

function moveFlashcard(step) {
  const cards = getVisibleFlashcards();
  if (!cards.length) {
    return;
  }

  state.flashcardIndex = (state.flashcardIndex + step + cards.length) % cards.length;
  state.flashcardRevealed = false;
  saveState();
  renderVocabPage();
}

function markFlashcardForReview() {
  const cards = getVisibleFlashcards();
  if (!cards.length) {
    return;
  }

  const currentIndex = state.flashcardIndex % cards.length;
  const currentCard = cards[currentIndex];

  if (!state.reviewIds.includes(currentCard.id)) {
    state.reviewIds.push(currentCard.id);
  }

  state.masteredIds = state.masteredIds.filter((id) => id !== currentCard.id);
  updateStudyStreak();
  state.flashcardRevealed = false;
  syncFlashcardIndexAfterVocabUpdate(currentCard.id, currentIndex);
  saveState();
  renderAll();
}

function markFlashcardMastered() {
  const cards = getVisibleFlashcards();
  if (!cards.length) {
    return;
  }

  const currentIndex = state.flashcardIndex % cards.length;
  const currentCard = cards[currentIndex];

  if (!state.masteredIds.includes(currentCard.id)) {
    state.masteredIds.push(currentCard.id);
  }

  state.reviewIds = state.reviewIds.filter((id) => id !== currentCard.id);
  updateStudyStreak();
  state.flashcardRevealed = false;
  syncFlashcardIndexAfterVocabUpdate(currentCard.id, currentIndex);
  saveState();
  renderAll();
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
        ${checked ? "다시 해볼래요" : "해봤어요"}
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

function getCurrentGrammarPracticeSet() {
  const sets = grammarPracticeSets[state.grammarPracticeLevel];
  const currentIndex = state.grammarPracticeIndexes[state.grammarPracticeLevel] % sets.length;
  return sets[currentIndex];
}

function renderGrammarPractice() {
  const switcher = document.getElementById("grammar-practice-level-switcher");
  const grammarCard = document.querySelector(".grammar-practice-card");
  const optionsContainer = document.getElementById("grammar-practice-options");
  const level = document.getElementById("grammar-practice-level");
  const source = document.getElementById("grammar-practice-source");
  const progress = document.getElementById("grammar-practice-progress");
  const title = document.getElementById("grammar-practice-title");
  const note = document.getElementById("grammar-practice-note");
  const sentence = document.getElementById("grammar-practice-sentence");
  const feedback = document.getElementById("grammar-practice-feedback");
  const explanation = document.getElementById("grammar-practice-explanation");
  const current = getCurrentGrammarPracticeSet();
  const sets = grammarPracticeSets[state.grammarPracticeLevel];

  if (
    !switcher ||
    !grammarCard ||
    !optionsContainer ||
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

  switcher.innerHTML = "";

  Object.keys(grammarPracticeSets).forEach((level) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `level-button${state.grammarPracticeLevel === level ? " is-active" : ""}`;
    button.textContent = level;
    button.addEventListener("click", () => {
      state.grammarPracticeLevel = level;
      saveState();
      renderGrammarPractice();
    });
    switcher.appendChild(button);
  });

  level.textContent = state.grammarPracticeLevel;
  source.textContent = current.source;
  progress.textContent =
    `${(state.grammarPracticeIndexes[state.grammarPracticeLevel] % sets.length) + 1} / ${sets.length}`;
  title.textContent = current.title;
  note.textContent = current.note;
  sentence.textContent = current.sentence;
  feedback.textContent = "";
  explanation.textContent = "";

  grammarCard.className = `grammar-practice-card ${current.tone}`;

  optionsContainer.innerHTML = "";
  current.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "grammar-practice-option";
    button.textContent = option;
    button.addEventListener("click", () => handleGrammarPracticeAnswer(index));
    optionsContainer.appendChild(button);
  });

  resetQuizSessionTimer("grammar", handleGrammarPracticeTimeout);
}

function handleGrammarPracticeAnswer(index) {
  const current = getCurrentGrammarPracticeSet();
  const options = document.querySelectorAll(".grammar-practice-option");
  const alreadyAnswered = Array.from(options).some((item) => item.disabled);

  if (alreadyAnswered) {
    return;
  }

  const correct = index === current.answer;
  finalizeQuizSession("grammar", correct);

  options.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === current.answer) {
      item.classList.add("is-correct");
    }
    if (optionIndex === index && !correct) {
      item.classList.add("is-wrong");
    }
  });

  document.getElementById("grammar-practice-feedback").textContent = correct
    ? "잘했어요!"
    : "아쉽지만 괜찮아요. 정답 같이 볼게요.";
  document.getElementById("grammar-practice-explanation").textContent = current.explanation;

  updateStudyStreak();
  saveState();
  renderStats();
}

function handleGrammarPracticeTimeout() {
  const current = getCurrentGrammarPracticeSet();
  const options = document.querySelectorAll(".grammar-practice-option");
  const alreadyAnswered = Array.from(options).some((item) => item.disabled);

  if (alreadyAnswered) {
    return;
  }

  finalizeQuizSession("grammar", false);

  options.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === current.answer) {
      item.classList.add("is-correct");
    }
  });

  document.getElementById("grammar-practice-feedback").textContent = "시간이 끝났어요.";
  document.getElementById("grammar-practice-explanation").textContent = current.explanation;

  updateStudyStreak();
  saveState();
  renderStats();
}

function nextGrammarPracticeSet() {
  const sets = grammarPracticeSets[state.grammarPracticeLevel];
  state.grammarPracticeIndexes[state.grammarPracticeLevel] =
    (state.grammarPracticeIndexes[state.grammarPracticeLevel] + 1) % sets.length;
  saveState();
  renderGrammarPractice();
}

function getQuizQuestion() {
  if (!activeQuizQuestions.length) {
    activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize);
  }

  return activeQuizQuestions[state.quizIndex] || activeQuizQuestions[0];
}

function getQuizAccuracyValue(correct = quizSessions.quiz.correct, total = activeQuizQuestions.length) {
  return total ? Math.round((correct / total) * 100) : 0;
}

function getQuizModeLabel(mode = state.quizMode) {
  return quizModeLabels[getQuizMode(mode)];
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
  const sizeButtons = document.querySelectorAll("[data-quiz-size]");
  const modeButtons = document.querySelectorAll("[data-quiz-mode]");

  sizeButtons.forEach((button) => {
    const active = Number(button.dataset.quizSize) === state.quizSessionSize;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  modeButtons.forEach((button) => {
    const active = button.dataset.quizMode === state.quizMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
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
  quizSessions.quiz.timeLeft = quizSessions.quiz.duration;
  renderQuizSessionHud("quiz");
}

function startNewQuizSession() {
  state.quizMode = getQuizMode(state.quizMode);
  state.quizSessionSize = getQuizSessionSize(state.quizSessionSize);
  state.quizIndex = 0;
  state.quizSessionFinished = false;
  state.quizSessionMistakeIds = [];
  activeQuizQuestions = createQuizSession(state.quizMode, state.quizSessionSize);
  resetQuizSessionStats();
  saveState();
  renderQuiz();
}

function getQuizFeedbackText(question, correct, userAnswer) {
  const readingText = question.meta?.reading ? ` 읽기 · ${question.meta.reading}` : "";
  const meaningText = question.meta?.meaning ? ` 뜻 · ${question.meta.meaning}` : "";

  if (correct) {
    return question.meta?.mode === "reading"
      ? `잘했어요!${meaningText}`
      : `잘했어요!${readingText}`;
  }

  return `아쉽지만 괜찮아요. 정답은 "${question.answer}"예요.${question.meta?.mode === "reading" ? meaningText : readingText} ${
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

function revealQuizAnswer(question, selectedOption, correct) {
  const options = document.querySelectorAll(".quiz-option");

  options.forEach((item) => {
    item.disabled = true;

    if (item.textContent === question.answer) {
      item.classList.add("is-correct");
    }

    if (!correct && selectedOption && item.textContent === selectedOption) {
      item.classList.add("is-wrong");
    }
  });
}

function finalizeQuizQuestion(question, selectedOption, correct) {
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

  revealQuizAnswer(question, selectedOption, correct);
  setQuizActionState({
    nextLabel: lastQuestion ? "결과 보러 갈까요?" : "다음으로 가볼까요?",
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
    level.textContent = `N5 · ${getQuizModeLabel()}`;
    progress.textContent = `${activeQuizQuestions.length} / ${activeQuizQuestions.length}`;
    questionText.textContent = "이번 퀴즈 끝!";
    feedback.textContent = `${activeQuizQuestions.length}문제까지 잘 풀었어요.`;
    optionsContainer.innerHTML = "";
    optionsContainer.hidden = true;
    setQuizActionState({
      nextLabel: "다음으로 가볼까요?",
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

  level.textContent = `N5 · ${getQuizModeLabel()}`;
  progress.textContent = `${state.quizIndex + 1} / ${activeQuizQuestions.length}`;
  questionText.textContent = question.question;
  feedback.textContent = "";
  optionsContainer.hidden = false;
  optionsContainer.innerHTML = "";

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-option";
    button.textContent = option;
    button.addEventListener("click", () => handleQuizAnswer(question, option));
    optionsContainer.appendChild(button);
  });

  setQuizActionState({
    nextLabel:
      state.quizIndex >= activeQuizQuestions.length - 1
        ? "결과 보러 갈까요?"
        : "다음으로 가볼까요?",
    nextDisabled: true,
    nextHidden: false,
    restartHidden: false
  });
  resetQuizSessionTimer("quiz", handleQuizTimeout);
}

function handleQuizAnswer(question, option) {
  const options = document.querySelectorAll(".quiz-option");
  const alreadyAnswered = Array.from(options).some((item) => item.disabled);

  if (alreadyAnswered) {
    return;
  }

  finalizeQuizQuestion(question, option, option === question.answer);
}

function handleQuizTimeout() {
  const question = getQuizQuestion();
  const options = document.querySelectorAll(".quiz-option");
  const alreadyAnswered = Array.from(options).some((item) => item.disabled);

  if (alreadyAnswered || !question) {
    return;
  }

  finalizeQuizQuestion(question, "", false);
}

function nextQuiz() {
  const options = document.querySelectorAll(".quiz-option");
  const answered = Array.from(options).length > 0 && Array.from(options).every((item) => item.disabled);
  const feedback = document.getElementById("quiz-feedback");

  if (state.quizSessionFinished) {
    startNewQuizSession();
    return;
  }

  if (!answered) {
    if (feedback) {
      feedback.textContent = "답을 고르면 다음으로 갈 수 있어요.";
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

function getCurrentReadingSet() {
  const sets = readingSets[state.readingLevel];
  const currentIndex = state.readingIndexes[state.readingLevel] % sets.length;
  return sets[currentIndex];
}

function renderReadingPractice() {
  const switcher = document.getElementById("reading-level-switcher");
  const readingCard = document.querySelector(".reading-card");
  const passage = document.getElementById("reading-passage");
  const optionsContainer = document.getElementById("reading-options");
  const level = document.getElementById("reading-level");
  const source = document.getElementById("reading-source");
  const progress = document.getElementById("reading-progress");
  const title = document.getElementById("reading-title");
  const korean = document.getElementById("reading-korean");
  const question = document.getElementById("reading-question");
  const feedback = document.getElementById("reading-feedback");
  const explanation = document.getElementById("reading-explanation");
  const current = getCurrentReadingSet();
  const sets = readingSets[state.readingLevel];

  if (
    !switcher ||
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

  switcher.innerHTML = "";

  Object.keys(readingSets).forEach((level) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `level-button${state.readingLevel === level ? " is-active" : ""}`;
    button.textContent = level;
    button.addEventListener("click", () => {
      state.readingLevel = level;
      saveState();
      renderReadingPractice();
    });
    switcher.appendChild(button);
  });

  level.textContent = state.readingLevel;
  source.textContent = current.source;
  progress.textContent = `${(state.readingIndexes[state.readingLevel] % sets.length) + 1} / ${sets.length}`;
  title.textContent = current.title;
  korean.textContent = current.korean;
  question.textContent = current.question;
  feedback.textContent = "";
  explanation.textContent = "";

  readingCard.className = `reading-card ${current.tone}`;

  passage.className = `reading-passage${current.passageStyle === "note" ? " is-note" : ""}`;
  passage.innerHTML = current.passage.map((line) => `<p>${line}</p>`).join("");

  optionsContainer.innerHTML = "";
  current.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reading-option";
    button.textContent = option;
    button.addEventListener("click", () => handleReadingAnswer(index));
    optionsContainer.appendChild(button);
  });

  resetQuizSessionTimer("reading", handleReadingTimeout);
}

function handleReadingAnswer(index) {
  const current = getCurrentReadingSet();
  const options = document.querySelectorAll(".reading-option");
  const alreadyAnswered = Array.from(options).some((item) => item.disabled);

  if (alreadyAnswered) {
    return;
  }

  const correct = index === current.answer;
  finalizeQuizSession("reading", correct);

  options.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === current.answer) {
      item.classList.add("is-correct");
    }
    if (optionIndex === index && !correct) {
      item.classList.add("is-wrong");
    }
  });

  document.getElementById("reading-feedback").textContent = correct
    ? "잘했어요!"
    : "아쉽지만 괜찮아요. 정답 같이 볼게요.";
  document.getElementById("reading-explanation").textContent = current.explanation;

  updateStudyStreak();
  saveState();
  renderStats();
}

function handleReadingTimeout() {
  const current = getCurrentReadingSet();
  const options = document.querySelectorAll(".reading-option");
  const alreadyAnswered = Array.from(options).some((item) => item.disabled);

  if (alreadyAnswered) {
    return;
  }

  finalizeQuizSession("reading", false);

  options.forEach((item, optionIndex) => {
    item.disabled = true;
    if (optionIndex === current.answer) {
      item.classList.add("is-correct");
    }
  });

  document.getElementById("reading-feedback").textContent = "시간이 끝났어요.";
  document.getElementById("reading-explanation").textContent = current.explanation;

  updateStudyStreak();
  saveState();
  renderStats();
}

function nextReadingSet() {
  const sets = readingSets[state.readingLevel];
  state.readingIndexes[state.readingLevel] = (state.readingIndexes[state.readingLevel] + 1) % sets.length;
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

function attachEventListeners() {
  const flashcardToggle = document.getElementById("flashcard-toggle");
  const flashcardPrev = document.getElementById("flashcard-prev");
  const flashcardNext = document.getElementById("flashcard-next");
  const flashcardAgain = document.getElementById("flashcard-again");
  const flashcardMastered = document.getElementById("flashcard-mastered");
  const vocabViewButtons = document.querySelectorAll("[data-vocab-view]");
  const vocabFilterButtons = document.querySelectorAll("[data-vocab-filter]");
  const vocabPagePrev = document.getElementById("vocab-page-prev");
  const vocabPageNext = document.getElementById("vocab-page-next");
  const quizNext = document.getElementById("quiz-next");
  const quizRestart = document.getElementById("quiz-restart");
  const quizClearMistakes = document.getElementById("quiz-clear-mistakes");
  const quizSizeButtons = document.querySelectorAll("[data-quiz-size]");
  const quizModeButtons = document.querySelectorAll("[data-quiz-mode]");
  const readingNext = document.getElementById("reading-next");
  const basicPracticeNext = document.getElementById("basic-practice-next");
  const grammarPracticeNext = document.getElementById("grammar-practice-next");
  const kanaQuizNext = document.getElementById("kana-quiz-next");
  const kanaQuizCloseButtons = document.querySelectorAll("[data-kana-sheet-close]");
  const kanaModeButtons = document.querySelectorAll("[data-kana-mode]");
  const kanaCountButtons = document.querySelectorAll("[data-kana-count]");
  const kanaTimeButtons = document.querySelectorAll("[data-kana-time]");
  const kanaSetupStart = document.getElementById("kana-setup-start");

  if (flashcardToggle) {
    flashcardToggle.addEventListener("click", toggleFlashcardReveal);
  }
  if (flashcardPrev) {
    flashcardPrev.addEventListener("click", () => moveFlashcard(-1));
  }
  if (flashcardNext) {
    flashcardNext.addEventListener("click", () => moveFlashcard(1));
  }
  if (flashcardAgain) {
    flashcardAgain.addEventListener("click", markFlashcardForReview);
  }
  if (flashcardMastered) {
    flashcardMastered.addEventListener("click", markFlashcardMastered);
  }
  vocabViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.vocabView === "list" ? "list" : "card";

      if (state.vocabView === nextView) {
        return;
      }

      state.vocabView = nextView;
      saveState();
      renderVocabPage();
    });
  });
  vocabFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setVocabFilter(button.dataset.vocabFilter);
    });
  });
  if (vocabPagePrev) {
    vocabPagePrev.addEventListener("click", () => {
      state.vocabPage = Math.max(1, state.vocabPage - 1);
      saveState();
      renderVocabPage();
    });
  }
  if (vocabPageNext) {
    vocabPageNext.addEventListener("click", () => {
      state.vocabPage += 1;
      saveState();
      renderVocabPage();
    });
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
  quizSizeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextSize = getQuizSessionSize(button.dataset.quizSize);

      if (state.quizSessionSize === nextSize) {
        return;
      }

      state.quizSessionSize = nextSize;
      startNewQuizSession();
    });
  });
  quizModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = getQuizMode(button.dataset.quizMode);

      if (state.quizMode === nextMode) {
        return;
      }

      state.quizMode = nextMode;
      startNewQuizSession();
    });
  });
  if (readingNext) {
    readingNext.addEventListener("click", nextReadingSet);
  }
  if (basicPracticeNext) {
    basicPracticeNext.addEventListener("click", nextBasicPracticeSet);
  }
  if (grammarPracticeNext) {
    grammarPracticeNext.addEventListener("click", nextGrammarPracticeSet);
  }
  if (kanaQuizNext) {
    kanaQuizNext.addEventListener("click", nextKanaQuizSheetQuestion);
  }
  kanaModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      kanaQuizSettings.mode = button.dataset.kanaMode || "hiragana";
      renderKanaQuizSetup();
    });
  });
  kanaCountButtons.forEach((button) => {
    button.addEventListener("click", () => {
      kanaQuizSettings.count = button.dataset.kanaCount || "10";
      renderKanaQuizSetup();
    });
  });
  kanaTimeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      kanaQuizSettings.duration = Number(button.dataset.kanaTime || 5);
      renderKanaQuizSetup();
    });
  });
  if (kanaSetupStart) {
    kanaSetupStart.addEventListener("click", () => {
      startKanaQuizSession(kanaQuizSettings.mode);
    });
  }
  kanaQuizCloseButtons.forEach((button) => {
    button.addEventListener("click", closeKanaQuizSheet);
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
  renderKanaQuizSetup();
  renderKanaLibrary();
  renderBasicPractice();
  renderKanaQuizSheet();
  renderQuizSessionHud("kana");
  renderVocabPage();
  renderGrammar();
  renderGrammarPractice();
  renderQuiz();
  renderStats();
}

attachEventListeners();
renderAll();

