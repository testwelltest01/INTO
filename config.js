/* =====================================================================
 *  INTO CHURCH 앱 설정
 *  ---------------------------------------------------------------
 *  Supabase 프로젝트 > Project Settings > API 에서 값을 복사해 넣으세요.
 *    - SUPABASE_URL      : Project URL  (예: https://abcdxyz.supabase.co)
 *    - SUPABASE_ANON_KEY : anon public key (공개돼도 되는 키. service_role 키는 절대 넣지 마세요!)
 *
 *  두 값이 비어 있으면 "데모 모드"로 동작합니다.
 *  (데이터가 이 브라우저에만 저장되며, 화면/기능을 미리 확인하는 용도)
 * ===================================================================== */
window.INTO_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // Supabase JS SDK 주소 (보통 바꿀 필요 없음)
  SUPABASE_SDK: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',

  // 앱 이름 (홈 화면 아이콘 아래 표시 이름은 manifest.webmanifest 에서 변경)
  APP_NAME: 'INTO CHURCH'
};
