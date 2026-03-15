# LLMMixer

Multi-LLM 세션 매니저. 프롬프트 하나로 태스크를 분해하고 각 LLM에 자동 분배.

## 구조

- `packages/core` — 엔진 (TypeScript, Node.js 내장 모듈만)
- `packages/dashboard` — 웹 대시보드 (Next.js + Tailwind CSS v4)
- `config/` — 기본 라우팅, 워크플로우 템플릿
- `bin/` — CLI 엔트리포인트

## 개발

```bash
npm install
npm run dev          # 대시보드 dev 서버 (:3333)
npm run build:core   # core 빌드
```

## 규칙

- core 패키지에 외부 npm 의존성 추가 금지. Node.js 내장만 사용.
- 런타임 상태는 `.mixer/` 디렉토리에 JSON으로 저장.
- Tailwind CSS v4 사용 (postcss 플러그인 방식).
