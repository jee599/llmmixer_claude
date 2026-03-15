# LLMMixer v0.3 구현 계획

## 전제 조건

- 빈 레포에서 시작. v0.2 코드 없음. 스펙 기반 신규 구현.
- TypeScript + Next.js (App Router) + Tailwind CSS
- 스펙의 파일 구조는 JS 기반이지만, 프로젝트 컨벤션에 따라 TS로 전환.
- 모노레포 구조: `packages/core` (엔진) + `packages/dashboard` (Next.js 웹)

---

## Phase 0: 프로젝트 초기 셋업

### 0-1. 프로젝트 구조 생성
```
llmmixer_claude/
├── package.json                  # 루트 (workspaces)
├── tsconfig.json                 # 공통 TS 설정
├── .gitignore
├── CLAUDE.md
├── packages/
│   ├── core/                     # 엔진 (Node.js)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts          # 엔트리포인트
│   │       ├── types.ts          # 공통 타입 정의
│   │       ├── decomposer.ts     # LLM 태스크 분해
│   │       ├── router.ts         # 태스크→에이전트 라우팅
│   │       ├── session-manager.ts # child_process 세션 관리
│   │       ├── workflow-engine.ts # 의존관계 기반 실행 스케줄러
│   │       ├── doctor.ts         # 환경 진단
│   │       ├── worktree.ts       # git worktree CRUD
│   │       ├── context.ts        # repo-aware context 수집
│   │       ├── auth.ts           # 세션 토큰
│   │       └── adapters/
│   │           ├── base.ts       # AgentAdapter 추상 클래스
│   │           ├── claude.ts
│   │           ├── codex.ts
│   │           └── gemini.ts
│   └── dashboard/                # 웹 대시보드 (Next.js)
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       └── src/
│           └── app/
│               ├── layout.tsx
│               ├── page.tsx      # 메인 대시보드
│               ├── globals.css
│               ├── api/
│               │   ├── sse/route.ts        # SSE 스트리밍
│               │   ├── sessions/route.ts   # 세션 CRUD
│               │   ├── approve/route.ts    # 승인 응답
│               │   ├── merge/route.ts      # git merge
│               │   ├── nuke/route.ts       # 비상 종료
│               │   ├── doctor/route.ts     # 환경 진단
│               │   ├── config/route.ts     # 설정 R/W
│               │   └── decompose/route.ts  # 태스크 분해
│               └── components/
│                   ├── Dashboard.tsx        # 탭 컨테이너
│                   ├── FlowTab.tsx          # DAG 시각화
│                   ├── LogTab.tsx           # 실시간 로그
│                   ├── ResultsTab.tsx       # 결과 + diff
│                   ├── SetupTab.tsx         # 설정 + doctor
│                   ├── PromptInput.tsx      # 프롬프트 입력
│                   ├── ApprovalBanner.tsx   # 승인 요청 UI
│                   └── DagGraph.tsx         # DAG 렌더링
├── config/
│   ├── default-routing.json
│   └── templates/
│       ├── full.json
│       ├── quick.json
│       ├── review.json
│       ├── docs.json
│       └── auto.json
└── bin/
    └── llmmixer.ts               # CLI 엔트리포인트 (npx)
```

### 0-2. 의존성
```json
// 루트 package.json
{
  "name": "llmmixer",
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build"
  }
}

// core 의존성
// - 없음 (Node.js 내장만 사용: child_process, fs, path, crypto, http)

// dashboard 의존성
// - next, react, react-dom
// - tailwindcss, postcss, autoprefixer
// - @tailwindcss/typography (diff 표시용)
```

