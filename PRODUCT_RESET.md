# ArgusVene Product Reset

이 문서는 현재 코드베이스 위에 기능을 더 얹기 위한 문서가 아니다.

이 문서는 `무엇을 만들 것인가`, `무엇을 만들지 않을 것인가`, `무엇을 재사용하지 않을 것인가`를 고정해서,
ArgusVene를 사실상 새 제품으로 다시 만들기 위한 기준 문서다.

이 문서는 [PRODUCT_V3.md](/Users/seongseunghan/Desktop/argusvenepro/PRODUCT_V3.md)를 대체한다.

## 1. 제품 한 줄 정의

ArgusVene는 여러 명의 사람이 같은 라이브 회의실에 들어와 AI 에이전트들과 함께 말하고, 만들고, 검토하고, 수정하면서 실제 산출물을 만들어내는 `실시간 회의 운영 시스템`이다.

## 2. 무엇을 만드는가

우리가 만드는 것은 다음 네 가지가 하나로 이어진 제품이다.

1. `Organization`
2. `Workspace Prep`
3. `Live Meeting Room`
4. `Outcomes`

이 중 본체는 `Live Meeting Room`이다.

나머지는 회의실을 지원하기 위한 레이어다.

## 3. 무엇을 만들지 않는가

다음은 ArgusVene의 목표가 아니다.

- 일반적인 AI 채팅 앱
- 개인용 단일 사용자 비서
- Slack/Discord 대체 메신저
- 회의가 끝난 뒤 요약만 잘하는 노트 앱
- 브라우저 안에 IDE를 통째로 재현한 제품
- 예쁘지만 실제 운영이 어려운 데모용 UI

즉, `채팅`, `문서`, `코드 생성`은 기능일 뿐이고,
제품 정체성은 `라이브 회의 운영`이다.

## 3.1 절대 조건

이번 리셋의 절대 조건은 아래 두 가지다.

- `Replit에서 급히 만든 임시 프로그램 계보를 재사용하지 않는다`
- `목업 없이 바로 사용 가능한 실제 제품만 만든다`

이 말의 의미는 단순히 파일 이름이나 UI 일부를 버린다는 뜻이 아니다.

의미는 다음과 같다.

- 임시 제품의 화면 구조를 기반으로 새 제품을 만들지 않는다
- 임시 제품의 상태 모델과 오케스트레이션을 기반으로 새 제품을 만들지 않는다
- 임시 제품의 데모용 우회와 반목업 기능을 기반으로 새 제품을 만들지 않는다
- 새 제품에서 사용자에게 노출되는 모든 핵심 기능은 end-to-end로 실제 동작해야 한다

즉 이번 버전은 `보기 좋은 데모`가 아니라 `바로 써도 되는 제품`이어야 한다.

## 4. 해커톤 기준에서의 제품 목표

이 제품은 `Gemini Live Agent Challenge` 제출을 전제로 한다.

따라서 최소 목표는 다음을 만족해야 한다.

- `Live Agents` 카테고리에 맞는 실시간 음성 중심 상호작용
- 사용자가 자연스럽게 말할 수 있는 인터페이스
- 중간에 끊고 다시 말할 수 있는 흐름
- 멀티모달 또는 시각적 작업면을 포함하는 경험
- Google Cloud 위에서 실제로 동작하는 백엔드
- 데모 영상에서 `mockup`이 아니라 `실제 동작`을 보여줄 수 있는 상태
- 사용자에게 노출된 기능이 데모용 placeholder가 아닌 상태

이 문서의 제품 방향은 Devpost 개요 페이지의 다음 조건에 맞춘다.

- Live Agents focus: `Real-time Interaction (Audio/Vision)`
- users can talk to naturally
- must use Gemini Live API or ADK
- agents are hosted on Google Cloud
- demo video must show real-time features with no mockups

