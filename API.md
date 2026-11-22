# MOFF 서버 요청 목록

관리자 경로는 ADMIN 역할이 필요합니다.

## server / google.ts

- GET /api/auth/google
- GET /api/auth/google/callback

## server / index.ts

- GET /health

## server / service.ts

- PATCH /api/me
- GET /api/addresses
- POST /api/addresses
- DELETE /api/addresses/:id
- GET /api/sizes
- PUT /api/admin/sizes/:size
- GET /api/admin/catalog
- POST /api/admin/catalog
- PATCH /api/admin/catalog/:id
- POST /api/designs/quote
- POST /api/designs/:id/duplicate
- PATCH /api/cart/:id
- GET /api/admin/orders
- PATCH /api/admin/orders/:id/status
- GET /api/faqs
- PUT /api/admin/faqs/:id
- DELETE /api/admin/faqs/:id
- GET /api/inquiries
- POST /api/inquiries
- PATCH /api/admin/inquiries/:id/answer

## 디자인 보관함 / 요청.ts

- GET /api/designs
- POST /api/designs
- PUT /api/designs/:id
- POST /api/designs/bulk-delete
- DELETE /api/designs/:id

## 장바구니 / 요청.ts

- GET /api/cart
- POST /api/cart/bulk
- POST /api/cart
- DELETE /api/cart/:id

## 주문과 결제 / 요청.ts

- GET /api/orders
- POST /api/orders
- POST /api/orders/:id/cancel

## 회원과 꽃 재료 / 요청.ts

- GET /api/health
- GET /api/catalog
- GET /api/me
- POST /api/register
- POST /api/login
- POST /api/logout

