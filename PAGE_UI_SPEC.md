# ArgusVene Page and UI Spec

이 문서는 [PRODUCT_RESET.md](/Users/seongseunghan/Desktop/argusvenepro/PRODUCT_RESET.md)를 실제 화면 단위로 풀어낸 문서다.

목적은 하나다.

`앞으로 어떤 페이지를 만들고, 각 페이지에 어떤 기능과 UI가 들어가야 하는지 고정한다.`

이 문서는 디자인 참고 메모가 아니라 `구현 계약서`다.

## 1. 공통 원칙

모든 페이지는 아래 원칙을 따른다.

- 목업성 버튼 금지
- placeholder 패널 금지
- 한 페이지 안에 너무 많은 기능을 욱여넣지 않기
- 각 페이지는 하나의 명확한 목적을 가져야 함
- 각 페이지 진입 후 3초 안에 “여기서 뭘 해야 하는지” 이해 가능해야 함
- 시각적 장식보다 작업 흐름을 우선
- 정보 밀도는 높되, 피로감은 낮아야 함
- 데모용 우회 로그인, 가짜 API, fake state에 의존하지 않음

## 2. 페이지 맵

초기 제품의 정식 페이지는 아래 여섯 개로 고정한다.

1. `Login / Auth Gate`
2. `Organization Home`
3. `Organization Settings`
4. `Workspace Prep`
5. `Live Meeting Room`
6. `Outcomes`

초기 빌드에서 별도 페이지로 만들지 않는 것:

- 별도 채팅 페이지
- 별도 코드 생성 페이지
- 별도 agent playground
- 별도 demo-only landing page

## 3. 페이지별 상세 정의

### 3.1 Login / Auth Gate

경로:

- `/login`

목적:

- 실제 사용자 인증
- 멀티유저 협업의 진입점

이 페이지에서 필요한 기능:

- 이메일/소셜 로그인
- 최초 사용자 진입 처리
- 로그인 실패 메시지
- 로그인 성공 후 이전 목적지로 복귀

UI 구조:

- 중앙 정렬 단일 컬럼
- 상단: 제품명과 한 줄 설명
- 중단: 로그인 방식 선택
- 하단: 조직 협업 제품이라는 설명 한 줄

UI 요소:

- 이메일 입력
- 비밀번호 입력
- Google 로그인 버튼
- 로그인 상태/에러 피드백

절대 넣지 않을 것:

- 제품 전체 기능 설명을 과하게 늘어놓는 랜딩형 구성
- 마케팅성 카드 나열
- 데모용 bypass 버튼

완료 기준:

- 실제 계정으로 로그인 가능
- 실패 메시지가 정상 표시됨
- 인증 후 실제 조직 홈으로 이동

### 3.2 Organization Home

경로:

- `/`

목적:

- 조직 전체의 운영 현황을 한눈에 보여줌
- 워크스페이스 진입과 생성
- 현재 라이브 회의실 상황 확인

이 페이지에서 필요한 기능:

- 워크스페이스 목록
- 새 워크스페이스 생성
- 현재 진행 중인 live room 요약
- 최근 산출물 수, 참여자 수, 진행 중 태스크 수
- 조직 설정 페이지로 이동

UI 구조:

- 상단 고정 헤더
- 좌측 메인: 워크스페이스 리스트
- 우측 보조: 조직 상태 요약

정보 우선순위:

1. 어떤 워크스페이스가 있는가
2. 어디서 라이브 회의가 열려 있는가
3. 어느 워크스페이스로 들어가야 하는가

UI 요소:

- `New Workspace` 버튼
- workspace card/list item
- `Live now` 상태 뱃지
- 최근 outputs summary
- settings 진입 버튼

디자인 원칙:

- stacked card 제품 느낌 금지
- list + summary 형태로 단정하게 구성
- 사용자가 “어디로 들어가야 하는지” 즉시 알 수 있어야 함

완료 기준:

- 워크스페이스 생성/목록/진입이 실제 동작
- 현재 active room이 있으면 즉시 재진입 가능

### 3.3 Organization Settings

경로:

- `/org/settings`

목적:

- 조직 레벨 관리
- 멤버, 역할, 권한, agent library 관리

이 페이지에서 필요한 기능:

- 멤버 목록
- 역할 변경
- 초대 발송
- 비활성/제거
- 에이전트 라이브러리 관리
- 조직 기본 voice/language/default room policy 설정

이 페이지에서 다뤄야 하는 데이터:

- organization members
- roles
- invitation status
- agent templates
- default agent permissions

UI 구조:

