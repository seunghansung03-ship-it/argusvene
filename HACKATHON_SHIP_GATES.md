# ArgusVene Hackathon Ship Gates

이 문서는 해커톤 제출 전 반드시 통과해야 하는 `출시 차단 게이트`다.

이 문서의 조건을 통과하지 못하면:

- 제품이 아무리 보기 좋아도 제출 버전으로 간주하지 않는다
- UI가 좋아 보여도 merge하지 않는다
- 데모 영상 촬영을 시작하지 않는다

기준 출처:

- [Gemini Live Agent Challenge overview](https://geminiliveagentchallenge.devpost.com/)
- [Gemini Live Agent Challenge rules](https://geminiliveagentchallenge.devpost.com/rules)

현재 기준 마감:

- `2026년 3월 16일 5:00pm PDT`
- 한국 시간 `2026년 3월 17일 오전 9:00 KST`

## 1. 절대 금지

아래 중 하나라도 남아 있으면 제출 금지다.

- mockup 영상
- fake response
- placeholder 버튼
- fake voice flow
- demo-only bypass가 필요한 핵심 기능
- “나중에 연결” 상태의 핵심 패널
- 가짜 멀티유저처럼 보이는 UI
- 실제로는 안 되는 preview 버튼

## 2. 해커톤 규정 게이트

반드시 충족:

- Gemini model 사용
- Google GenAI SDK 또는 ADK 사용
- Google Cloud 서비스 최소 1개 사용
- backend가 Google Cloud에서 실제 동작
- 실시간 multimodal/agentic behavior 시연 가능
- `<4분` 데모 영상에서 `no mockups`

현재 ArgusVene 목표 카테고리:

- `Live Agents`

따라서 반드시 보여야 하는 것:

- 자연스러운 음성 대화
- interrupt 가능한 상호작용
- live room context-awareness
- 시각적 작업면 또는 visual feedback

## 3. 제품 게이트

제출 가능한 제품으로 보기 위한 최소 동작:

1. 실제 사용자 로그인
2. 워크스페이스 진입
3. 파일 업로드
4. 라이브 룸 생성
5. 둘 이상의 agent active state 확인
6. 사용자의 텍스트 또는 음성 입력
7. agent의 실제 응답
8. agent action 실행
9. 중앙 canvas 상태 변화
10. software output이면 live preview 실행
11. 결과가 decisions/tasks/artifacts로 남음

이 11개 중 하나라도 깨지면 제출 빌드가 아니다.

## 4. UI 게이트

다음은 “좋은 UI”가 아니라 “통과해야 하는 UI” 기준이다.

- 각 페이지 목적이 즉시 이해됨
- meeting room 3패널 구조 유지
- left/center/right 역할 혼동 없음
- current work order가 항상 보임
- 누가 active한지 항상 보임
- voice state가 항상 보임
- preview ready state가 항상 보임
- 조작 버튼은 전부 실제 기능과 연결

다음은 실패 조건이다.

- 설명 없이는 사용 방법을 알 수 없음
- 카드만 많고 상태가 안 보임
- decorative dashboard처럼 보임
- meeting room보다 prep page가 더 복잡함

## 5. 인증 게이트

다음이 남아 있으면 제출 금지:

- `devAuth=1` 같은 핵심 흐름용 우회
- hosted demo domain 자동 로그인 의존
- 실제 인증 없이 멀티유저처럼 보이게 하는 처리

허용되는 것은 오직:

- 로컬 개발 전용 플래그
- 그리고 그 플래그가 production build에서 꺼지는 구조

## 6. 음성 게이트

Live Agents 제출 기준으로 다음이 필요하다.

- 실제 live voice session
- 실제 오디오 입력 경로
- 실제 agent spoken response 또는 live audio output
- turn interrupt 처리
- 한국어 또는 영어 중 최소 한 언어에서 자연스러운 데모 가능

다음은 금지:

- STT인 척하는 text mock
- 음성 버튼은 있지만 실제론 텍스트만 보내는 구조
- 녹음 후 나중에 처리하는 pseudo-live 흐름

## 7. 멀티유저 게이트

다음이 실제로 가능해야 한다.

- 둘 이상의 실제 사용자 계정
- 같은 room 진입
- authorship 구분
- human invite/remove
- room state 공유

다음은 실패:

- workspace member 목록만 보여주고 room presence인 척하는 구조
- poll만 되고 누가 실제 접속 중인지 모르는 구조를 최종 버전으로 두는 것

## 8. 에이전트 게이트

에이전트는 단순히 말만 하면 통과가 아니다.

반드시 가능한 것:

- role-specific response
- build / critique / research / decide 중 최소 3개 동작
- task or decision or artifact 생성
- work order 갱신
- 파일 컨텍스트 사용

실패 조건:

- 모든 agent가 사실상 같은 답변 스타일
- action이 없는 talk-only 구조
- 한 턴 끝나면 room state 변화가 없음

## 9. 실행 레이어 게이트

software flow에서 반드시 가능한 것:

- draft 생성
- preview launch
- preview 확인
- preview를 보고 critique/revise loop 진행

실패 조건:

- 코드만 보여줌
- preview 버튼은 있으나 실패함
- preview가 실제 product surface가 아님

## 10. 배포 게이트

제출 전에 반드시 확인:

- Cloud Run 또는 동등한 Google Cloud backend URL
- public code repository 최신화
- README에 spin-up instructions 존재
- architecture diagram 존재
- Google Cloud proof 준비

## 11. 최종 원칙

한 줄 기준은 이것이다.

`ArgusVene는 데모처럼 보이는 제품이 아니라, 지금 당장 켜서 실제로 쓸 수 있는 라이브 회의 제품이어야 한다.`
