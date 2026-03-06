// [cl] 실제 카드 데이터 (AI 생성, Wikipedia 기반)
// generateCards.py로 생성된 데이터를 MockEvent 포맷으로 변환
// 2026-03-06 목업 → 실제 데이터 전환

export interface MockEvent {
  id: string;
  era_id: string;
  title: { ko: string; en: string };
  start_year: number;
  end_year: number | null;
  category: string;
  location_lat: number;
  location_lng: number;
  is_fog_region: boolean;
  historical_region: { ko: string; en: string };
  modern_country: { ko: string; en: string };
  image_url: string;
  summary: { ko: string; en: string };
  description: { ko: string; en: string };
  external_link: string;
}

// [cl] 실제 생성된 카드 데이터 (persons 샘플 10건)
export const MOCK_EVENTS: MockEvent[] = [
  {
    id: "Q7235",
    era_id: "era-ancient",
    title: { ko: "소포클레스", en: "Sophocles" },
    start_year: -497,
    end_year: -406,
    category: "인물/문화",
    location_lat: 37.9715,
    location_lng: 23.7257,
    is_fog_region: false,
    historical_region: { ko: "고대 아테네", en: "Ancient Athens" },
    modern_country: { ko: "그리스", en: "Greece" },
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Sophocles_pushkin.jpg/330px-Sophocles_pushkin.jpg",
    summary: {
      ko: "고대 그리스 3대 비극 시인. 오이디푸스 왕, 안티고네 등을 저술한 비극 예술의 완성자.",
      en: "One of the three great tragedians of ancient Athens, celebrated as the completer of tragic art.",
    },
    description: {
      ko: "고대 그리스 아테네의 3대 비극 시인 중 한 명인 소포클레스는 기원전 497년 부유한 가정에서 태어나 아테네의 황금기를 살았습니다. 그는 29세에 아이스킬로스를 꺾고 명성을 얻었으며, 비극 예술의 완성자로 불립니다. 소포클레스는 극에 세 번째 배우를 도입하고 합창 대원을 늘리는 등 연극 기법에 혁신을 가져왔습니다. 그의 작품은 인간의 운명과 성격의 깊이를 탐구하며, 치밀한 구성과 정교한 대화로 인물들의 내면을 묘사했습니다. 정치적으로도 활발하여 페리클레스의 지지자로서 해군 제독 등 요직을 역임하며 시민들의 큰 사랑을 받았습니다. 그의 대표작으로는 <오이디푸스 왕>, <안티고네> 등이 있으며, 사후에는 영웅 칭호를 받았습니다.",
      en: "Sophocles, one of the three great tragedians of ancient Athens, was born in 497 BCE into a wealthy family. He rose to fame at 29 by defeating Aeschylus in a drama competition and is celebrated as the \"completer of tragic art.\" Sophocles revolutionized theatre by introducing a third actor and increasing the chorus size, focusing on the profound depths of human destiny and character through intricate plots and refined dialogue. Politically active, he supported Pericles and served as a naval admiral, earning great admiration from Athenian citizens. His masterpieces include Oedipus Rex and Antigone.",
    },
    external_link: "https://ko.wikipedia.org/wiki/%EC%86%8C%ED%8F%AC%ED%81%B4%EB%A0%88%EC%8A%A4",
  },
  {
    id: "Q80398",
    era_id: "era-ancient",
    title: { ko: "페리클레스", en: "Pericles" },
    start_year: -495,
    end_year: -429,
    category: "정치/전쟁",
    location_lat: 37.9715,
    location_lng: 23.7257,
    is_fog_region: false,
    historical_region: { ko: "고대 아테네", en: "Ancient Athens" },
    modern_country: { ko: "그리스", en: "Greece" },
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Pericles_Pio-Clementino_Inv269_n2.jpg/330px-Pericles_Pio-Clementino_Inv269_n2.jpg",
    summary: {
      ko: "아테네 민주주의의 황금기를 이끈 정치가이자 장군. 파르테논 신전 건설을 주도.",
      en: "Prominent Athenian statesman who led Athens during its Golden Age and initiated the Parthenon construction.",
    },
    description: {
      ko: "페리클레스는 고대 아테네의 황금기를 이끈 정치가이자 장군으로, 기원전 457년부터 429년까지 '페리클레스 시대'를 열었습니다. 그는 델로스 동맹을 통해 아테네 제국을 건설하고, 민주주의를 절정으로 발전시켰습니다. 아레이오스 파고스의 권한을 축소하고 민회의 역할을 강화하며, 빈민을 위한 극장 무료 관람, 배심원 수당 지급 등 급진적인 민주 정책을 추진했습니다. 또한, 파르테논 신전을 비롯한 아크로폴리스 재건축 사업을 통해 아테네를 고대 그리스 세계의 문화와 교육의 중심지로 만들었습니다.",
      en: "Pericles was a prominent Athenian statesman, orator, and general who led Athens during its Golden Age, often called the \"Age of Pericles\" (c. 457-429 BCE). He transformed the Delian League into an Athenian empire and championed radical democracy, expanding political participation for all citizens. Pericles initiated an ambitious building program, including the Parthenon, making Athens a cultural and educational hub of the ancient Greek world.",
    },
    external_link: "https://ko.wikipedia.org/wiki/%ED%8E%98%EB%A6%AC%ED%81%B4%EB%A0%88%EC%8A%A4",
  },
  {
    id: "Q913",
    era_id: "era-ancient",
    title: { ko: "소크라테스", en: "Socrates" },
    start_year: -470,
    end_year: -399,
    category: "인물/문화",
    location_lat: 37.9715,
    location_lng: 23.7257,
    is_fog_region: false,
    historical_region: { ko: "고대 아테네", en: "Ancient Athens" },
    modern_country: { ko: "그리스", en: "Greece" },
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Socrates_Louvre.jpg/330px-Socrates_Louvre.jpg",
    summary: {
      ko: "서양 철학의 아버지. 산파술을 통해 보편적 진리를 탐구하다 독배를 마시고 사형.",
      en: "Father of Western philosophy. Sought universal truths through the Socratic method, sentenced to death by hemlock.",
    },
    description: {
      ko: "소크라테스(기원전 470년경~399년)는 고대 그리스 아테네의 철학자로, 서양 철학의 첫 번째 인물로 평가됩니다. 그는 석공의 아들로 태어나 중장보병으로 전쟁에 참여한 후, 40세부터 청년들을 가르치는 교육자로 활동했습니다. 당시 소피스트들의 상대주의에 맞서 보편타당한 진리를 탐구했으며, '너 자신을 알라'는 정신 아래 질문과 대화를 통해 상대방의 무지를 깨닫게 하고 진리에 이르게 하는 '산파술'을 개발했습니다. 그는 청년들을 타락시키고 신을 믿지 않는다는 죄명으로 기소되어 사형을 선고받았고, 독배를 마시며 죽음을 맞이했습니다.",
      en: "Socrates (c. 470-399 BCE) was an ancient Greek philosopher from Athens, considered the first figure in Western philosophy. He challenged Sophist relativism, seeking universal truths through his \"Socratic method\" (maieutics), which used questioning to expose ignorance and guide towards knowledge. Accused of impiety and corrupting the youth, he was sentenced to death by hemlock.",
    },
    external_link: "https://ko.wikipedia.org/wiki/%EC%86%8C%ED%81%AC%EB%9D%BC%ED%85%8C%EC%8A%A4",
  },
  {
    id: "Q272411",
    era_id: "era-ancient",
    title: { ko: "묵자", en: "Mozi" },
    start_year: -470,
    end_year: -391,
    category: "인물/문화",
    location_lat: 34.8,
    location_lng: 115.0,
    is_fog_region: false,
    historical_region: { ko: "춘추전국시대 송나라", en: "Song, Warring States" },
    modern_country: { ko: "중국", en: "China" },
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/%D0%A4%D0%B8%D0%BB%D0%BE%D1%81%D0%BE%D1%84_%D0%9C%D0%BE-%D0%A6%D0%B7%D1%8B.jpg/330px-%D0%A4%D0%B8%D0%BB%D0%BE%D1%81%D0%BE%D1%84_%D0%9C%D0%BE-%D0%A6%D0%B7%D1%8B.jpg",
    summary: {
      ko: "묵가의 창시자. 겸애(보편적 사랑)와 비전(반전)을 주창한 춘추전국시대 사상가.",
      en: "Founder of Mohism. Advocated universal love (Jian'ai) and anti-war philosophy during the Warring States period.",
    },
    description: {
      ko: "묵자(기원전 470~391)는 춘추전국시대 송나라 출신의 사상가이자 묵가의 창시자이다. 그는 세상의 혼란이 참사랑의 부재에서 비롯된다고 보고, 신분과 차별 없는 보편적인 사랑인 '겸애'를 주창했다. 이는 유가의 '존비친소'에 기반한 사랑을 비판하며, 모든 사람이 평등하게 서로를 이롭게 해야 한다는 사상으로 발전했다. 묵자는 또한 전쟁을 불의로 규정하는 '비전론'을 내세웠고, 뛰어난 공학 기술자로 성곽 방어에 능하여 초나라의 송나라 공격을 막아내기도 했다.",
      en: "Mozi (c. 470-391 BCE) was a philosopher and founder of Mohism during China's Warring States period. He advocated universal love (Jian'ai), condemned warfare (Feigong), and emphasized frugality and meritocracy. A skilled engineer, he famously defended the state of Song against Chu's invasion.",
    },
    external_link: "https://ko.wikipedia.org/wiki/%EB%AC%B5%EC%9E%90",
  },
  {
    id: "Q5264",
    era_id: "era-ancient",
    title: { ko: "히포크라테스", en: "Hippocrates" },
    start_year: -460,
    end_year: -370,
    category: "과학/발명",
    location_lat: 36.8,
    location_lng: 27.1,
    is_fog_region: false,
    historical_region: { ko: "고대 그리스 코스섬", en: "Cos, Ancient Greece" },
    modern_country: { ko: "그리스", en: "Greece" },
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Hippocrates_rubens.jpg/330px-Hippocrates_rubens.jpg",
    summary: {
      ko: "의학의 아버지. 질병의 자연적 원인을 규명하고 히포크라테스 선서를 확립.",
      en: "Father of Medicine. Established medicine as a distinct profession and developed the Hippocratic Oath.",
    },
    description: {
      ko: "고대 그리스 페리클레스 시대의 위대한 의사이자 '의학의 아버지'로 불리는 히포크라테스(기원전 460년경~기원전 370년경)는 의학사에 지대한 영향을 미쳤습니다. 그는 코스섬에서 태어나 과학적 의학의 토대를 마련하며, 질병의 원인을 초자연적인 현상이 아닌 자연적 원인에서 찾았습니다. 히포크라테스 학파를 통해 의학을 마술과 철학에서 분리하여 독립적인 직업으로서의 의사를 정립했으며, '히포크라테스 선서'를 통해 의사의 윤리적 책무를 확립했습니다.",
      en: "Hippocrates of Cos (c. 460-370 BCE), the 'Father of Medicine,' revolutionized medicine by separating it from magic and philosophy. He emphasized natural causes for diseases and established the Hippocratic Oath for physician ethics.",
    },
    external_link: "https://ko.wikipedia.org/wiki/%ED%9E%88%ED%8F%AC%ED%81%AC%EB%9D%BC%ED%85%8C%EC%8A%A4",
  },
  {
    id: "Q41980",
    era_id: "era-ancient",
    title: { ko: "데모크리토스", en: "Democritus" },
    start_year: -460,
    end_year: -370,
    category: "과학/발명",
    location_lat: 40.95,
    location_lng: 24.98,
    is_fog_region: false,
    historical_region: { ko: "트라키아 압데라", en: "Abdera, Thrace" },
    modern_country: { ko: "그리스", en: "Greece" },
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Democritus2.jpg/330px-Democritus2.jpg",
    summary: {
      ko: "고대 원자론의 완성자. 세계는 원자와 공간으로 이루어져 있다고 주장.",
      en: "Completed ancient atomism, proposing the universe consists of indivisible atoms and void.",
    },
    description: {
      ko: "고대 그리스의 철학자 데모크리토스는 기원전 460년경 트라키아 압데라에서 태어나 레우키포스에게 배우며 평생을 연구에 바쳤습니다. 그는 세계가 더 이상 쪼갤 수 없는 '원자'와 텅 빈 '공간'으로 이루어져 있으며, 모든 변화는 원자들의 결합과 분리로 일어난다는 '고대 원자론'을 완성했습니다. 이는 초기 유물론의 정점이었으며, 후대 에피쿠로스 철학과 근세 물리학 발전에 결정적인 영향을 미쳤습니다.",
      en: "Democritus, born around 460 BCE in Abdera, completed 'ancient atomism' — proposing the universe consists of indivisible atoms and void. This materialistic philosophy profoundly influenced Epicureanism and modern physics.",
    },
    external_link: "https://ko.wikipedia.org/wiki/%EB%8D%B0%EB%AA%A8%ED%81%AC%EB%A6%AC%ED%86%A0%EC%8A%A4",
  },
  {
    id: "Q26825",
    era_id: "era-ancient",
    title: { ko: "헤로도토스", en: "Herodotus" },
    start_year: -484,
    end_year: -425,
    category: "인물/문화",
    location_lat: 37.04,
    location_lng: 27.42,
    is_fog_region: false,
    historical_region: { ko: "할리카르나소스", en: "Halicarnassus" },
    modern_country: { ko: "튀르키예", en: "T\u00fcrkiye" },
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/AGMA_H%C3%A9rodote.jpg/330px-AGMA_H%C3%A9rodote.jpg",
    summary: {
      ko: "역사학의 아버지. 그리스-페르시아 전쟁을 기록한 서양 최초의 역사서 저술.",
      en: "Father of History. Wrote the first Western historical work chronicling the Greco-Persian Wars.",
    },
    description: {
      ko: "헤로도토스는 고대 그리스의 역사가로, 서양 문화에서 \"역사학의 아버지\"로 불립니다. 그는 체계적으로 사료를 수집하고 검증하여 생생한 줄거리에 따라 배치한 최초의 인물로 평가받습니다. 그의 대표작 《역사》는 기원전 490년부터 479년까지 이어진 그리스-페르시아 전쟁의 기원을 탐구한 기록으로, 당시 다른 문헌이 거의 없는 이 시기의 귀중한 자료를 제공합니다. 또한 지중해와 흑해 주변을 널리 여행하며 접한 다양한 장소와 사람들의 문화, 풍습, 역사에 대한 풍부한 여담을 담고 있습니다.",
      en: "Herodotus, the 'Father of History,' pioneered systematic historical research for his seminal work 'The Histories,' chronicling the Greco-Persian Wars (490-479 BCE) with rich ethnographic details from extensive travels.",
    },
    external_link: "https://ko.wikipedia.org/wiki/%ED%97%A4%EB%A1%9C%EB%8F%84%ED%86%A0%EC%8A%A4",
  },
  {
    id: "Q177302",
    era_id: "era-ancient",
    title: { ko: "페이디아스", en: "Phidias" },
    start_year: -480,
    end_year: -430,
    category: "건축/유물",
    location_lat: 37.9715,
    location_lng: 23.7257,
    is_fog_region: false,
    historical_region: { ko: "고대 아테네", en: "Ancient Athens" },
    modern_country: { ko: "그리스", en: "Greece" },
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/The_Sculptor_Phidias-Ny_Carlsberg_Glyptotek.jpg/330px-The_Sculptor_Phidias-Ny_Carlsberg_Glyptotek.jpg",
    summary: {
      ko: "파르테논 신전 재건 총감독. 아테나 파르테노스 본존상을 제작한 고전기 최고의 조각가.",
      en: "Directed the Parthenon reconstruction and crafted the Athena Parthenos statue, pinnacle of Classical sculpture.",
    },
    description: {
      ko: "페이디아스는 기원전 5세기 고대 아테네의 황금기를 이끈 서양 고대 최고의 조각가이자 건축가이다. 페리클레스의 친구로서 아테네의 모든 예술 활동을 총괄 지휘했으며, 그의 전성기 15년간 아크로폴리스 언덕 위에 파르테논 신전을 재건한 것이 최대 업적이다. 그는 높이 12m에 달하는 거대한 '아테나 파르테노스' 본존상을 직접 제작했다. 또한 신전의 동서 박공, 메토프, 프리즈 등 모든 장식 조각의 제작을 지도하며 고전기 그리스 조각 양식의 정수를 확립했다.",
      en: "Phidias was the preeminent ancient Greek sculptor and architect of the 5th century BCE. As a close friend of Pericles, he directed the Parthenon reconstruction, crafting the colossal 12-meter Athena Parthenos and supervising all sculptural decorations.",
    },
    external_link: "https://ko.wikipedia.org/wiki/%ED%8E%98%EC%9D%B4%EB%94%94%EC%95%84%EC%8A%A4",
  },
  {
    id: "Q132157",
    era_id: "era-ancient",
    title: { ko: "엘레아의 제논", en: "Zeno of Elea" },
    start_year: -490,
    end_year: -430,
    category: "인물/문화",
    location_lat: 40.16,
    location_lng: 15.55,
    is_fog_region: false,
    historical_region: { ko: "마그나 그라이키아 엘레아", en: "Elea, Magna Graecia" },
    modern_country: { ko: "이탈리아", en: "Italy" },
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Diogenis_Laertii_De_Vitis_%281627%29_-_Zenon_of_Elea_or_Zenon_of_Citium.jpg/330px-Diogenis_Laertii_De_Vitis_%281627%29_-_Zenon_of_Elea_or_Zenon_of_Citium.jpg",
    summary: {
      ko: "제논의 역설로 유명한 엘레아 학파 철학자. 변증법의 발견자로 칭송.",
      en: "Eleatic philosopher known for Zeno's paradoxes. Praised by Aristotle as the inventor of dialectic.",
    },
    description: {
      ko: "엘레아의 제논은 기원전 5세기경 활동한 소크라테스 이전 시대의 철학자로, 파르메니데스의 엘레아 학파를 계승했다. 그는 스승의 '일자(一者)' 사상을 옹호하며, 다원성과 운동을 인정할 때 발생하는 논리적 모순을 증명하는 데 주력했다. 특히 '제논의 역설'로 알려진 일련의 논증들을 통해 운동의 불가능성을 주장하며, 당대 피타고라스 학파 등 다원론자들의 주장을 반박했다. 아리스토텔레스는 그를 변증법의 발견자로 칭송했다.",
      en: "Zeno of Elea (c. 490-430 BC) was a pre-Socratic philosopher who defended Parmenides' monism through his famous paradoxes, demonstrating logical contradictions in concepts of multiplicity and motion. Aristotle praised him as the inventor of dialectic.",
    },
    external_link: "https://ko.wikipedia.org/wiki/%EC%97%98%EB%A0%88%EC%95%84%EC%9D%98_%EC%A0%9C%EB%85%BC",
  },
  {
    id: "Q2908",
    era_id: "era-20c",
    title: { ko: "앙투안 드 생텍쥐페리", en: "Antoine de Saint-Exup\u00e9ry" },
    start_year: 1900,
    end_year: 1944,
    category: "인물/문화",
    location_lat: 45.764,
    location_lng: 4.8357,
    is_fog_region: false,
    historical_region: { ko: "프랑스", en: "France" },
    modern_country: { ko: "프랑스", en: "France" },
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/11exupery-inline1-500.jpg/330px-11exupery-inline1-500.jpg",
    summary: {
      ko: "어린 왕자의 저자. 비행사이자 작가로 인간 존재의 의미를 탐구.",
      en: "Author of The Little Prince. Aviator and writer who explored the meaning of human existence.",
    },
    description: {
      ko: "앙투안 드 생텍쥐페리는 프랑스의 귀족 가문에서 태어나 작가이자 비행사로서 독특한 삶을 살았습니다. 1920년대 초 상업 조종사로 훈련받아 유럽, 아프리카, 남아메리카를 오가는 항공우편 노선을 개척하며 비행의 선구자가 되었습니다. 그의 문학 작품들은 이러한 비행 경험을 바탕으로 인간의 고독, 우정, 삶의 의미를 깊이 탐구했으며, 특히 『어린 왕자』는 전 세계적인 사랑을 받는 걸작으로 남아있습니다. 제2차 세계 대전 중 프랑스 공군에 복무하며 정찰 임무를 수행했고, 1944년 정찰 비행 중 실종되었습니다.",
      en: "Antoine de Saint-Exup\u00e9ry (1900-1944) was a French writer and aviator who pioneered airmail routes and wrote the globally beloved 'The Little Prince.' He disappeared during a WWII reconnaissance mission in 1944.",
    },
    external_link: "https://ko.wikipedia.org/wiki/%EC%95%99%ED%88%AC%EC%95%88_%EB%93%9C_%EC%83%9D%ED%85%8D%EC%A5%90%ED%8E%98%EB%A6%AC",
  },
];