### 0-3. 타입 정의 (`packages/core/src/types.ts`)
```typescript
// 핵심 타입들 먼저 정의
type TaskType = 'design' | 'implement' | 'review' | 'scaffold' | 'research' | 'docs'
type AgentType = 'claude' | 'codex' | 'gemini'
type TaskStatus = 'pending' | 'running' | 'waiting' | 'complete' | 'error'
type AgentStatus = 'idle' | 'running' | 'waiting' | 'complete' | 'error'

interface Task {
  id: string
  type: TaskType
  prompt: string
  dependsOn: string[]
  assignedAgent: AgentType
  status: TaskStatus
  output?: string
  error?: string
  startedAt?: number
  completedAt?: number
}

interface Workflow {
  id: string
  prompt: string
  template: string
  tasks: Task[]
  status: 'planning' | 'running' | 'complete' | 'error'
  createdAt: number
}

interface MixerConfig {
  decomposer: AgentType
  maxAgents: number
  timeout: number
  autoApprove: boolean
}

interface RoutingRules {
  [key in TaskType]: AgentType
}

interface DoctorResult {
  node: { installed: boolean; version?: string }
  git: { installed: boolean; version?: string }
  claude: { installed: boolean; version?: string; authenticated: boolean }
  codex: { installed: boolean; version?: string; authenticated: boolean }
  gemini: { installed: boolean; version?: string; authenticated: boolean }
  availableTemplates: string[]
}
```

### 0-4. 설정 파일들
- `config/default-routing.json` — 기본 라우팅 규칙
- `config/templates/*.json` — 워크플로우 템플릿 5종
- `.gitignore` — `.mixer/`, `node_modules/`, `.next/`

---

## Phase 1 (Sprint 1): 대시보드 + 로그 스트리밍

> 목표: `npx llmmixer` → 브라우저 열림 → Claude 에이전트 하나 실행 → stdout 실시간 표시

### 1-1. CLI 엔트리포인트 (`bin/llmmixer.ts`)
- `llmmixer` — 기본: 대시보드 서버 시작 + 브라우저 오픈
- `llmmixer doctor` — 환경 진단
- `llmmixer nuke` — 전체 정리
- 서버 시작 시 세션 토큰 생성, `.mixer/` 디렉토리 초기화
- `open http://localhost:3333?token=xxx` 자동 실행

### 1-2. AgentAdapter 추상 클래스 (`core/src/adapters/base.ts`)
```typescript
abstract class AgentAdapter {
  abstract name: AgentType
  abstract spawn(prompt: string, options: SpawnOptions): void
  abstract sendInput(text: string): void
  abstract kill(): void
  abstract isInstalled(): Promise<boolean>
  abstract getVersion(): Promise<string | null>

  // 공통 구현
  onOutput(callback: (data: string) => void): void
  onWaiting(callback: (pattern: string) => void): void
  onComplete(callback: (exitCode: number) => void): void
  getStatus(): AgentStatus

  // 내부
  protected proc: ChildProcess | null
  protected status: AgentStatus
  protected waitingPatterns: RegExp[]  // 어댑터별 오버라이드
}
```

### 1-3. Claude 어댑터 (`core/src/adapters/claude.ts`)
- `spawn()`: `child_process.spawn('claude', [], { cwd: worktreePath })`
- stdin으로 프롬프트 전달
- stdout 파싱: 승인 패턴 감지
  - `"Do you want to"`, `"Allow"`, `"[y/n]"`, `"Press enter"` 등
- 승인 감지 시 상태 → `waiting`, 콜백 호출
- `sendInput()`: stdin.write(text + '\n')
- `kill()`: proc.kill('SIGTERM')
- `isInstalled()`: `which claude` 체크
- autoApprove 모드: 감지 즉시 "y" 자동 전달

### 1-4. SessionManager (`core/src/session-manager.ts`)
- `startSession(task, adapter)` — 어댑터로 에이전트 spawn
- `sessions: Map<taskId, SessionInfo>` — 활성 세션 추적
- stdout 데이터 → EventEmitter로 브로드캐스트 (`session:output`, `session:status`)
- 세션 상태를 `.mixer/state.json`에 주기적 저장 (debounced, 500ms)
- `approveSession(taskId, input)` — waiting 세션에 입력 전달
- `killSession(taskId)` — 단일 세션 종료
- `killAll()` — nuke