참고:
- [Devpost overview](https://geminiliveagentchallenge.devpost.com/)
- [OpenClaw README](https://github.com/openclaw/openclaw/blob/main/README.md)
- [OpenClaw VISION](https://github.com/openclaw/openclaw/blob/main/VISION.md)

## 5. 핵심 사용자와 사용 장면

첫 타깃 사용자는 다음과 같다.

- 스타트업 공동창업자 팀
- 제품, 디자인, 엔지니어링이 함께 움직이는 소규모 팀
- 하드웨어/소프트웨어 혼합 프로젝트 팀

이들이 ArgusVene를 쓰는 이유는 다음 한 문장으로 정리된다.

`회의를 말로만 끝내지 않고, 회의 중에 바로 결과물을 만들고 그 결과물을 보면서 다시 결정하기 위해`

## 6. 제품의 핵심 약속

ArgusVene는 사용자에게 다음 경험을 약속해야 한다.

- 회의에 들어가면 바로 무엇을 해야 하는지 안다
- 사람과 AI가 같은 룸 안에서 같은 목표를 보고 움직인다
- 에이전트는 수동적으로 답하지 않고 실제 행동을 한다
- 중앙 작업면에서 회의 중인 결과물을 바로 본다
- 산출물은 즉시 검토와 수정의 대상이 된다
- 회의가 끝나면 결과가 태스크, 결정, 아티팩트로 남는다

## 7. 제품 플로우

제품의 기본 플로우는 아래로 고정한다.

### 7.1 Organization

조직은 다음만 담당한다.

- 팀 단위 진입점
- 멤버 관리
- 권한 관리
- 에이전트 라이브러리 관리
- 워크스페이스 목록

조직 페이지는 가볍고 명확해야 한다.
회의실보다 더 복잡하면 안 된다.

### 7.2 Workspace Prep

워크스페이스는 회의 전에 필요한 준비를 담당한다.

- 프로젝트 목적 정리
- 관련 파일 업로드
- 기본 에이전트 선정
- 사람 초대
- 이전 회의 결과 확인

이 페이지의 목적은 `회의실을 열 준비를 끝내는 것`이다.

### 7.3 Live Meeting Room

이 제품의 본체다.

반드시 3패널 구조를 유지한다.

- Left: live transcript and voice lane
- Center: live canvas and execution surface
- Right: participants, agents, permissions, command deck

하지만 이 3패널 외의 레이아웃과 시각 언어는 기존 코드를 계승하지 않는다.

### 7.4 Outcomes

회의가 끝난 뒤 결과를 구조화한다.

- decisions
- tasks
- artifacts
- follow-up sessions

이 페이지는 회의 후속 실행의 출발점이다.

## 8. Live Meeting Room 계약

### 8.1 Left Pane

좌측 패널은 대화 레인이다.

역할:

- 사람 발화
- 음성 상태
- 실시간 transcript
- 직접 명령 입력
- 특정 에이전트 지정 발화

필수 조건:

- 텍스트 턴
- 라이브 음성 턴
- 한국어 우선 흐름 지원
- human / agent / system 액션 구분
- 발화 입력이 빠르고 간단해야 함

좌측 패널은 문서 편집기가 아니라 `실시간 대화의 중심선`이어야 한다.

### 8.2 Center Pane

중앙 패널은 라이브 캔버스다.

역할:

- 지금 회의가 실제로 만들고 있는 대상 표시
- draft 생성
- 실행 결과 확인
- critique/revise 루프
- 에이전트가 결과물을 반영하는 공유 작업면

지원해야 하는 출력 유형:

- software
- hardware
- workflow
- experiment

소프트웨어의 경우:

- 생성
- 미리보기 실행
- 확인
- 수정 지시

하드웨어/워크플로우/실험의 경우:

- 구조화된 초안
- 핵심 가정
- 리스크
- 다음 행동

중앙 패널은 메모장이 아니다.
회의의 결과물이 즉시 나타나고 검토되는 `작업면`이어야 한다.

### 8.3 Right Pane

우측 패널은 운영 패널이다.

역할:

- 사람 초대
- 사람 제거
- 현재 룸 참여자 표시
- 에이전트 활성/비활성
- lead agent 선택
- build / critique / research / decide 명령

필수 조건:

- 조작이 1~2단계 안에 끝나야 함
- 누가 활성인지 한눈에 보여야 함
- 사람과 에이전트가 같은 roster 모델 안에서 보이되, UI상 구분은 분명해야 함

## 9. 에이전트 계약

에이전트는 단순 응답기가 아니다.

에이전트는 최소한 다음을 수행해야 한다.

- 자신의 역할 관점에서 말한다
- room state를 읽는다
- 필요하면 먼저 개입한다
- work order를 바꾼다
- task를 만든다
- decision을 기록한다
- artifact를 만든다
- 파일을 읽고 가져온다
- 현재 작업 대상에 대해 critique 또는 revision 제안을 한다

초기 버전의 기본 에이전트는 아래 네 종류면 충분하다.

- `Lead Strategist`
- `Product Builder`
- `Technical Critic`
- `Research Analyst`

각 에이전트에는 아래가 있어야 한다.

- role
- tone
- intervention triggers
- allowed actions
- authority boundary

## 10. 멀티유저 계약

로그인은 부가 기능이 아니다.

ArgusVene는 `공유 룸 상태`를 가지는 협업 시스템이어야 한다.

최소한 필요한 것은 다음이다.

- 실제 사용자 식별
- authorship
- workspace membership
- room presence
- invite/remove
- shared canvas visibility
- room roles

현재의 `dev auth bypass` 같은 데모용 우회는 최종 제품 기준에서 제거 대상이다.

## 11. 실행 레이어 계약

이 제품은 회의에서 끝나면 안 된다.

회의 중에 바로 무언가를 만들고, 그 결과를 보면서 수정해야 한다.

따라서 실행 레이어는 제품의 핵심이다.

### 11.1 Software

필수:

- draft 생성
- live browser runtime
- preview 열기
- room 안에서 critique/revise

### 11.2 Hardware

필수:

- 구조화된 설계 초안
- subsystem breakdown
- interfaces
- BOM starter
- technical risks

### 11.3 Workflow

필수:

- 단계별 운영 절차
- 역할 분담
- 실패 지점
- 측정 지표

### 11.4 Experiment

필수:

- hypothesis
- metric
- success/failure criteria
- next action

## 12. UX 원칙

사용성이 중요하다는 것은 깔끔하다는 뜻이 아니다.

이 제품의 UX 원칙은 다음이다.

- 회의 중 조작 횟수를 줄인다
- 중요한 상태를 항상 보이게 한다
- 각 패널의 역할을 혼동하지 않게 한다
- 시각적 장식보다 운영 명확성을 우선한다
- 카드 쌓기식 프로토타입 느낌을 버린다
- 탭 나열보다 행동 중심 구조를 쓴다
- 한 페이지에 모든 기능을 우겨넣지 않는다

디자인 원칙:

- 차분하고 밀도 높은 레이아웃
- 명확한 위계
- 빠른 스캔 가능성
- 음성 상태, roster, current work object, preview 상태를 즉시 파악 가능

## 13. 기존 코드 재사용 정책

### 13.1 재사용 가능한 것

다음은 참고하거나 부분 재사용할 수 있다.

- deployment infrastructure
- Cloud Run / Cloud SQL / Secret Manager 연결
- Gemini / Gemini Live transport
- database connection
- workspace / membership / file storage 모델
- runtime preview static serving 방식
- browser session 관련 격리 아이디어

단, 이 역시 `임시 제품 계보를 살리기 위해` 가져오는 것이 아니라,
`새 제품에서 검증된 인프라 자산으로만` 제한적으로 가져오는 것이다.

### 13.2 재사용 금지

다음은 새 제품의 기반으로 재사용하지 않는다.

이 목록은 곧 `Replit에서 급히 만든 임시 프로그램 계보 전체`를 뜻한다.

- 기존 room UI 전체
- `room-v2`, `room-v3`, `room-v4`의 화면 계보
- 기존 meeting orchestration 전체
- `dev auth bypass`
- legacy `/api/meetings/:id/voice`
- 이름만 OpenClaw를 붙인 task execution 프롬프트
- stacked-card 위주의 기존 dashboard/workspace 시각 언어
- 기존 “채팅 앱 + 부가 기능” 사고방식

원칙:

`기존 코드는 reference일 뿐, foundation이 아니다.`

더 강한 원칙:

`임시 제품에서 시작해 개선하는 것이 아니라, 새 제품을 정의한 뒤 필요한 인프라만 제한적으로 가져온다.`

## 14. OpenClaw와 Replit에서 참고할 것

### 14.1 OpenClaw에서 참고

OpenClaw에서 참고할 것은 제품 껍데기가 아니라 `런타임 사고방식`이다.

가져올 것:

- control plane와 execution/runtime 분리
- live canvas 개념
- lean core + plugin 확장 철학
- agent harness와 tool execution 구조
- 안전한 고권한 워크플로우에 대한 태도

가져오지 않을 것:

- 개인 비서 중심 제품 정체성
- 다중 채널 메신저 허브 구조
- 터미널 중심 onboarding 경험

OpenClaw 공식 문서에서 확인한 참고 포인트:

- README는 OpenClaw를 `personal AI assistant`로 정의하고, Gateway는 control plane이라고 설명한다.
- README highlights에는 multi-agent routing, live canvas, first-class tools가 강조되어 있다.
- VISION은 better computer-use and agent harness capabilities를 다음 우선순위로 둔다.
- VISION은 optional capability를 plugin으로 두고 core는 lean하게 유지하라고 말한다.

### 14.2 Replit에서 참고

Replit에서 참고할 것은 `IDE UI`가 아니라 다음 루프다.

- generate
- run
- inspect
- revise

즉 사용자가 결과를 즉시 보고 다시 지시할 수 있는 감각이다.

가져오지 않을 것:

- Replit의 전체 제품 구조
- IDE형 복잡한 chrome
- 개발자 전용 인터페이스

## 15. 첫 번째 실제 제품 슬라이스

첫 번째로 완성해야 하는 것은 전체 제품이 아니라 아래 루프다.

1. 사용자가 워크스페이스에서 라이브 룸을 연다
2. 두 명 이상의 사람과 두 개 이상의 에이전트가 보인다
3. 사용자가 한국어 또는 영어로 말하거나 입력한다
4. lead agent가 자연스럽게 응답한다
5. 같은 턴에서 work order 또는 artifact가 바뀐다
6. 중앙 캔버스가 즉시 변한다
7. 소프트웨어라면 runnable preview를 연다
8. 룸이 그 결과를 critique하고 다음 revision을 만든다
9. 회의 종료 후 decision/task/artifact가 남는다

이 루프가 깨끗하지 않으면 제품이 아니다.

## 16. 구현 순서

구현은 아래 순서로 진행한다.

1. `Product contract freeze`
2. `Greenfield app shell`
3. `Shared room state model`
4. `Room presence + authorship`
5. `Agent runtime + action loop`
6. `Center canvas state`
7. `Software runtime preview`
8. `Outcomes persistence`
9. `Workspace prep polish`
10. `Organization layer polish`

즉 지금 당장 해야 할 일은 기능 추가가 아니라
`새 제품의 기반 구조를 제대로 다시 세우는 것`이다.

## 17. 완료 기준

아래를 만족해야 “첫 제품이 된다”고 본다.

- 사용자가 룸에 들어가자마자 구조를 이해한다
- 음성 또는 텍스트로 바로 대화가 된다
- 에이전트가 역할감 있게 반응한다
- 에이전트가 실제 액션을 남긴다
- 중앙 작업면이 실시간으로 바뀐다
- software preview가 실제로 열린다
- 멀티유저 authorship이 유지된다
- 회의가 outcomes로 이어진다
- 데모 영상에서 `mockup` 없이 시연 가능하다
- 데모용 우회 로그인, placeholder endpoint, 가짜 음성 흐름 없이 작동한다
- 사용자에게 보이는 버튼과 패널은 모두 실제 기능에 연결되어 있다
- “될 것처럼 보이는 기능”이 아니라 “지금 되는 기능”만 남아 있다

## 18. 한 줄 결론

ArgusVene는 `AI가 들어와 있는 회의실`이 아니다.

ArgusVene는 `사람과 AI가 함께 들어가 실제로 일을 진전시키는 라이브 회의 운영 시스템`이어야 한다.
