export default {
  settings: {
    eyebrow: "설정",
    title: "설정",
    desc: "계정, 외관, 갤러리 새로고침을 관리합니다.",
    navLabel: "설정 분류",
    nav: {
      account: "계정",
      appearance: "외관",
      refresh: "새로고침",
      share: "공유",
    },
    sections: {
      account: {
        title: "계정",
        desc: "세션 상태 확인, 로그인 비밀번호 변경, 앱 아이콘 도우미 설치 설정을 관리합니다.",
        changePassword: "비밀번호 변경",
      },
      appearance: {
        title: "외관",
        desc: "UI 언어와 라이트/다크 테마를 전환합니다.",
        theme: "테마",
      },
      refresh: {
        title: "새로고침",
        desc: "기기 갤러리 목록과 스크린샷 자동 새로고침 간격을 설정합니다.",
      },
      share: {
        title: "공유",
        desc: "읽기 전용 공유 링크를 만들어 비밀번호 없이 화면을 볼 수 있게 합니다(기간 제한, 폐기 가능).",
      },
    },
    language: "UI 언어",
    languageHint: "전환 후 즉시 적용되며, 설정은 브라우저에 저장됩니다.",
    deviceInterval: "기기 목록 새로고침 간격(초)",
    screenshotInterval: "스크린샷 새로고침 간격(초)",
    intervalHint:
      "기본: 목록 1초, 스크린샷 5초. 백그라운드 업데이트 중에도 이전 프레임을 유지합니다.",
    save: "설정 저장",
    savedFeedback: "목록 {device}초, 스크린샷 {screenshot}초마다 새로고침합니다.",
    passwordStatus: "비밀번호 상태",
    sessionExpiry: "세션 만료",
    iconHelper: "앱 아이콘 도우미",
    iconHelperHint:
      "시작 메뉴와 앱 관리에서 아이콘·이름을 가져오려면 작은 서비스 앱이 필요합니다. 「묻기」에서 두 번 거절하면 더 이상 표시되지 않으며, 여기서 언제든 변경할 수 있습니다.",
    iconHelperAsk: "묻기(기본)",
    iconHelperAllow: "항상 설치 허용",
    iconHelperNever: "설치 안 함(패키지 이름만)",
  },
};