### 1-5. 대시보드 서버 — API Routes

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/sse` | SSE 스트리밍 (에이전트 로그 + 상태) |
| POST | `/api/sessions` | 새 세션 시작 (prompt + agent) |
| POST | `/api/approve` | 승인 입력 전달 |
| DELETE | `/api/sessions/[id]` | 세션 종료 |
| POST | `/api/nuke` | 전체 종료 |
| GET | `/api/doctor` | 환경 진단 |
| GET | `/api/config` | 설정 조회 |
| PUT | `/api/config` | 설정 변경 |

**SSE 구조:**
```typescript
// 이벤트 타입
type SSEEvent =
  | { type: 'output'; taskId: string; data: string }      // stdout 라인
  | { type: 'status'; taskId: string; status: TaskStatus } // 상태 변경
  | { type: 'waiting'; taskId: string; pattern: string }   // 승인 대기
  | { type: 'workflow'; workflow: Workflow }                // 워크플로우 전체 상태
```

### 1-6. 대시보드 UI — Log 탭
- **레이아웃:** 좌측 에이전트 목록 (탭) + 우측 로그 뷰어
- **로그 뷰어:**
  - SSE 연결로 실시간 수신
  - ANSI 컬러 파싱 (기본 색상만, xterm.js 안 씀)
  - 자동 스크롤 (하단 고정) + 수동 스크롤 시 잠금 + "맨 아래로" 버튼
  - 로그 라인 최대 5000개 유지 (오래된 것 제거)
- **승인 배너 (`ApprovalBanner.tsx`):**
  - 에이전트가 `waiting` 상태일 때 로그 뷰어 상단에 노란색 배너
  - 감지된 승인 메시지 표시
  - 입력 필드 + "Approve" / "Deny" 버튼 + 커스텀 입력
  - "Auto-approve" 토글 (에이전트별)
- **프롬프트 입력 (`PromptInput.tsx`):**
  - 하단 고정. 텍스트 입력 + 에이전트 선택(드롭다운) + "Run" 버튼
  - Sprint 1에서는 단일 에이전트 실행만 지원

### 1-7. 세션 토큰 (`core/src/auth.ts`)
- 서버 시작 시 `crypto.randomUUID()` 생성
- `.mixer/session-token` 파일에 저장
- 모든 쓰기 API에 `Authorization: Bearer <token>` 또는 query param 검증
- 대시보드 첫 로드 시 URL의 token을 localStorage에 저장

### 1-8. Sprint 1 완료 기준
- [ ] `npx llmmixer` → localhost:3333 열림
- [ ] 프롬프트 입력 → Claude 에이전트 spawn → stdout 실시간 표시
- [ ] 승인 대기 감지 → 노란색 배너 → 입력 전달 → 재개
- [ ] 자동 승인 토글 동작
- [ ] 에이전트 수동 종료 가능
- [ ] 세션 토큰 검증 동작

---

## Phase 2 (Sprint 2): 태스크 분해 + 라우팅 + DAG

> 목표: 프롬프트 하나 → LLM이 태스크 분해 → 여러 에이전트 병렬 실행 → Flow 탭 DAG

### 2-1. Decomposer (`core/src/decomposer.ts`)
- `decompose(prompt, context, config)` → `Task[]`
- 분해용 LLM 호출 (config.decomposer로 선택된 에이전트 사용)
- **호출 방식:** 선택된 에이전트의 CLI를 `-p` (일회성) 모드로 호출
  - Claude: `claude -p "...분해 프롬프트..."`
  - Codex: `codex -q "...분해 프롬프트..."`
  - Gemini: `gemini -p "...분해 프롬프트..."`
- 분해 프롬프트 템플릿:
  ```
  다음 프롬프트를 분석해서 태스크 목록을 JSON으로 만들어라.
  각 태스크에 type(design/implement/research/review/docs/scaffold)을 지정하라.
  의존관계가 있으면 depends_on에 명시하라.
  병렬 가능한 태스크는 depends_on을 비워라.

  프롬프트: {userPrompt}
  프로젝트 컨텍스트: {repoContext}

  JSON만 응답하라. 설명 불필요.
  ```
- JSON 파싱 + 유효성 검증 (type, depends_on 참조 무결성)
- 실패 시 재시도 1회, 그래도 실패 시 에러 반환

### 2-2. Repo-Aware Context (`core/src/context.ts`)
- `collectContext(projectPath)` → `string`
- 수집 항목:
  - `git branch --show-current`
  - `git log --oneline -5`
  - `git diff --name-only`
  - README.md 내용 (있으면, 처음 100줄)
  - package.json 내용 (있으면)
  - 프로젝트 구조 (`find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | head -50`)
- 전체 컨텍스트를 하나의 문자열로 포매팅

### 2-3. Router (`core/src/router.ts`)
- `route(tasks, routingRules)` → `Task[]` (각 태스크에 assignedAgent 할당)
- `.mixer/routing.json` 로드 (없으면 `config/default-routing.json` 폴백)
- 할당된 에이전트가 설치 안 된 경우 → 다음 우선순위 에이전트로 폴백
  - implement: codex → claude → gemini
  - design: claude → gemini → codex
  - research: gemini → claude → codex
  - 등
- 워크플로우 템플릿 지원: template 파라미터로 태스크 목록 직접 지정 가능 (LLM 분해 스킵)

### 2-4. WorkflowEngine (`core/src/workflow-engine.ts`)
- `start(prompt, template, config)` — 워크플로우 시작
  1. template이 'auto'이면 → Decomposer로 분해
  2. 아니면 → 템플릿 JSON에서 태스크 로드 + 유저 프롬프트 주입
  3. Router로 에이전트 할당
  4. 의존관계 그래프(DAG) 구축
  5. 실행 시작
- **의존관계 스케줄링:**
  - `depends_on`이 빈 태스크 → 즉시 실행 (maxAgents 제한 내)
  - 선행 태스크 완료 시 → 대기 중인 후속 태스크 검사 → 조건 충족 시 실행
  - 선행 태스크 에러 시 → 후속 태스크도 에러 (cascade)
- **동시 실행 제한:** maxAgents 초과 시 큐에 대기
- 상태 변경마다 `.mixer/state.json` 업데이트 + SSE 브로드캐스트

### 2-5. Codex 어댑터 (`core/src/adapters/codex.ts`)
- `spawn()`: `child_process.spawn('codex', [], { cwd: worktreePath })`
- 승인 패턴: Codex 고유 패턴 (TBD — 실제 CLI 출력 보고 조정)
- `isInstalled()`: `which codex` 체크

### 2-6. Gemini 어댑터 (`core/src/adapters/gemini.ts`)
- `spawn()`: `child_process.spawn('gemini', [], { cwd: worktreePath })`
- 승인 패턴: Gemini 고유 패턴 (TBD)
- `isInstalled()`: `which gemini` 체크

### 2-7. Flow 탭 (`FlowTab.tsx`)
- **DAG 시각화:** 태스크를 노드, depends_on을 엣지로 표시
- **렌더링:** Canvas 또는 SVG 직접 렌더링 (외부 라이브러리 최소화)
  - 노드: 라운드 사각형. 에이전트 아이콘 + 태스크 타입 + 상태 색상
  - 상태 색상: pending(gray) → running(blue, pulse) → waiting(yellow) → complete(green) → error(red)
  - 엣지: 직선 또는 곡선 화살표
- **레이아웃:** 좌→우 방향. 같은 depth의 노드는 세로 정렬 (topological sort 기반)
- **인터랙션:**
  - 노드 클릭 → 해당 에이전트의 Log 탭으로 전환
  - 노드 호버 → 툴팁 (프롬프트 요약, 시작/완료 시간)
- **실시간 업데이트:** SSE의 workflow 이벤트로 상태 갱신

### 2-8. 프롬프트 입력 개선 (`PromptInput.tsx`)
- 텍스트 입력 + 템플릿 선택 (full/quick/review/docs/auto) + "Run" 버튼
- auto 선택 시 → 분해 과정을 Flow 탭에서 실시간 표시 (planning 상태)
- 분해 완료 → 유저에게 태스크 목록 미리보기 → "Start" 확인 → 실행

### 2-9. Sprint 2 완료 기준
- [ ] 프롬프트 입력 + 템플릿 선택 → 태스크 분해 결과 표시
- [ ] 태스크별 에이전트 자동 라우팅
- [ ] 의존관계에 따른 순차/병렬 실행
- [ ] Flow 탭에서 DAG 시각화 + 실시간 상태
- [ ] 3종 어댑터(Claude/Codex/Gemini) 동작
- [ ] maxAgents 제한 동작

---

## Phase 3 (Sprint 3): doctor + worktree + 머지

> 목표: 온보딩 완성 + 결과물을 실제 프로젝트에 적용

### 3-1. Doctor (`core/src/doctor.ts`)
- `runDoctor()` → `DoctorResult`
- 체크 항목:
  - Node.js: `node --version`
  - git: `git --version`
  - Claude: `claude --version` + 인증 상태 (claude 실행 시 에러 여부)
  - Codex: `codex --version`
  - Gemini: `gemini --version`
- 결과에서 사용 가능한 템플릿 계산
- CLI 모드: `npx llmmixer doctor` → 터미널에 체크리스트 출력

### 3-2. Worktree 관리 (`core/src/worktree.ts`)
- `createWorktree(taskId, baseBranch)` → worktree 경로
  - `git worktree add .mixer/agents/{taskId} -b mixer/{taskId}`
  - 기존 브랜치가 있으면 재사용
- `removeWorktree(taskId)`
  - `git worktree remove .mixer/agents/{taskId}`
  - 브랜치 정리 옵션
- `mergeWorktree(taskId, targetBranch)`
  - `git merge mixer/{taskId}` (targetBranch 위에서)
  - 충돌 시 에러 반환 (대시보드에서 수동 해결 안내)
- `nukeWorktrees()`
  - 모든 .mixer/agents/* worktree 제거
  - 관련 브랜치 정리
- **에이전트 spawn 시 worktree 경로를 cwd로 전달**

### 3-3. Setup 탭 (`SetupTab.tsx`)
- **Doctor 결과:** API 호출 → 체크리스트 UI (✓/✗ + 버전)
- **라우팅 규칙 편집:** 태스크 유형별 에이전트 드롭다운
- **설정 편집:**
  - 분해용 LLM 선택
  - max_agents 슬라이더
  - 타임아웃 입력
  - 자동 승인 글로벌 토글
- **Nuke 버튼:** 확인 다이얼로그 → POST /api/nuke

### 3-4. Results 탭 (`ResultsTab.tsx`)
- 완료된 태스크 목록 (카드 형태)
- 각 카드:
  - 태스크 정보 (type, agent, 소요 시간)
  - 출력 텍스트 (collapsible)
  - 파일 변경이 있으면 diff 뷰 (`git diff` 결과를 파싱해서 표시)
  - "Copy" 버튼 (클립보드)
  - "Merge" 버튼 → POST /api/merge → 결과 표시
- 전체 워크플로우 요약 (총 소요 시간, 성공/실패 수)

### 3-5. Merge API (`/api/merge`)
- worktree의 변경사항을 메인 브랜치에 머지
- 충돌 감지 시 충돌 파일 목록 반환
- 성공 시 worktree 정리

### 3-6. Nuke (`/api/nuke` + CLI)
1. 모든 에이전트 프로세스 kill
2. 모든 worktree 제거
3. `.mixer/state.json` 초기화
4. 확인 메시지 반환

### 3-7. 타임아웃 처리
- 에이전트별 타이머 시작 (config.timeout)
- `waiting` 상태에서 타임아웃 → 대시보드 알림 (빨간색 배너)
- `running` 상태에서 타임아웃 → 자동 kill + error 상태
- 타임아웃 연장 버튼 (대시보드)

### 3-8. Sprint 3 완료 기준
- [ ] `npx llmmixer doctor` → CLI + 대시보드 모두 동작
- [ ] 에이전트가 worktree에서 격리 실행
- [ ] Results 탭에서 diff 확인 + Merge 동작
- [ ] Nuke (CLI + 대시보드) 동작
- [ ] Setup 탭에서 설정 변경 → 즉시 반영
- [ ] 타임아웃 알림 동작

---

## 구현 순서 (파일 단위)

전체 흐름: 타입 → 코어 유틸 → 어댑터 → 세션매니저 → 서버 → UI 순.

### Phase 0 (Day 1)
1. `package.json` (루트 + packages) + `tsconfig.json`
2. `packages/core/src/types.ts`
3. `config/default-routing.json` + `config/templates/*.json`
4. `.gitignore`, `CLAUDE.md`
5. Next.js 프로젝트 초기화 (`packages/dashboard`)

### Phase 1 (Day 2-4)
6. `packages/core/src/auth.ts` — 세션 토큰
7. `packages/core/src/adapters/base.ts` — 추상 클래스
8. `packages/core/src/adapters/claude.ts` — Claude 어댑터
9. `packages/core/src/session-manager.ts` — 세션 관리
10. `packages/dashboard/src/app/api/sse/route.ts` — SSE
11. `packages/dashboard/src/app/api/sessions/route.ts` — 세션 API
12. `packages/dashboard/src/app/api/approve/route.ts` — 승인 API
13. `packages/dashboard/src/app/components/LogTab.tsx` — 로그 UI
14. `packages/dashboard/src/app/components/ApprovalBanner.tsx` — 승인 UI
15. `packages/dashboard/src/app/components/PromptInput.tsx` — 입력 UI
16. `packages/dashboard/src/app/components/Dashboard.tsx` — 탭 컨테이너
17. `packages/dashboard/src/app/page.tsx` + `layout.tsx`
18. `bin/llmmixer.ts` — CLI 엔트리

### Phase 2 (Day 5-7)
19. `packages/core/src/context.ts` — repo context
20. `packages/core/src/decomposer.ts` — 태스크 분해
21. `packages/core/src/router.ts` — 라우팅
22. `packages/core/src/workflow-engine.ts` — 워크플로우 엔진
23. `packages/core/src/adapters/codex.ts` — Codex 어댑터
24. `packages/core/src/adapters/gemini.ts` — Gemini 어댑터
25. `packages/dashboard/src/app/api/decompose/route.ts` — 분해 API
26. `packages/dashboard/src/app/components/FlowTab.tsx` — DAG
27. `packages/dashboard/src/app/components/DagGraph.tsx` — DAG 렌더링
28. PromptInput 개선 (템플릿 선택, 미리보기)

### Phase 3 (Day 8-10)
29. `packages/core/src/doctor.ts` — 환경 진단
30. `packages/core/src/worktree.ts` — worktree 관리
31. `packages/dashboard/src/app/api/doctor/route.ts`
32. `packages/dashboard/src/app/api/merge/route.ts`
33. `packages/dashboard/src/app/api/nuke/route.ts`
34. `packages/dashboard/src/app/api/config/route.ts`
35. `packages/dashboard/src/app/components/SetupTab.tsx`
36. `packages/dashboard/src/app/components/ResultsTab.tsx`
37. CLI doctor/nuke 커맨드 추가
38. 타임아웃 로직 추가

---

## 리스크 & 대응

| 리스크 | 대응 |
|--------|------|
| 각 CLI의 대화형 모드 stdin/stdout 인터페이스가 다를 수 있음 | 어댑터별 실제 테스트 후 패턴 조정. 승인 패턴을 config로 추출 |
| CLI가 raw 터미널 모드 사용 시 child_process stdin이 안 먹힘 | `{ stdio: ['pipe', 'pipe', 'pipe'] }` + PTY 라이브러리(node-pty) 폴백 검토 |
| SSE 연결이 브라우저 탭 비활성 시 끊길 수 있음 | 자동 재연결 + 재연결 시 state.json에서 현재 상태 복원 |
| LLM 분해 결과가 일관적이지 않을 수 있음 | JSON 스키마 명시 + 유효성 검증 + 재시도 + 수동 편집 옵션 |
| git worktree 충돌 | 머지 전 dry-run (`git merge --no-commit --no-ff`) + 충돌 파일 목록 표시 |

---

## 테스트 전략

- **Unit:** core 모듈별 (decomposer JSON 파싱, router 매핑, worktree 명령어)
- **Integration:** 어댑터 spawn → stdout 수신 → 승인 패턴 감지 (mock child_process)
- **E2E:** 실제 CLI로 워크플로우 실행 (CI에서는 mock, 로컬에서 실제)
- 테스트 프레임워크: vitest