- 상단: 조직 정보와 저장 상태
- 좌측 서브네비:
  - Members
  - Roles
  - Agent Library
  - Defaults
- 우측 메인 패널: 선택한 섹션 상세

UI 요소:

- invite member input
- member row
- role dropdown
- agent template create/edit form
- organization default language selector

절대 넣지 않을 것:

- 회의실 수준의 조작을 여기 넣기
- product analytics 대시보드처럼 복잡한 차트 남발

완료 기준:

- 조직 멤버 관리가 실제 DB와 연결
- 에이전트 템플릿 수정이 실제 워크스페이스/룸 생성에 반영됨

### 3.4 Workspace Prep

경로:

- `/workspace/:id`

목적:

- 회의 전에 필요한 모든 준비를 끝내는 곳
- 사람, 파일, 기본 에이전트, 회의 목적을 정리하는 곳

이 페이지에서 필요한 기능:

- 워크스페이스 목적/설명 편집
- 파일 업로드/조회/삭제
- 기본 에이전트 선택
- 사람 초대/제거
- 새 라이브룸 열기
- 이전 회의와 최근 산출물 요약

정보 우선순위:

1. 이 워크스페이스가 뭘 하는 곳인가
2. 지금 회의를 열 준비가 되었는가
3. 어떤 파일과 사람이 연결돼 있는가
4. 어떤 에이전트를 기본으로 붙일 것인가

UI 구조:

- 상단: workspace title, description, `Open Room`
- 본문 2컬럼
  - 좌측: prep essentials
  - 우측: recent history and outputs

좌측 섹션:

- Mission
- People
- Files
- Default Agents

우측 섹션:

- Recent Meetings
- Recent Decisions
- Recent Tasks
- Recent Artifacts

UI 요소:

- drag-and-drop file upload
- member invite input
- agent select list
- `Open Live Room` 버튼

사용성 기준:

- 이 페이지에서 사용자가 고민해야 할 것은 “뭘 준비했는가” 뿐이어야 한다
- 복잡한 분석보다 `회의를 바로 열 수 있는지`가 중요하다

완료 기준:

- 파일 업로드/삭제 실제 동작
- 초대/제거 실제 동작
- 기본 agent 선택이 룸 생성에 반영
- room open이 실제 meeting 생성으로 이어짐

### 3.5 Live Meeting Room

경로:

- `/meeting/:id`

목적:

- ArgusVene의 본체
- 사람과 AI가 실제로 함께 일하는 공간

이 페이지의 비기능 요구:

- voice-first
- Korean-first friendly
- multi-user aware
- current state immediately visible
- software preview launchable

#### 3.5.1 전체 구조

반드시 3패널 구조를 유지한다.

- Left: Transcript Lane
- Center: Live Canvas / Workbench
- Right: Operator Rail

상단에는 얇은 운영 헤더만 둔다.

상단 헤더에 들어갈 것:

- room title
- workspace name
- live voice status
- active humans / active agents
- preview ready state
- outcomes 이동 버튼

상단 헤더에 넣지 않을 것:

- 긴 설명 문구
- 기능성 없는 decorative stats

#### 3.5.2 Left: Transcript Lane

목적:

- 실시간 발화와 direct instruction

필수 기능:

- 텍스트 입력
- live voice connect/disconnect
- 마이크 mute/unmute
- 현재 음성 상태 표시
- 한국어/영어 우선 설정
- 특정 agent 지정
- human / agent / system 구분 transcript

UI 구성:

- 상단: voice controls + target agent + mode
- 중단: transcript feed
- 하단: direct instruction input

중요 상태:

- listening / speaking / disconnected
- current target
- current room mode
- current work order

절대 넣지 않을 것:

- 장문의 안내문
- 회의 흐름을 끊는 confirm modal 남발

#### 3.5.3 Center: Live Canvas / Workbench

목적:

- 회의 중 실제 작업 대상이 나타나는 중심 작업면

필수 기능:

- 현재 작업 대상 표시
- build objective 입력
- output type 선택
  - software
  - hardware
  - workflow
  - experiment
- draft 생성
- preview 열기
- 최근 artifact/decision/task 참조
- agent action에 따라 canvas state 업데이트

software일 때 필수:

- runnable preview
- 새 탭 열기
- revise를 위한 현재 draft 유지

hardware/workflow/experiment일 때 필수:

- 구조화된 draft
- assumptions
- risks
- next actions

UI 구성:

- 상단: current work order + objective + build controls
- 중앙 메인: draft 또는 preview
- 우측 또는 하단 보조 영역: recent room outputs

중앙 패널의 핵심 규칙:

