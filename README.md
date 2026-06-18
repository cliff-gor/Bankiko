# Bankiko — SACCO Wallet Platform

A production-grade SACCO/Chama wallet backend built with Spring Boot 3 and Apache Fineract. Members can deposit via M-Pesa, contribute to shared group pools, and apply for loans from the group lending fund — all backed by a real core banking engine.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [How the Layers Work Together](#how-the-layers-work-together)
- [Money Flow Diagrams](#money-flow-diagrams)
- [Module Breakdown](#module-breakdown)
- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Fineract Setup](#fineract-setup)
- [M-Pesa Daraja Setup](#m-pesa-daraja-setup)
- [Production Checklist](#production-checklist)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Mobile App / Web Frontend                         │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  REST / JSON  (JWT Bearer token)
┌───────────────────────────▼──────────────────────────────────────────┐
│                  Bankiko API  (Spring Boot 3 / Java 17)              │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
│  │   auth   │  │  member  │  │  group   │  │    contribution      │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────────────────┐ │
│  │  wallet  │  │   loan   │  │     mpesa (STK Push / B2C)         │ │
│  └──────────┘  └──────────┘  └────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │         fineract (shared WebClient — all banking calls)         │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────┬───────────────────────┬─────────────────────────┘
                     │                       │
         ┌───────────▼──────────┐  ┌─────────▼───────────────┐
         │   Apache Fineract    │  │  Safaricom Daraja API    │
         │  (Core Banking)      │  │  (M-Pesa STK / B2C)     │
         └───────────┬──────────┘  └─────────────────────────┘
                     │
         ┌───────────▼──────────┐
         │  MySQL (Fineract DB) │
         └──────────────────────┘

Supporting Infrastructure:
  PostgreSQL  — Bankiko's own metadata DB (users, groups, M-Pesa transactions)
  Redis       — Token cache, Daraja OAuth token cache, Spring Cache
  Docker      — All services run via Docker Compose locally
```

### Design Philosophy

**Bankiko is an orchestration layer, not a bank.** Apache Fineract is the bank — it manages clients, savings products, loan products, and the transaction ledger. Bankiko adds:

- Clean REST API for mobile/web clients
- M-Pesa integration (deposits, contributions, remittances)
- Group and membership management (not in Fineract)
- Authentication (JWT)
- Notifications (Africa's Talking SMS)

The rule is: financial state lives in Fineract. Operational metadata (who is in which group, M-Pesa callback tracking, contribution schedules) lives in our PostgreSQL.

---

## How the Layers Work Together

### Registration → Onboarding → First Deposit

```
1. POST /api/auth/register      → Creates User in PostgreSQL, returns JWT
2. POST /api/members/onboard    → Creates Fineract Client + opens Savings Account
3. POST /api/wallet/deposit     → STK push to member's phone
4. [M-Pesa callback arrives]    → POST /api/mpesa/callback/stk
5. Callback handler             → Credits Fineract savings account
6. SMS sent                     → "KES 500 deposited to your wallet"
```

### Group Contribution Flow

```
1. Admin creates group          → POST /api/groups (opens Fineract group savings account)
2. Admin adds member            → POST /api/groups/{id}/members/{userId}
3. Member contributes           → POST /api/groups/{id}/contributions (STK push)
4. [M-Pesa callback arrives]    → Credits group's Fineract savings account
5. Contribution recorded        → contributions table (YYYY-MM unique constraint)
```

### Loan Flow

```
1. Member applies               → POST /api/loans (Fineract loan application)
2. Admin approves+disburses     → POST /api/loans/{id}/disburse
3. Fineract disbursement        → B2C payout to member's M-Pesa
4. Member repays                → POST /api/loans/{id}/repay (Fineract repayment)
```

---

## Money Flow Diagrams

### Deposit (STK Push → Fineract Credit)

```
Member Phone
     │
     │  (1) POST /api/wallet/deposit {amount, phone}
     ▼
Bankiko API ──────────────────────────────────► Daraja STK Push API
     │                                               │
     │  Returns 202 Accepted (pending tx)            │ (2) STK prompt on phone
     ◄──────────────────────────────────────────────►│
                                                     │
                                                     │ (3) Member approves
                                                     │
Bankiko API ◄──────────────────────────────────── Daraja Callback
     │  POST /api/mpesa/callback/stk
     │
     │ (4) Update MpesaTransaction → SUCCESS
     │ (5) POST /fineract/savingsaccounts/{id}/transactions?command=deposit
     ▼
Apache Fineract (savings account credited)
     │
     │ (6) SMS: "KES 500 deposited"
     ▼
Africa's Talking SMS
```

### Withdrawal (Fineract Debit → B2C Payout)

```
Member
     │
     │ (1) POST /api/wallet/withdraw {amount, phone}
     ▼
Bankiko API
     │ (2) Check balance via Fineract
     │ (3) POST Fineract withdrawal (debit)
     │ (4) POST Daraja B2C payout
     ▼
Member's M-Pesa (money arrives)
```

> **Important:** Fineract is debited before M-Pesa is called. If M-Pesa fails after the Fineract debit, the transaction is flagged for manual reconciliation. In production, wrap this in the outbox pattern.

---

## Module Breakdown

### `auth`
JWT authentication. Access token (15 min) + refresh token (7 days, stored in PostgreSQL for revocation). BCrypt strength 12 for password hashing.

Key classes:
- `JwtService` — generates and validates JWTs
- `AuthService` — register, login, refresh, logout
- `JwtAuthFilter` — `OncePerRequestFilter` that validates the Bearer token

### `member`
Bridges a `User` (our DB) with a Fineract `Client`. When a user onboards, this module creates the Fineract client record and opens their individual savings account (wallet). Until onboarding is complete, the user cannot make transactions.

### `group`
SACCO group management. Each group has one Fineract savings account (the group lending pool). The creator is automatically the group ADMIN. Admins add members, approve loans, and manage group settings.

### `wallet`
Individual member wallet operations. Wraps Fineract savings account calls:
- Balance enquiry
- Deposit initiation (STK push)
- Withdrawal (Fineract debit + B2C)
- M-Pesa callback processing (routes to Fineract credit)

### `contribution`
Tracks monthly contributions per member per group. Enforces one contribution per month via a unique constraint on `(member_id, group_id, contribution_month)`. Each contribution credits the group's Fineract savings account.

### `loan`
SACCO lending. Members apply for loans from the group pool. Group admins approve and disburse. Disbursement sends funds via B2C to the member's M-Pesa. Repayments are recorded in Fineract.

### `mpesa`
M-Pesa Daraja integration:
- `DarajaTokenService` — fetches and caches the OAuth token (evicted every 58 minutes)
- `StkPushService` — STK push initiation + callback handling
- `B2CService` — B2C payouts for withdrawals and loan disbursements
- `MpesaCallbackController` — public endpoint that receives Safaricom callbacks

### `fineract`
Single integration point for all Fineract API calls. No other module holds a direct `WebClient` reference for Fineract — everything goes through `FineractClient`. This makes it easy to mock in tests and to update the API version.

### `notification`
Async SMS via Africa's Talking. All sends are `@Async` — they never block a financial transaction. If the AT API key is missing (local dev), messages are logged instead.

### `common`
- `SecurityConfig` — Spring Security filter chain
- `BankikoProperties` — typed config for all external integrations
- `GlobalExceptionHandler` — RFC 7807 ProblemDetail error responses
- `OutboxEvent` — transactional outbox for reliable downstream calls
- `RedisConfig` — cache manager and template configuration

---

## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Language | Java 17 | LTS, record types, pattern matching |
| Framework | Spring Boot 3.3.x | Auto-configuration, production-ready |
| Core Banking | Apache Fineract 1.9 | Open-source banking engine, manages ledger |
| API | Spring MVC REST | Standard, well-tooled |
| Auth | Spring Security + JJWT | Stateless JWT, BCrypt passwords |
| Database (app) | PostgreSQL 16 | ACID, JSONB, robust |
| Database (Fineract) | MySQL 8 | Fineract's required DB |
| Migrations | Flyway | Versioned, checksummed migrations |
| ORM | Spring Data JPA / Hibernate | Type-safe queries, auditing |
| Cache | Redis 7 | Token cache, Daraja OAuth token |
| HTTP Client | Spring WebFlux WebClient | Non-blocking Fineract + Daraja calls |
| Payment | Safaricom Daraja API | M-Pesa STK Push (C2B) + B2C |
| SMS | Africa's Talking | Kenyan SMS gateway |
| API Docs | SpringDoc OpenAPI 3 | Swagger UI auto-generated |
| Metrics | Micrometer + Prometheus | Actuator + scrape endpoint |
| Containers | Docker + Docker Compose | Local dev, CI/CD |
| Build | Maven 3.9 | Dependency management, lifecycle |

---

## Database Schema

Bankiko maintains two databases:

### PostgreSQL (Bankiko's DB)
Stores operational metadata — not financial ledger data (that's in Fineract/MySQL).

```
users                   — login credentials, phone, role
refresh_tokens          — server-side token store for revocation
members                 — user ↔ Fineract client + savings account link
sacco_groups            — group metadata + Fineract group pool account ID
group_members           — member ↔ group relationship + role (MEMBER, ADMIN)
contributions           — one record per member per group per month
mpesa_transactions      — STK push / B2C tracking, idempotency
outbox_events           — transactional outbox for reliable Fineract/M-Pesa calls
```

### MySQL (Fineract's DB)
Managed entirely by Fineract. Contains the financial ledger:
- `m_client` — client records
- `m_savings_account` — savings accounts
- `m_savings_account_transaction` — all deposits and withdrawals
- `m_loan` — loan accounts
- `m_loan_transaction` — repayments, disbursements

---

## API Reference

After starting the application, visit:
- Swagger UI: http://localhost:8080/swagger-ui.html
- OpenAPI JSON: http://localhost:8080/api-docs

### Quick Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| POST | `/api/members/onboard` | Onboard user into Fineract |
| GET  | `/api/members/me` | Get member profile |
| POST | `/api/groups` | Create SACCO group |
| GET  | `/api/groups` | List my groups |
| GET  | `/api/groups/{id}` | Get group details |
| POST | `/api/groups/{id}/members/{userId}` | Add member to group |
| GET  | `/api/wallet/balance` | Get wallet balance |
| POST | `/api/wallet/deposit` | Deposit via M-Pesa STK push |
| POST | `/api/wallet/withdraw` | Withdraw to M-Pesa |
| POST | `/api/groups/{id}/contributions` | Contribute to group pool |
| GET  | `/api/groups/{id}/contributions` | List group contributions |
| GET  | `/api/groups/{id}/contributions/mine` | My contributions in group |
| POST | `/api/loans` | Apply for a loan |
| POST | `/api/loans/{id}/disburse` | Approve + disburse loan (admin) |
| POST | `/api/loans/{id}/repay` | Repay loan |
| POST | `/api/mpesa/callback/stk` | M-Pesa STK callback (Safaricom only) |
| POST | `/api/mpesa/callback/b2c` | M-Pesa B2C result callback |

---

## Getting Started

### Prerequisites
- Docker and Docker Compose
- A Safaricom Daraja account (sandbox at developer.safaricom.co.ke)
- An Africa's Talking account (sandbox available)

### 1. Clone and configure

```bash
git clone <repo>
cd bankiko
cp .env.example .env
# Edit .env with your Daraja and Africa's Talking credentials
```

### 2. Start all services

```bash
docker compose up --build
```

This starts:
- **PostgreSQL** on port 5432
- **MySQL** on port 3306 (for Fineract)
- **Apache Fineract** on port 8443
- **Redis** on port 6379
- **Bankiko API** on port 8080

Fineract takes ~2 minutes to fully initialize on first start.

### 3. Set up Fineract products

Before members can open accounts, create savings and loan products in Fineract:

```bash
# Create savings product for individual wallets (productId=1)
curl -X POST http://localhost:8443/fineract-provider/api/v1/savingsproducts \
  -H "Fineract-Platform-TenantId: default" \
  -u mifos:password \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Member Wallet",
    "shortName": "MWLT",
    "description": "Individual member savings wallet",
    "currencyCode": "KES",
    "digitsAfterDecimal": 2,
    "nominalAnnualInterestRate": 0,
    "interestCompoundingPeriodType": 1,
    "interestPostingPeriodType": 4,
    "interestCalculationType": 1,
    "interestCalculationDaysInYearType": 365,
    "accountingRule": 1,
    "locale": "en",
    "dateFormat": "dd MMMM yyyy"
  }'

# Create savings product for group pool (productId=2)
curl -X POST http://localhost:8443/fineract-provider/api/v1/savingsproducts \
  -H "Fineract-Platform-TenantId: default" \
  -u mifos:password \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Group Fund",
    "shortName": "GRPF",
    "description": "Shared group lending pool",
    "currencyCode": "KES",
    "digitsAfterDecimal": 2,
    "nominalAnnualInterestRate": 0,
    "interestCompoundingPeriodType": 1,
    "interestPostingPeriodType": 4,
    "interestCalculationType": 1,
    "interestCalculationDaysInYearType": 365,
    "accountingRule": 1,
    "locale": "en",
    "dateFormat": "dd MMMM yyyy"
  }'
```

### 4. Test the flow

```bash
# Register
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Jane Doe","email":"jane@example.com","phone":"0712345678","password":"password123"}'

# Onboard (use the accessToken from register response)
curl -X POST http://localhost:8080/api/members/onboard \
  -H "Authorization: Bearer <accessToken>"

# Get wallet balance
curl http://localhost:8080/api/wallet/balance \
  -H "Authorization: Bearer <accessToken>"
```

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DB_URL` | PostgreSQL JDBC URL | Yes |
| `DB_USERNAME` | PostgreSQL username | Yes |
| `DB_PASSWORD` | PostgreSQL password | Yes |
| `REDIS_HOST` | Redis host | Yes |
| `REDIS_PASSWORD` | Redis password | Yes |
| `FINERACT_BASE_URL` | Fineract API base URL | Yes |
| `FINERACT_USERNAME` | Fineract username (default: mifos) | Yes |
| `FINERACT_PASSWORD` | Fineract password (default: password) | Yes |
| `JWT_SECRET` | 256-bit JWT signing secret | Yes |
| `MPESA_CONSUMER_KEY` | Daraja app consumer key | Yes |
| `MPESA_CONSUMER_SECRET` | Daraja app consumer secret | Yes |
| `MPESA_SHORTCODE` | M-Pesa business shortcode | Yes |
| `MPESA_PASSKEY` | STK push passkey | Yes |
| `MPESA_CALLBACK_URL` | Public URL for Daraja callbacks | Yes |
| `MPESA_B2C_INITIATOR_NAME` | B2C initiator name | For withdrawals |
| `MPESA_B2C_SECURITY_CREDENTIAL` | B2C security credential | For withdrawals |
| `AT_API_KEY` | Africa's Talking API key | For SMS |
| `AT_USERNAME` | Africa's Talking username | For SMS |
| `AT_SENDER_ID` | SMS sender ID | For SMS |

---

## Fineract Setup

### Default credentials
- Username: `mifos`
- Password: `password`
- Tenant: `default`

### Product IDs
The application uses these Fineract product IDs (configurable in `application.yml`):

| Product | Default ID | Config Key |
|---|---|---|
| Member Wallet (savings) | 1 | `bankiko.fineract.wallet-product-id` |
| Group Fund (savings) | 2 | `bankiko.fineract.group-fund-product-id` |
| SACCO Loan | 1 | `bankiko.fineract.loan-product-id` |

Create these products in Fineract before onboarding members (see Getting Started above).

---

## M-Pesa Daraja Setup

### STK Push (C2B) — for deposits and contributions
1. Create a Daraja app at developer.safaricom.co.ke
2. Enable the **Lipa Na M-Pesa Online** API
3. Get your shortcode, consumer key, consumer secret, and passkey
4. Set `MPESA_CALLBACK_URL` to a publicly accessible URL (use ngrok for local testing)

### B2C — for withdrawals and loan disbursements
1. Enable the **B2C Payment** API on your Daraja app
2. Generate your B2C initiator credentials
3. Set `MPESA_B2C_INITIATOR_NAME` and `MPESA_B2C_SECURITY_CREDENTIAL`

### Sandbox vs Production
- Sandbox base URL: `https://sandbox.safaricom.co.ke`
- Production base URL: `https://api.safaricom.co.ke`
- Update `bankiko.mpesa.base-url` in config when going live

---

## Production Checklist

### Security
- [ ] `JWT_SECRET` is a random 256-bit value (not the default)
- [ ] All passwords rotated from defaults
- [ ] CORS `allowedOriginPatterns` locked to production domain
- [ ] Actuator endpoints secured (only `/health` public)
- [ ] HTTPS enforced on all external traffic
- [ ] M-Pesa callback endpoint IP-whitelisted to Safaricom IPs

### Database
- [ ] `spring.jpa.hibernate.ddl-auto=validate` (never `create`/`update` in prod)
- [ ] Flyway migrations reviewed before deploy
- [ ] PostgreSQL and MySQL on managed, backed-up instances
- [ ] Connection pool sized to match DB max connections

### Fineract
- [ ] Default `mifos/password` credentials changed
- [ ] Fineract running on HTTPS in production
- [ ] Savings and loan products created before go-live
- [ ] Office and chart of accounts configured

### Observability
- [ ] Prometheus scraping `/actuator/prometheus`
- [ ] Grafana dashboards for: JVM heap, DB pool, HTTP error rate, M-Pesa callback success rate
- [ ] Alerting on: 5xx error rate > 1%, DB pool exhaustion, M-Pesa callback failures

### Kubernetes (if deploying to K8s)
- [ ] Liveness probe: `GET /actuator/health/liveness`
- [ ] Readiness probe: `GET /actuator/health/readiness`
- [ ] Resources (CPU + memory) requests and limits set
- [ ] Secrets in Vault or Sealed Secrets (not plain K8s Secrets)
- [ ] HPA configured based on request rate

---

## Architecture Decisions

**Why a modular monolith instead of microservices?**
1,000 groups (~15,000 members) doesn't justify the operational overhead of microservices. A modular monolith with clean module boundaries is faster to develop, easier to operate, and can be split later if a specific module needs independent scaling.

**Why Fineract instead of building our own ledger?**
Financial ledgers are extraordinarily hard to get right — double-entry accounting, reconciliation, audit trails, regulatory compliance. Fineract has been battle-tested in production SACCO deployments across East Africa. We use it as the ledger and build our product layer on top.

**Why is Fineract debited before M-Pesa on withdrawals?**
If M-Pesa is called first and then Fineract debit fails, money leaves the system with no ledger record. The safer failure mode is: Fineract debited, M-Pesa fails → flag for reconciliation (no money lost from the system).

**Why Redis for the Daraja token?**
The Daraja OAuth token is valid for 60 minutes. Fetching it on every API call adds latency and risks rate-limiting. Redis caches it with an eviction at 58 minutes.

**Why Africa's Talking SMS is `@Async`?**
SMS delivery must never block or fail a financial transaction. If the AT API is down, the transaction still commits — the SMS is a notification, not a confirmation.
