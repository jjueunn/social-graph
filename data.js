/* =========================================================
   SOCIAL GRAPH - data.js
   그래프별 초기값, 예시, 자료 출처 정보를 모아 둔 파일입니다.
   - 숫자만 바꾸면 초기 화면과 예시가 바뀝니다.
   - 모든 값은 '학습용 가상 데이터'입니다.
   ========================================================= */
window.SG = window.SG || {};

/* 자료 출처 표시 형식
   가상 자료: { type: "virtual" }
   실제 자료: { type: "real", name: "자료명", year: "조사 연도", org: "출처 기관",
               url: "https://...", unit: "단위" }
   실제 자료로 된 예시를 고른 뒤 수치를 바꾸면, 화면에 '원본을 바꾼 가상 실험 결과'로 표시됩니다. */
SG.VIRTUAL = { type: "virtual" };

SG.data = {
  /* ---------------- 6-1. 사회 계층 구조 ---------------- */
  strata: {
    source: SG.VIRTUAL,
    initial: { upper: 10, middle: 30, lower: 60 },
    presets: [
      { id: "pyramid", label: "피라미드형", state: { upper: 10, middle: 30, lower: 60 } },
      { id: "diamond", label: "다이아몬드형", state: { upper: 15, middle: 65, lower: 20 } },
      { id: "inverted", label: "역피라미드형", state: { upper: 55, middle: 30, lower: 15 } },
      { id: "hourglass", label: "모래시계형", state: { upper: 35, middle: 15, lower: 50 } }
    ]
  },

  /* ---------------- 6-2. 사회 계층 이동표 ----------------
     m[부모 계층][자녀 계층], 0 = 상층, 1 = 중층, 2 = 하층 (단위: 명) */
  mobility: {
    source: SG.VIRTUAL,
    initial: { m: [[50, 30, 20], [40, 140, 70], [10, 60, 80]] },
    presets: [
      { id: "up", label: "상승 이동이 많은 사회", state: { m: [[80, 15, 5], [90, 90, 20], [40, 120, 40]] } },
      { id: "down", label: "하강 이동이 많은 사회", state: { m: [[40, 70, 40], [10, 80, 110], [5, 15, 130]] } },
      { id: "stay", label: "계층 유지가 많은 사회", state: { m: [[90, 8, 2], [8, 180, 12], [2, 12, 186]] } },
      { id: "active", label: "계층 이동이 활발한 사회", state: { m: [[30, 40, 30], [50, 60, 60], [40, 80, 110]] } }
    ]
  },

  /* ---------------- 6-3. 수요와 공급 ----------------
     수요 수준 A, 공급 수준 B (기준값 100)
     수요: Qd = A - P,  공급: Qs = (B - 100) + P   (P: 가격 단위, Q: 수량 단위) */
  market: {
    source: SG.VIRTUAL,
    initial: { demand: 100, supply: 100 },
    priceUnit: 100,   // 그래프의 가격 1단위 = 100원
    presets: [
      { id: "dUp", label: "수요 증가", state: { demand: 120, supply: 100 }, baselineInitial: true },
      { id: "dDown", label: "수요 감소", state: { demand: 80, supply: 100 }, baselineInitial: true },
      { id: "sUp", label: "공급 증가", state: { demand: 100, supply: 120 }, baselineInitial: true },
      { id: "sDown", label: "공급 감소", state: { demand: 100, supply: 80 }, baselineInitial: true }
    ]
  },

  /* ---------------- 6-4. 인구 피라미드 ----------------
     내부 자료는 5세 단위 17개 구간(0~4세 ... 75~79세, 80세 이상), 단위: 천 명 */
  population: {
    source: SG.VIRTUAL,
    initial: null, // 아래 '피라미드형' 예시를 초기값으로 사용
    presets: [
      {
        id: "pyramid", label: "피라미드형",
        state: {
          male: [2400, 2150, 1950, 1750, 1550, 1380, 1220, 1080, 950, 830, 720, 610, 500, 390, 280, 180, 140],
          female: [2280, 2050, 1860, 1680, 1500, 1350, 1200, 1070, 950, 840, 740, 640, 540, 440, 330, 230, 220]
        }
      },
      {
        id: "bell", label: "종형",
        state: {
          male: [1300, 1320, 1330, 1340, 1330, 1320, 1300, 1280, 1250, 1210, 1150, 1060, 940, 780, 600, 410, 330],
          female: [1240, 1260, 1270, 1280, 1280, 1270, 1260, 1250, 1230, 1200, 1160, 1090, 990, 860, 700, 520, 560]
        }
      },
      {
        id: "pot", label: "항아리형",
        state: {
          male: [700, 780, 860, 950, 1050, 1150, 1250, 1350, 1450, 1500, 1520, 1480, 1380, 1220, 1000, 750, 700],
          female: [660, 740, 820, 910, 1010, 1110, 1220, 1330, 1440, 1500, 1530, 1510, 1440, 1310, 1120, 900, 1100]
        }
      }
    ]
  },

  /* ---------------- 6-5. 로렌츠 곡선과 지니계수 ----------------
     s: 소득 하위 20% → 상위 20% 순서의 소득 점유율(%) */
  lorenz: {
    source: SG.VIRTUAL,
    initial: { s: [7, 12, 17, 23, 41] },
    presets: [
      { id: "equal", label: "완전 평등", state: { s: [20, 20, 20, 20, 20] } },
      { id: "fair", label: "상대적으로 평등", state: { s: [10, 15, 19, 24, 32] } },
      { id: "unfair", label: "상대적으로 불평등", state: { s: [4, 9, 15, 23, 49] } },
      { id: "extreme", label: "완전 불평등에 가까움", state: { s: [0, 1, 2, 5, 92] } }
    ]
  },

  /* ---------------- 6-6. 기후 그래프 ----------------
     temp: 1~12월 월평균 기온(℃), prec: 1~12월 월 강수량(mm)
     예시는 각 기후의 일반적 특성을 반영한 가상 학습용 자료입니다. */
  climate: {
    source: SG.VIRTUAL,
    initial: null, // 지역 A = 온대 계절풍 기후, 지역 B = 지중해성 기후
    initialA: "monsoon",
    initialB: "mediterranean",
    presets: [
      { id: "rainforest", label: "열대 우림 기후",
        temp: [26.5, 26.8, 27.0, 27.2, 27.0, 26.6, 26.3, 26.4, 26.6, 26.8, 26.7, 26.5],
        prec: [250, 220, 260, 280, 240, 190, 170, 180, 200, 230, 260, 270] },
      { id: "savanna", label: "사바나 기후",
        temp: [25.0, 26.5, 28.5, 30.0, 29.0, 27.0, 26.0, 26.0, 26.5, 27.5, 26.5, 25.0],
        prec: [5, 10, 25, 60, 140, 200, 230, 250, 190, 90, 20, 5] },
      { id: "desert", label: "사막 기후",
        temp: [14, 16, 20, 25, 30, 33, 34, 33, 30, 25, 19, 15],
        prec: [5, 4, 3, 2, 1, 0, 0, 0, 1, 2, 3, 5] },
      { id: "mediterranean", label: "지중해성 기후",
        temp: [10, 11, 13, 15, 19, 23, 26, 26, 23, 19, 14, 11],
        prec: [80, 70, 55, 40, 25, 8, 2, 5, 20, 60, 90, 95] },
      { id: "monsoon", label: "온대 계절풍 기후",
        temp: [-2, 0, 6, 12, 18, 22, 25, 26, 21, 15, 7, 0],
        prec: [20, 25, 45, 75, 100, 140, 380, 350, 140, 50, 45, 20] },
      { id: "subarctic", label: "냉대 기후",
        temp: [-18, -15, -6, 4, 12, 17, 20, 18, 11, 3, -7, -15],
        prec: [20, 15, 20, 30, 50, 70, 80, 75, 55, 40, 30, 25] },
      { id: "tundra", label: "툰드라 기후",
        temp: [-28, -28, -25, -16, -5, 3, 8, 6, 1, -8, -19, -25],
        prec: [10, 10, 10, 12, 15, 25, 35, 40, 30, 20, 15, 12] }
    ]
  },

  /* ---------------- 6-7. 선거 제도와 의석 배분 ----------------
     v: 정당별 전국 득표율(%), 순서대로 A당, B당, C당, D당 (D당은 자동 계산)
     threshold: 봉쇄 조항(%), spread: 지역별 지지 차이(배, 0이면 모든 지역의 지지율이 같음)
     offsets: 지역구별 지지율 차이(%p). 각 행과 각 열의 합이 0이라 전국 득표율은 그대로예요.
     지역구 득표율 = 전국 득표율 + spread × offset (0 미만은 0으로 두고 합계를 100%로 다시 맞춤)
     지역구마다 유권자 수는 같다고 가정해요. */
  election: {
    source: SG.VIRTUAL,
    parties: ["A당", "B당", "C당", "D당"],
    districtSeats: 10,   // 지역구 수 (소선거구제: 지역구마다 1명 당선) = offsets 행 수
    prSeats: 10,         // 비례대표 의석 수
    offsets: [
      [14, -12, -2, 0], [10, -8, -1, -1], [6, -6, 1, -1], [3, -2, -2, 1], [-3, 4, 0, -1],
      [-5, 6, -1, 0], [-9, 10, -1, 0], [-13, 13, 0, 0], [-2, -3, 4, 1], [-1, -2, 2, 1]
    ],
    initial: { v: [40, 35, 17, 8], threshold: 3, spread: 1, ruling: "0" },   // ruling: 여당(대통령 소속 정당) 번호, "0" = A당
    presets: [
      { id: "two", label: "양당 경쟁", state: { v: [45, 43, 8, 4], threshold: 3, spread: 1 } },
      { id: "multi", label: "다당 경쟁", state: { v: [31, 28, 23, 18], threshold: 3, spread: 1 } },
      { id: "flat", label: "지역 차이 없음", state: { v: [40, 35, 17, 8], threshold: 3, spread: 0 }, baselineInitial: true },
      { id: "high", label: "봉쇄 조항 강화", state: { v: [40, 35, 17, 8], threshold: 10, spread: 1 }, baselineInitial: true }
    ]
  }
};

/* 과목 필터 목록 (메인 화면) */
SG.subjects = [
  { id: "all", label: "전체" },
  { id: "integrated", label: "통합사회" },
  { id: "sociology", label: "사회와 문화" },
  { id: "economics", label: "경제" },
  { id: "geography", label: "지리" },
  { id: "politics", label: "정치" }
];