- 노트 패널이 아니다
- 대화 결과가 바로 작업 대상이 되어야 한다
- agent가 바꾼 결과가 바로 보여야 한다

절대 넣지 않을 것:

- 예쁘기만 한 diagram placeholder
- 비어 있는 canvas 위에 문구만 있는 상태

#### 3.5.4 Right: Operator Rail

목적:

- 회의 운영

필수 기능:

- 현재 룸 사람 roster
- 현재 활성 agent roster
- agent on/off
- lead agent focus
- build / critique / research / decide command
- 사람 초대/제거
- attached context/files 보기

UI 구성:

- 상단: command deck
- 중단: agents
- 하단: humans and attached context

운영 원칙:

- 클릭 수 최소화
- 누가 active인지 바로 보여야 함
- 사람과 agent가 모두 “현재 room state” 기준으로 보여야 함

절대 넣지 않을 것:

- agent 설명 카드 나열
- 기능은 없고 badge만 많은 패널

#### 3.5.5 Live Room 완료 기준

다음이 실제로 다 되어야 한다.

- 사람이 말하거나 입력할 수 있다
- 에이전트가 실제로 응답한다
- 에이전트가 action을 남긴다
- work order가 바뀐다
- 중앙 캔버스가 바뀐다
- software output은 preview가 열린다
- 사람이 그 결과를 다시 critique하게 할 수 있다
- 룸 종료 후 outcomes로 이어진다

### 3.6 Outcomes

경로:

- `/workspace/:id/outcomes`

목적:

- 회의 결과를 구조화하고 후속 실행으로 이어주는 페이지

이 페이지에서 필요한 기능:

- decisions 목록
- tasks 목록
- artifacts 목록
- 회의별로 필터링
- 상태 변경
- 후속 회의 생성

정보 우선순위:

1. 무엇이 결정되었는가
2. 누가 무엇을 해야 하는가
3. 어떤 산출물이 남았는가
4. 다음 회의를 어디서 이어갈 것인가

UI 구조:

- 상단: summary strip
- 본문: 3열 또는 3섹션
  - Decisions
  - Tasks
  - Artifacts

UI 요소:

- filter by meeting
- task status update
- open artifact
- start follow-up room

절대 넣지 않을 것:

- 회의실에서 이미 본 정보를 장식적으로 반복하는 섹션

완료 기준:

- 회의 결과가 실제로 이 페이지에 남음
- tasks/decisions/artifacts가 실제 데이터와 연결됨
- follow-up room 생성이 실제로 이어짐

## 4. 페이지 간 이동 규칙

이동 흐름은 아래로 고정한다.

1. Login
2. Organization Home
3. Workspace Prep
4. Live Meeting Room
5. Outcomes

역이동도 명확해야 한다.

- Meeting Room -> Workspace
- Meeting Room -> Outcomes
- Outcomes -> Workspace
- Workspace -> Organization Home
- Organization Home -> Organization Settings

## 5. 디자인 시스템 기준

모든 페이지 공통 시각 원칙:

- 과한 카드 스택 금지
- 큰 radius 남발 금지
- 얇고 정확한 hierarchy
- 상태 색상은 소수만 사용
- 음성 상태, active state, preview state는 한눈에 구분
- typography는 운영 콘솔답게 밀도 있고 안정적이어야 함

기본 톤:

- calm
- operational
- precise
- not playful
- not hackathon-demo flashy

## 6. 첫 구현 우선순위

문서상 모든 페이지를 정의하더라도, 구현 우선순위는 아래로 간다.

1. `Live Meeting Room`
2. `Workspace Prep`
3. `Outcomes`
4. `Organization Home`
5. `Organization Settings`
6. `Login polish`

이유:

- 제품 본체는 회의실
- 회의실이 성립해야 다른 페이지도 의미가 생김

## 7. 구현 중 지켜야 할 규칙

- 기존 임시 제품 계보에서 화면 구조를 가져오지 않는다
- 기존 실험용 room 계보를 베이스로 고치지 않는다
- 페이지를 새로 만들되, 필요한 인프라만 제한적으로 가져온다
- 버튼을 만들면 반드시 끝까지 동작하게 한다
- “나중에 연결” 예정인 패널은 만들지 않는다
- 제품에 보여주는 기능은 전부 실제 작동해야 한다

## 8. 한 줄 결론

ArgusVene의 화면은 많아 보이면 안 된다.

각 페이지는 역할이 분명해야 하고,
그 역할은 결국 `사람과 AI가 라이브 회의에서 실제로 일을 진전시키는 것`으로 수렴해야 한다.
