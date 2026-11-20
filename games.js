// 게임 목록: 새 게임 추가는 여기만 수정. 홈의 오늘의 게임, 신작 캘린더, 전체 게임이 모두 이 표에서 생성됨.
//   id      세이브에서 쓰는 이름, 정해지면 바꾸지 말 것
//   no      몇 번째 기획인지
//   date    공개일(당일에는 이 게임이 「오늘의 게임」); 신작이 없는 날은 공개된 게임 중에서 날짜별 로테이션
//   url     게임 입구
//   cover   커버 이미지(실기 캡처), pos 는 크롭할 때 초점 위치
//   tags    필터와 검색에 사용; screen 은 세로 화면 / 가로 화면
//   record  이 게임의 세이브를 읽어 홈에 보여줄 기록 문구 반환; 기록이 없으면 ''
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };

export const GAMES = [
  {
    id: 'td', no: 1, date: '2026-11-14', name: '크리스탈 타워 수호전', url: 'td/', cover: 'covers/td.jpg', pos: '50% 50%',
    intro: '길을 따라 아홉 종류의 방어탑을 배치해 크리스탈 타워를 지키세요. 에너지가 가득 차면 여섯 가지 궁극기를 발동, 운석·천둥·빙결로 한 번에 쓸어버립니다.',
    tags: ['타워 디펜스', '궁극기'], screen: '가로 화면', mins: 15, more: '키보드+마우스 추천',
    record: () => { const s = read('echo_td'), n = s && Array.isArray(s.stars) ? s.stars.filter((x) => x > 0).length : 0; return n ? '클리어 <b>' + n + ' / 4</b> 스테이지' : ''; },
  },
  {
    id: 'tide', no: 2, date: '2026-11-15', name: '물결 소탕', url: 'tide/', cover: 'covers/tide.jpg', pos: '50% 52%',
    intro: '소대를 좌우로 드래그해 움직이며, 얼음을 깨서 대원·무기·거대한 조력자를 얻고 몰려오는 몬스터 물결을 쓸어버리세요. 적은 많고 약해서 한 방에 와르르.',
    tags: ['슈팅', '스트레스 해소'], screen: '세로 화면', mins: 5, more: '한 손으로 플레이',
    record: () => { const n = +(localStorage.getItem('echo_tide_best') || 0); return n ? '최고 처치 <b>' + n.toLocaleString() + '</b>' : ''; },
  },
  {
    id: 'eat', no: 3, date: '2026-11-15', name: '먹는 대로 싸기', url: 'eat/', cover: 'covers/eat.jpg', pos: '50% 62%',
    intro: '꼬마 짐승 뚠뚠이가 질주하며 먹는 것을 그대로 싸냅니다: 고추는 불을 뿜고, 아이스크림은 얼리고, 수박은 점보로. 그것들로 뒤쫓아오는 식탐 괴물을 날려버리세요.',
    tags: ['러닝', '코믹', '스트레스 해소'], screen: '세로 화면', mins: 4, more: '한 손으로 플레이',
    record: () => { const n = +(localStorage.getItem('echo_eat_best') || 0); return n ? '최고 점수 <b>' + n.toLocaleString() + '</b>' : ''; },
  },
  {
    id: 'scrub', no: 4, date: '2026-11-15', name: '때밀이 달인', url: 'scrub/', cover: 'covers/scrub.jpg', pos: '50% 45%',
    intro: '눌러서 드래그하며 때수건으로 손님 등의 때를 한 줄씩 밀어내세요. 아픈 곳은 피하고 묵은 때를 벗겨내며, 제한 시간 안에 깨끗하게 마치면 팁이, 악평 세 번이면 폐업.',
    tags: ['때밀이', '코믹', '스트레스 해소'], screen: '세로 화면', mins: 4, more: '손가락으로 문지르기',
    record: () => { const n = +(localStorage.getItem('echo_scrub_best') || 0); return n ? '최고 수입 <b>' + n.toLocaleString() + '원</b>' : ''; },
  },
  {
    id: 'moyu', no: 5, date: '2026-11-15', name: '월급 루팡 달인', url: 'moyu/', cover: 'covers/moyu.jpg', pos: '50% 30%',
    intro: '누르고 있으면 딴짓, 떼면 일하는 척. 오래 놀수록 더 벌고 수법도 점점 엉뚱해지지만, 사장이 뒤돌아보고 카메라에 빨간불이 켜지고 인사팀이 지나갑니다. 세 번 걸리면 해고.',
    tags: ['반응속도', '코믹', '직장'], screen: '세로 화면', mins: 5, more: '손가락 하나로 플레이',
    record: () => { const n = +(localStorage.getItem('echo_moyu_best') || 0); return n ? '최고 딴짓 수입 <b>' + n.toLocaleString() + '원</b>' : ''; },
  },
  {
    id: 'metro', no: 6, date: '2026-11-15', name: '지옥철 밀어넣기', url: 'metro/', cover: 'covers/metro.jpg', pos: '50% 38%',
    intro: '출근 러시아워 승강장, 문은 십여 초만 열립니다. 눌러서 푸셔를 드래그해 승객을 한 삽씩 차 안으로 밀어 넣으세요. 사람이 눌리면 찌그러지고 튕겨 나옵니다. 내릴 사람은 먼저 내보내야 하고, 정원을 못 채우면 민원이 들어옵니다.',
    tags: ['물리', '코믹', '스트레스 해소'], screen: '세로 화면', mins: 4, more: '손가락으로 밀기',
    record: () => { const n = +(localStorage.getItem('echo_metro_best') || 0); return n ? '최고 점수 <b>' + n.toLocaleString() + '</b>' : ''; },
  },
  {
    id: 'pop', no: 7, date: '2026-11-15', name: '뽁뽁이 터뜨리기', url: 'pop/', cover: 'covers/pop.jpg', pos: '50% 50%',
    intro: '손가락으로 쓸어넘기면 뽁뽁뽁 터집니다. 제한 시간 안에 한 장씩 이어서 터뜨리세요: 금색 뽁뽁이는 시간 추가, 연쇄 뽁뽁이는 한 번에 펑, 두꺼운 건 두 번, 방귀 뽁뽁이는 절대 금지.',
    tags: ['손속도', '스트레스 해소'], screen: '세로 화면', mins: 2, more: '쓸어넘기며 플레이',
    record: () => { const n = +(localStorage.getItem('echo_pop_best') || 0); return n ? '최고 점수 <b>' + n.toLocaleString() + '</b>' : ''; },
  },
  {
    id: 'ring', no: 8, date: '2026-11-15', name: '야시장 고리 던지기', url: 'ring/', cover: 'covers/ring.jpg', pos: '50% 45%',
    intro: '야시장 노점, 10원에 고리 12개. 눌러서 위로 끌어 조준하고 놓아서 던지세요. 걸린 것은 무엇이든 가져갑니다. 멀수록 비싸고, 거위는 걸어다니고, 금괴는 미끄러지고, 주인은 "발이 미끄러졌네"를 시전합니다.',
    tags: ['투척', '코믹', '캐주얼'], screen: '세로 화면', mins: 2, more: '끌었다 놓기',
    record: () => { const n = +(localStorage.getItem('echo_ring_best') || 0); return n ? '최고 획득 <b>' + n.toLocaleString() + '원</b>' : ''; },
  },
  {
    id: 'match', no: 9, date: '2026-11-15', name: '맞선 코너 스피드 매칭', url: 'match/', cover: 'covers/match.jpg', pos: '50% 28%',
    intro: '공원 맞선 코너, 아주머니가 조건을 읊고 후보가 한 명씩 나옵니다. 전부 맞으면 오른쪽으로, 하나라도 어긋나면 왼쪽으로 넘기세요. 조건은 점점 많아지고 교묘해지고, 세 번 틀리면 아주머니는 떠납니다.',
    tags: ['눈썰미', '코믹', '반응속도'], screen: '세로 화면', mins: 3, more: '카드 좌우 스와이프',
    record: () => { const n = +(localStorage.getItem('echo_match_best') || 0); return n ? '최고 점수 <b>' + n.toLocaleString() + '</b>' : ''; },
  },
  {
    id: 'smash', no: 10, date: '2026-11-15', name: '사무실 박살 내기', url: 'smash/', cover: 'covers/smash.jpg', pos: '50% 62%',
    intro: '찍는 곳마다 부서지고, 눌러서 쓸면 쭉쭉 박살. 모니터, 트로피, 어항, 출퇴근 기록기, 사장 의자, 금고까지 산산조각이 사방에 날립니다. 연속 파괴로 배율을 올리고 분노가 차면 폭주 한 방에 쓸어버리세요. 경비가 오기 전에 최대한 부수세요.',
    tags: ['파괴', '스트레스 해소', '손속도'], screen: '세로 화면', mins: 2, more: '찍고 쓸며 부수기',
    record: () => { const n = +(localStorage.getItem('echo_smash_best') || 0); return n ? '최고 손실액 <b>' + n.toLocaleString() + '원</b>' : ''; },
  },
  {
    id: 'rider', no: 11, date: '2026-11-16', name: '배달 라이더', url: 'rider/', cover: 'covers/rider.jpg', pos: '50% 58%',
    intro: '전동 스쿠터를 타고 구시가지에서 배달하며 아침부터 밤늦게까지 달립니다. 맑음, 비, 안개가 번갈아 옵니다. 플랫폼은 주문마다 제한 시간을 줍니다: 지각하면 삭감, 정시에 맞출수록 시간은 더 촉박해집니다. 신호를 어길지, 폭우에 주문을 받을지는 스스로 판단하세요.',
    tags: ['시뮬레이션', '드라이브', '대작 감성'], screen: '가로·세로 화면', mins: 12, more: '키보드 또는 터치',
    record: () => { try { const s = JSON.parse(localStorage.getItem('echo_rider')) || {}; return s.best ? '최고 일수입 <b>' + s.best.toFixed(1) + '원</b>' : ''; } catch (e) { return ''; } },
  },
  {
    id: 'chip', no: 12, date: '2026-11-16', name: '가죽재킷 황 사장', url: 'chip/', cover: 'covers/chip.jpg', pos: '50% 50%',
    intro: '반도체 회사 핵폭탄팹이 시총 꼴찌가 되자 창업자 황 사장이 구원투수로 복귀합니다. 12분기 동안 연구개발, 생산능력 확보, 시장 지도에서 한 칸씩 영토 쟁탈. 경쟁사도 당신을 노립니다. 발표회에서 스펙을 얼마나 부풀릴지는 직접 정하지만, 너무 나가면 사고가 납니다. 인물과 회사는 전부 허구입니다.',
    tags: ['전략', '턴제', '비즈니스'], screen: '세로 화면', mins: 6, more: '터치 플레이, 두뇌 필요',
    record: () => { const n = +(localStorage.getItem('echo_chip_best') || 0); return n ? '최고 시가총액 <b>' + n.toLocaleString() + '억</b>' : ''; },
  },  {
    id: 'gz', no: 13, date: '2026-11-16', name: '광저우 드리프트', url: 'gz/', cover: 'covers/gz.jpg', pos: '50% 55%',
    intro: '비 갠 광저우의 밤, 전동 스쿠터로 드리프트하며 배달합니다. 환상선은 례더 대교에서 주장 신성으로 들어가 중산기념당을 돌고, 해주교를 건너 기루 옛거리와 성중촌으로 들어갔다가 광저우 타워 아래로 돌아옵니다. 드리프트로 팁을 모아 놓으면 부스트, 부딪히면 국물이 쏟아지고, 시간이 끝나면 퇴근입니다.',
    tags: ['레이싱', '드리프트', '대작 감성'], screen: '가로·세로 화면', mins: 3, more: '키보드 또는 터치',
    record: () => { const n = +(localStorage.getItem('echo_gz_best') || 0); return n ? '최고 수입 <b>' + n.toLocaleString() + '원</b>' : ''; },
  },
];
