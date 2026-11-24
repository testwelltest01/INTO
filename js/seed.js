/* =====================================================================
 * 기본 사이트 콘텐츠 (into.or.kr 에서 옮겨온 문구·사진)
 *  - Supabase 모드: site_content 테이블에 값이 없으면 이 기본값을 사용
 *  - 데모 모드: 처음 실행 시 이 값으로 로컬 DB 를 채움
 *  - 관리자 > 사이트 콘텐츠 화면에서 모두 수정 가능
 * ===================================================================== */
window.INTO_DEFAULTS = (function () {
  var P = 'assets/photos/';
  var slides = [];
  for (var i = 1; i <= 11; i++) slides.push(P + 'slide-' + (i < 10 ? '0' + i : i) + '.jpg');

  var content = {
    church: {
      name: '인투교회',
      nameEn: 'INTO CHURCH',
      email: 'admin@into.or.kr',
      website: 'www.into.or.kr',
      pastor: '김윤호',
      office: '경기도 성남시 분당구 판교공원로3길 4, 4층 403호 FSQ(판교동)',
      affiliation: 'KAICAM 한국독립교회선교단체연합회 소속',
      regNo: '213-82-76285'
    },

    home: {
      heroLines: ['더 깊이,', '더 가까이,', '더 낮게'],
      sloganLines: ['Into the Low, Into the Deep;', 'Your Life, Our Mission.'],
      intro: '우리는 흩어진 그리스도인을 찾는 교회입니다.\n교회를 떠났지만 신앙을 놓지 못한 사람들,\n일에 쫓겨 예수님을 잃어버린 사람이 있습니다.\n우리는 그들이 돌아오기를 기다리지 않고 먼저 찾아갑니다.',
      heroImage: P + 'home-hero.jpg',
      principles: [
        { en: 'Deeper', ko: '안에서 밖으로', text: '교회는 목적지가 아니라 출발점입니다. 모이는 것은 충전, 흩어지는 것이 사명입니다.', verse: '요한복음 17:18' },
        { en: 'Closer', ko: '멀리서 가까이로', text: '예수님은 멀리서 지켜보지 않고 우리 동네로 이사 오셨습니다. 우리도 그렇게 곁으로 갑니다.', verse: '요한복음 1:14' },
        { en: 'Lower', ko: '높은 곳에서 낮은 곳으로', text: '복음은 언제나 아래로 흐릅니다. 우리는 더 큰 교회보다 더 낮은 교회를 꿈꿉니다.', verse: '빌립보서 2:6-8' }
      ],
      place: {
        label: '우리는 여기서 예배합니다.',
        name: 'STEADFAST COFFEE & WORKS',
        desc: '판교의 흩어진 성도님을 찾기 위해 개척을 준비하던 중, 하나님이 예비하신 공간을 만났습니다.\n\n인투처치는 이곳에서 예배하며 R12의 사역에 동참하고 있습니다.',
        address: '성남시 분당구 판교공원로2길 22, 1층',
        linkLabel: '스테드패스트 커피앤웍스',
        linkUrl: 'https://steadfastcoffeeandworks.com/'
      },
      slides: slides,
      waysTitle: '인투처치와 함께 하는 방법'
    },

    about: {
      title: '우리는 인투처치입니다',
      heading: 'INTO CHURCH, 우리가 세우는 집',
      paragraphs: [
        '교회는 건물이 아닙니다.\n교회는 사람들이 모여 함께 살아가는 집입니다.',
        '집은 단순한 건물이 아닙니다.\n집은 누군가의 하루가 시작되고 끝나는 곳,\n지친 몸을 눕히고 다시 일어서는 곳, 혼자가 아니라는 것을 확인하는 곳입니다.',
        '우리는 건물이 아니라 집을 짓고 싶었습니다.',
        '삶 바깥에 서 있는 교회가 아니라,\n삶 한가운데로 걸어 들어가는 교회.\n멀리서 오라고 부르는 교회가 아니라, 거기로 내가 가겠다고 말하는 교회.\n단어와 글자가 아니라 이야기 속으로 들어가는 교회.'
      ],
      intoTitle: 'INTO.',
      intoLead: '이 단어 안에 우리의 모든 방향이 담겨 있습니다.',
      intoList: ['Into your day', 'Into your suffering', 'Into your hope', 'Into your life'],
      incarnation: [
        '이것은 2000년 전, 하나님이 선택하신 방식이기도 합니다.',
        '그 분은 멀리서 지켜보지 않고, 직접 이 땅에 오셨습니다.\n높은 곳에 머물지 않고, 가장 낮은 곳으로 들어오셨습니다.',
        '성육신, Incarnation.\n하나님이 우리 삶 속으로 INTO 하신 사건.',
        '인투처치는 그 발걸음을 따라가는 공동체입니다.'
      ],
      image: P + 'about-1.jpg'
    },

    worship: {
      title: '주일 예배 안내',
      image: P + 'worship-1.jpg',
      times: [
        { time: '오후 2시', name: 'INTO WORSHIP', desc: '말씀을 듣고, 나누고, 함께 기도합니다.' },
        { time: '오후 3시', name: 'INTO TABLE', desc: '식탁에서 삶을 나누고 서로를 위해 기도합니다.' }
      ],
      placeName: 'STEADFAST COFFEE & WORKS',
      address: '성남시 분당구 판교공원로2길 22, 1층',
      notes: '처음 오시는 분은 아래 [예배 문의]를 남겨 주시면 미리 안내해 드립니다.'
    },

    community: {
      title: '예배와 공동체',
      items: [
        { en: 'INTO WORSHIP', ko: '예배로 그분 앞에 섭니다', text: '말씀을 듣고, 나누고, 함께 기도합니다.' },
        { en: 'INTO TABLE', ko: '소그룹으로 하나가 됩니다', text: '식탁에서 삶을 나누고 서로를 위해 기도합니다.' },
        { en: 'INTO HIS HANDS', ko: '섬김으로 그분의 손이 됩니다', text: '실력보다 성실함으로 교회를 함께 사랑합니다.' },
        { en: 'INTO MISSION', ko: '선교로 세상에 나아갑니다', text: '매일의 판교와 대한민국을 품습니다.' }
      ]
    },

    foundation: {
      title: 'FOUNDATION',
      items: [
        { title: '우리의 이유', text: '교회 안에 있지만 외로운 청년들이 있습니다. 예배는 드리지만 삶은 나누지 못하는 청년들, 현실의 무게 앞에서 신앙의 언어가 닿지 않았던 청년들. 우리는 그들 곁에 서기 위해 모였습니다.' },
        { title: '우리의 방식', text: '우리는 예수님의 방식을 회복합니다. 군중을 모으기 전에 한 사람 앞에 앉으셨던 방식, 가르치기 전에 먼저 물으셨던 방식, 관계 안에서 복음을 전하고 삶을 나눔으로 사랑을 증명하셨던 방식. 함께 먹고, 함께 울고, 함께 걸으며 제자로 자라납니다.' },
        { title: '우리의 다름', text: '교회의 크기는 건물과 성도의 숫자가 아닙니다. 교회의 크기는 품을 수 있는 삶의 다양함, 나눌 수 있는 관계의 깊이, 하늘과 땅을 연결하는 예배의 높이입니다. 작은 공동체, 깊은 관계, 현실에 뿌리박은 영성. 인투처치는 다른 길이 있다는 것을 보여주는 교회입니다.' },
        { title: '우리의 방향', text: '청년들이 복음 안에서 희망을 찾기를. 경쟁의 시대에 환대의 언어를 말하기를. 자본주의 시대에 다른 삶을 상상하기를, 그 상상을 세상에 보여주는 사람들로 성숙 되기를, 진정한 사랑과 환대는 복음 안에서 가능하다는 것을 증명하는 사람들이 되기를.' }
      ],
      closing: '이것이 인투처치가 존재하는 이유입니다.'
    },

    links: {
      giving: 'http://aq.gy/f/Sj_-W',
      table: 'https://wealthy-dedication-954.notion.site/INTO-TABLE-3bd3f6c36c9b80b0a601ede4a64cbdab',
      newsletter: 'https://wealthy-dedication-954.notion.site/INTO-CHURCH-NEWS-2d93f6c36c9b8038b2eccb649f127b58',
      youtube: '',
      instagram: ''
    },

    // 나눔지 기본 서식 (관리자 > 나눔지 > 기본 서식 에서 수정)
    sheet_template: {
      preacher: '김윤호 목사',
      release: 'sunday',          // week: 그 주 월요일부터 / sunday: 주일 예배 시간부터 / custom: 직접 지정
      release_time: '14:00',
      summary: '',
      summary_hint: '설교의 핵심 메시지를 3~4문장으로 정리해 주세요.',
      questions: [
        '오늘 말씀에서 마음에 남은 한 구절(또는 한 문장)은 무엇인가요? 왜 그 말씀이 남았나요?',
        '이 말씀에 비추어 볼 때, 지난 한 주 나의 일상은 어땠나요?',
        '이번 한 주, 말씀대로 살아 보기 위해 내가 실천할 한 가지는 무엇인가요?'
      ],
      application: '',
      prayer: '서로의 나눔을 듣고, 오른쪽에 앉은 사람을 위해 한 문장씩 기도해 주세요.',
      allow_anonymous: true
    },

    settings: {
      require_approval: false,
      inquiry_kinds: ['예배 참석', '새가족 등록', 'INTO TABLE 참여', '기타 문의']
    }
  };

  var tags = ['예배 장소', '예배 장소', '공동체', '예배', '공동체', '예배', '예배 장소', '예배', '예배', '예배', 'INTO CHURCH'];
  var photos = [];
  for (var g = 1; g <= 11; g++) {
    var n = (g < 10 ? '0' + g : '' + g);
    photos.push({ url: P + 'gallery-' + n + '.jpg', thumb_url: P + 'thumb/gallery-' + n + '.jpg', caption: '', tag: tags[g - 1], sort: g });
  }
  var slideTags = ['공동체', 'INTO TABLE', 'INTO TABLE', '예배', '예배', '예배', '예배', '공동체', '공동체', 'INTO TABLE', '예배'];
  for (var s = 1; s <= 11; s++) {
    var m = (s < 10 ? '0' + s : '' + s);
    photos.push({ url: P + 'slide-' + m + '.jpg', thumb_url: P + 'thumb/slide-' + m + '.jpg', caption: '', tag: slideTags[s - 1], sort: 100 + s });
  }

  return { content: content, photos: photos };
})();
