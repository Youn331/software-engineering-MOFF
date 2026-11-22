# software-engineering-MOFF
소프트웨어공학 MOFF 프로젝트

## MOFF 실행 프로젝트

React와 Express를 같은 주소에서 제공합니다. 브라우저는 상대 경로 /api를 사용합니다. client/src는 화면, server/기능은 계정·디자인·장바구니·주문 처리, server/service.ts는 관리·문의·배송지·가격 검증, server/google.ts는 Google 로그인, db는 PostgreSQL 마이그레이션입니다.

Node 22 이상에서 npm ci --include=dev 후 .env.example을 .env로 복사하고 DATABASE_URL과 SESSION_SECRET을 설정합니다. npm run db:migrate, npm run build, npm start 순서로 실행합니다. GET /health는 PostgreSQL 접속까지 확인합니다.

Render는 Singapore, Node, 루트 디렉터리 공란, Build Command는 npm ci --include=dev && npm run build, Start Command는 npm run db:migrate && npm start입니다. 기존 moff-db의 내부 주소를 DATABASE_URL에 사용합니다. SESSION_SECRET은 Render에서 생성하고 NODE_ENV는 production으로 설정합니다. SEED_DEMO_CATALOG=true는 과제용 예시 재료만 최초 등록합니다. PAYMENT_MODE=demo일 때 주문 상태는 DEMO_CONFIRMED, 결제 기록은 MOCK/SIMULATED입니다. 기본값에서는 결제를 차단합니다. 실결제 승인은 구현 전입니다.

Google 로그인은 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI(서비스 주소의 /api/auth/google/callback)를 등록한 후 /api/auth/google에서 시작합니다. 이메일 로그인도 제공합니다. 관리자 API는 DB의 ADMIN 역할을 서버에서 확인합니다. 공개 회원가입은 CUSTOMER만 생성합니다.

서버가 계산한 꽃·포장·리본 가격과 크기 추가금을 합산하며 배송비는 주문 단위로 적용합니다. 장바구니 및 주문 구성과 배송 주소는 JSONB로 보존합니다. 가격과 재고는 catalog, 재고 증감 기록은 inventory_logs, 주문 상태 이력은 order_status_history에 저장합니다. FAQ 분류는 category 필드입니다. Google 실계정·실결제·택배사 추적과 별도 관리자 화면은 검증 범위 밖입니다.

API 요청 목록은 API.md를 참고하세요. GET /api/catalog는 품절 여부와 태그를 반환하고 정확한 재고 수량은 관리자 전용입니다. POST /api/designs/quote는 디자인 객체를 받아 amount를 반환합니다. 세션 쿠키를 공유하는 같은 출처에서 로그인 후 요청하세요. API 실패는 error 필드로 전달합니다.

자동 검증은 GitHub Actions의 일회용 DB에서 수행합니다. 로컬 통합 검증도 별도 테스트 DB에서 실행하세요. npm test는 재고 제약을, node --import tsx server/flow-smoke.ts는 실제 HTTP 주문과 DB 반영을 확인합니다.
