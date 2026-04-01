globalThis.japanoteContent = globalThis.japanoteContent || {};

globalThis.japanoteContent.grammar = {
  items: [
    { id: "g1", level: "N5", pattern: "〜たい", description: "무엇을 하고 싶은지 말할 때 자주 써요." },
    { id: "g2", level: "N5", pattern: "〜てください", description: "부드럽게 부탁할 때 쓰기 좋아요." },
    { id: "g3", level: "N4", pattern: "〜ようになる", description: "상태가 바뀌거나 가능해진 일을 말할 때 써요." },
    { id: "g4", level: "N4", pattern: "〜ながら", description: "두 동작을 함께 할 때 써요." },
    { id: "g5", level: "N3", pattern: "〜わけではない", description: "완전히 그렇진 않다는 느낌을 줄 때 써요." },
    { id: "g6", level: "N3", pattern: "〜ことになる", description: "그렇게 정해지거나 되기로 한 일을 말할 때 써요." },
  ],
  practiceSets: {
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
        explanation: "교통수단이나 방법을 말할 때는 「で」를 써요. 비행기를 타고 귀국한다는 뜻이에요."
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
        explanation: "사람을 만날 때는 일본어에서 「人に会う」 형태를 써요. 장소는 앞의 スーパーで가 이미 맡고 있어요."
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
        explanation: "「ながら」 앞에는 동사ます형 어간이 와요. 그래서 「飲みながら」가 맞아요."
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
        explanation: "수동문에서 행위자를 가리킬 때는 「〜によって」를 써요. 누가 사전을 만들었는지 설명하는 문장이에요."
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
        explanation: "「なかなか〜ない」는 기대한 일이 쉽게 일어나지 않는다는 뜻이에요. 버스가 좀처럼 오지 않았다는 흐름에 잘 맞아요."
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
        explanation: "오전 일정 때문에 정확히 맞추기 어려울 수 있어서 「遅れるかもしれません」이 자연스러워요."
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
        explanation: "「小説家として」는 소설가라는 자격이나 입장으로 유명해졌다는 뜻이에요."
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
        explanation: "꼭 사야겠다는 마음이 이어지는 흐름이라 「どうしても」가 잘 맞아요."
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
        explanation: "규칙이나 제도로 정해져 있을 때는 「ことになっている」를 써요. 학생 전원이 도시락을 가져오기로 정해졌다는 뜻이에요."
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
        explanation: "색이 충분히 익어서 이제 먹어도 될 것 같다는 뜻이에요. 허용을 판단하는 말이라 「食べてもよさそうだ」가 맞아요."
      }
    ]
  }
};
