# Bankiko — SACCO & Chama Wallet Platform

A full-stack monorepo for running digital savings groups in Kenya. Bankiko supports two distinct group models — **SACCO** (formal, share-capital based, regulated) and **Chama** (informal, contribution-based, immediate) — on a single platform. Every money movement goes through **Apache Fineract** (core banking) and **M-Pesa Daraja** (mobile money).

---

## SACCO vs Chama — What's the Difference?

Both group types allow members to pool money and borrow from the pool, but they operate under different rules:

| | SACCO | Chama |
|---|---|---|
| **Activation** | Requires admin approval | Active immediately on creation |
| **Share capital** | Members buy shares at a fixed price (e.g. KES 200/share) | No shares — all equity is equal |
| **Loan eligibility** | Shares × multiplier (e.g. 3×) caps the loan ceiling | Based on group contribution history |
| **Contribution requirement** | Minimum N months before first loan (configurable) | No minimum |
| **Interest** | Configurable — reducing balance or flat rate | Same |
| **Dividends** | Annual dividend declared proportional to shares held | No dividend cycle |
| **Compliance** | SASRA-reportable (monthly returns, capital adequacy) | Informal — no regulator |
| **Group treasury** | Fineract group savings account provisioned on approval | Provisioned on creation |

**The platform automatically applies the right rules** depending on which group type a member is interacting with. A single API, a single mobile app, two group identities.

---

## Monorepo Structure

```
Bankiko/
├── backend/                  Spring Boot 3.3.4 API (Java 17)
│   ├── src/main/java/ke/cliffgor/bankiko/
│   │   ├── auth/             JWT authentication
│   │   ├── member/           Fineract client + wallet onboarding
│   │   ├── group/            Group management (SACCO + Chama)
│   │   ├── wallet/           Individual wallet (deposit, withdraw, statement)
│   │   ├── contribution/     Monthly contribution tracking + enforcement
│   │   ├── loan/             Loan application, schedule, repayment, OVERDUE scheduler
│   │   ├── share/            Share capital — buy, register, loan ceiling
│   │   ├── dividend/         Annual dividend cycles + proportional allocation
│   │   ├── notification/     FCM push notifications + Africa's Talking SMS
│   │   ├── report/           PDF member statement + SASRA monthly returns
│   │   ├── mpesa/            M-Pesa STK Push (C2B) + B2C payouts
│   │   ├── fineract/         Core banking client (single WebClient)
│   │   └── common/           Security, config, exceptions, outbox
│   └── src/main/resources/db/migration/
│       ├── V1__init.sql
│       ├── V7__share_module.sql
│       ├── V8__loan_repayments.sql
│       ├── V9__config_and_device_tokens.sql
│       ├── V10__loan_interest.sql
│       └── V11__dividends.sql
├── frontend/                 Next.js 15 admin portal (shadcn/ui)
├── mobile/                   React Native Expo SDK 56 mobile app
├── docker-compose.yml
└── README.md
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│              Mobile App (Expo)  /  Admin Portal (Next.js)        │
└─────────────────────────┬────────────────────────────────────────┘
                          │  REST / JSON  (JWT Bearer)
┌─────────────────────────▼────────────────────────────────────────┐
│                Bankiko API  (Spring Boot 3 / Java 17)            │
│                                                                  │
│  auth  ·  member  ·  group  ·  wallet  ·  contribution          │
│  loan  ·  share   ·  dividend  ·  notification  ·  report        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │     fineract client  (all banking calls in one place)      │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │     mpesa (STK Push C2B · B2C · callback routing)         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────┬─────────────────────────┬────────────────────────────┘
           │                         │
 ┌─────────▼──────────┐   ┌──────────▼────────────────┐
 │  Apache Fineract   │   │  Safaricom Daraja API      │
 │  (Core Banking)    │   │  (M-Pesa STK / B2C)        │
 └─────────┬──────────┘   └───────────────────────────┘
           │
 ┌─────────▼──────────┐   ┌──────────────────────────┐
 │  MySQL (Fineract)  │   │  Africa's Talking SMS     │
 └────────────────────┘   └──────────────────────────┘

Infrastructure:
  PostgreSQL 16  — Bankiko metadata DB (users, groups, transactions)
  Redis 7        — Daraja OAuth token cache, Spring Cache
  FCM (optional) — Push notifications via Firebase Cloud Messaging v1
```

**Design philosophy:** Bankiko is an orchestration layer. Fineract is the bank — it manages the ledger, clients, savings accounts, and loan accounts. Bankiko adds group management, M-Pesa integration, share capital, dividends, compliance reporting, and push notifications on top.

---

## Feature Breakdown

### Authentication
- Register / login with JWT (access token 15 min, refresh token 7 days)
- BCrypt strength 12, server-side refresh token revocation
- Role-based (`MEMBER`, `ADMIN`)

### Member & Wallet
- Onboarding creates a Fineract client + opens a savings account (individual wallet)
- Deposit via M-Pesa STK push → callback credits Fineract savings account
- Withdrawal: Fineract debit first → B2C payout to M-Pesa
- Local balance fallback if Fineract is unreachable

### Groups (SACCO + Chama)
- Any member can create a group
- SACCO groups require admin approval before going active
- Chama groups are immediately active
- Each group provisions a Fineract group savings account (the lending pool)
- Group admins can view pool balance, defaulters report, and declare dividends

### Share Capital (SACCO only)
- Members buy shares at a fixed price per share via M-Pesa STK push
- Share register tracks who holds how many shares
- Loan ceiling = `shares × sharePrice × loanMultiplier`
- No shares → no loan

### Contributions
- Monthly contribution per member per group (one per month enforced by DB constraint)
- Credits the group's Fineract pool account
- Configurable: minimum months required before SACCO loan eligibility
- Defaulters report: `GET /api/groups/{id}/defaulters` — lists members with no contribution this month
- Late contribution penalty (flat KES, configurable per group)

### Loans
- Members apply; admins approve
- Loan approval:
  - Verifies pool has sufficient funds before disbursing
  - Snapshots interest rate + type from the group at origination
  - Generates full repayment schedule (reducing balance or flat rate)
- **Interest calculation**:
  - **Reducing balance** — PMT formula: `M = P × r(1+r)^n / ((1+r)^n − 1)`
  - **Flat rate** — total interest spread equally across installments
  - Both configurable per SACCO group (default 12% p.a. reducing balance)
- Outstanding balance decremented on each repayment; zeroed on full closure
- OVERDUE scheduler runs daily at 08:00 EAT — flips PENDING → OVERDUE, calculates penalty, sends SMS + push
- Late payment penalty = `latePenaltyRate%` of the installment amount (configurable)

### Dividends (SACCO only)
- Admin declares a dividend with total profit for a cycle year
- Allocated proportionally: `memberShares / totalShares × totalProfit`
- Pay cycle notifies every member via SMS + FCM push

### Push Notifications (FCM)
- Firebase Cloud Messaging v1 HTTP API (no Firebase Admin SDK)
- Service account JWT built from base64-encoded `serviceAccountKey.json`
- Device token registration: `POST /api/device-tokens` (upsert), `DELETE` on logout
- Push triggered on: loan approve/reject, deposit confirmed, share purchase, contribution recorded, OVERDUE installments, dividend paid
- Gracefully skipped if `FCM_PROJECT_ID` env var is unset

### PDF Reports
- **Member statement** (`GET /api/reports/statement/me`): shares, loans + outstanding balance, contribution history, repayment schedule — PDF download
- **SASRA monthly returns** (`GET /api/reports/sasra/groups/{id}/monthly`): membership, contributions collected, loan portfolio, outstanding loan book, capital adequacy ratio

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | Java 17 |
| Framework | Spring Boot 3.3.4 |
| Core Banking | Apache Fineract 1.9 |
| Database (app) | PostgreSQL 16 |
| Database (Fineract) | MySQL 8 |
| Migrations | Flyway |
| ORM | Spring Data JPA / Hibernate |
| Cache | Redis 7 |
| HTTP Client | Spring WebFlux WebClient |
| Payment | Safaricom Daraja (STK Push C2B + B2C) |
| SMS | Africa's Talking |
| Push | Firebase Cloud Messaging v1 (HTTP) |
| PDF | iText 7 (community) |
| API Docs | SpringDoc OpenAPI 3 (Swagger UI) |
| Metrics | Micrometer + Prometheus |
| Frontend | Next.js 15, shadcn/ui, NextAuth |
| Mobile | React Native Expo SDK 56, expo-router |

---

## Database Migrations

| Migration | What it adds |
|---|---|
| `V1__init.sql` | Core tables: users, members, groups, contributions, loans, mpesa_transactions |
| `V2-V4` | Seed data, local balance column, naming fixes |
| `V5__loans_table.sql` | Loans table |
| `V6__group_type.sql` | GroupType (CHAMA/SACCO), GroupStatus, approval flow |
| `V7__share_module.sql` | Share config on groups, share_holdings table |
| `V8__loan_repayments.sql` | Loan repayment schedule table (installments) |
| `V9__config_and_device_tokens.sql` | Per-group minContributionsRequired, FCM device_tokens |
| `V10__loan_interest.sql` | annualInterestRate, interestType, latePenaltyRate, contributionPenalty on groups; interest/outstanding fields on loans; penaltyAmount on repayments |
| `V11__dividends.sql` | dividend_cycles, dividend_allocations tables |

---

## API Reference

Swagger UI: `http://localhost:8080/swagger-ui.html`

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login → tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke refresh token |

### Member & Wallet
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/members/onboard` | Create Fineract client + wallet |
| GET | `/api/members/me` | Member profile |
| GET | `/api/wallet/balance` | Wallet balance |
| POST | `/api/wallet/deposit` | Deposit via STK push |
| POST | `/api/wallet/withdraw` | Withdraw to M-Pesa |
| GET | `/api/wallet/statement` | Transaction history |
| GET | `/api/reports/statement/me` | PDF member statement |

### Groups
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/groups` | Create group (SACCO or Chama) |
| GET | `/api/groups` | My groups |
| GET | `/api/groups/{id}` | Group detail |
| GET | `/api/groups/{id}/balance` | Group pool balance |
| GET | `/api/groups/{id}/defaulters` | Members who haven't paid this month |
| POST | `/api/groups/{id}/members/{userId}` | Add member |
| GET | `/api/groups/users/lookup` | Find user by phone/email |

### Admin — Group Approval
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/groups/pending` | Pending SACCO groups |
| POST | `/api/admin/groups/{id}/approve` | Approve SACCO group |
| POST | `/api/admin/groups/{id}/reject` | Reject group |

### Contributions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/groups/{id}/contributions` | Contribute (STK push) |
| GET | `/api/groups/{id}/contributions` | Group contribution list |
| GET | `/api/groups/{id}/contributions/mine` | My contributions in group |

### Shares (SACCO only)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/shares/buy` | Buy shares via STK push |
| GET | `/api/shares/groups/{id}/my-holding` | My holding in group |
| GET | `/api/shares/groups/{id}/register` | Full share register |

### Loans
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/loans` | Apply for loan |
| GET | `/api/loans` | My loans |
| GET | `/api/loans/{id}/schedule` | Repayment schedule |
| POST | `/api/loans/{id}/repay` | Repay installment |
| GET | `/api/admin/loans/pending` | Pending approvals |
| POST | `/api/admin/loans/{id}/approve` | Approve + disburse |
| POST | `/api/admin/loans/{id}/reject` | Reject |

### Dividends (SACCO only)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/dividends/groups/{id}/declare` | Declare dividend for year |
| POST | `/api/dividends/cycles/{id}/pay` | Pay out dividend |
| GET | `/api/dividends/groups/{id}/cycles` | Cycle history |
| GET | `/api/dividends/cycles/{id}/allocations` | Per-member allocations |
| GET | `/api/dividends/my` | My pending dividends |

### Notifications
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/device-tokens` | Register FCM token |
| DELETE | `/api/device-tokens` | Remove FCM token |

### SASRA Reports
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/reports/sasra/groups/{id}/monthly` | Monthly returns PDF (`?year=&month=`) |

### M-Pesa Callbacks (Safaricom → Bankiko)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/mpesa/callback/stk` | STK push result |
| POST | `/api/mpesa/callback/b2c` | B2C payout result |
| POST | `/api/mpesa/callback/b2c/timeout` | B2C timeout |

---

## Money Flows

### Deposit (STK Push → Fineract Credit)
```
Member → POST /api/wallet/deposit
       → Daraja STK Push (phone prompt)
       → Member approves on phone
       → Daraja POSTs to /api/mpesa/callback/stk
       → MpesaTransaction → SUCCESS
       → Fineract savings account credited
       → SMS + FCM push: "KES X deposited"
```

### Group Contribution (STK Push → Group Pool)
```
Member → POST /api/groups/{id}/contributions
       → Daraja STK Push
       → Callback → credits group Fineract savings account
       → Contribution record saved (month unique constraint)
       → SMS + FCM push: "KES X to Group Name"
```

### Share Purchase (SACCO)
```
Member → POST /api/shares/buy {groupId, numberOfShares}
       → Daraja STK Push (amount = shares × sharePrice)
       → Callback → ShareHolding updated
       → Loan ceiling recalculated automatically
       → SMS + FCM push: "Share purchase confirmed"
```

### Loan Disburse → Repay
```
Member applies → admin verifies pool has sufficient funds
             → snapshots interestRate + interestType from group
             → generates reducing-balance or flat-rate schedule
             → B2C payout to member's M-Pesa
             → daily scheduler checks for PENDING past due date → OVERDUE + penalty
             → Member repays → installment marked PAID → outstanding balance reduced
             → All installments paid → loan CLOSED
```

### Dividend Cycle
```
Admin → POST /api/dividends/groups/{id}/declare {totalProfit, year}
      → Allocates proportionally to each member's share count
      → POST /api/dividends/cycles/{id}/pay
      → Every member notified via SMS + FCM push
      → DividendAllocation.paid = true
```

---

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Safaricom Daraja account (sandbox: developer.safaricom.co.ke)
- Africa's Talking account (sandbox available)
- Firebase project (optional — SMS works without it)

### 1. Clone and configure
```bash
git clone <repo>
cd Bankiko
cp .env.example .env
# Fill in MPESA_*, AT_*, JWT_SECRET, and optionally FCM_* vars
```

### 2. Start all services
```bash
docker compose up --build
```
Starts: PostgreSQL · MySQL · Fineract · Redis · Bankiko API  
Fineract takes ~2 min to initialize on first start.

### 3. Create Fineract products (once)
```bash
# Savings product for individual wallets (productId=1)
curl -X POST http://localhost:8443/fineract-provider/api/v1/savingsproducts \
  -H "Fineract-Platform-TenantId: default" -u mifos:password \
  -H "Content-Type: application/json" \
  -d '{"name":"Member Wallet","shortName":"MWLT","currencyCode":"KES",
       "digitsAfterDecimal":2,"nominalAnnualInterestRate":0,
       "interestCompoundingPeriodType":1,"interestPostingPeriodType":4,
       "interestCalculationType":1,"interestCalculationDaysInYearType":365,
       "accountingRule":1,"locale":"en","dateFormat":"dd MMMM yyyy"}'

# Savings product for group pools (productId=2)
curl -X POST http://localhost:8443/fineract-provider/api/v1/savingsproducts \
  -H "Fineract-Platform-TenantId: default" -u mifos:password \
  -H "Content-Type: application/json" \
  -d '{"name":"Group Fund","shortName":"GRPF","currencyCode":"KES",
       "digitsAfterDecimal":2,"nominalAnnualInterestRate":0,
       "interestCompoundingPeriodType":1,"interestPostingPeriodType":4,
       "interestCalculationType":1,"interestCalculationDaysInYearType":365,
       "accountingRule":1,"locale":"en","dateFormat":"dd MMMM yyyy"}'
```

### 4. Quick smoke test
```bash
# Register
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Jane Doe","email":"jane@sacco.ke","phone":"0712345678","password":"pass123"}'

# Onboard (use accessToken from above)
curl -X POST http://localhost:8080/api/members/onboard \
  -H "Authorization: Bearer <accessToken>"

# Create a SACCO group
curl -X POST http://localhost:8080/api/groups \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Umoja SACCO","groupType":"SACCO","monthlyContributionTarget":2000,
       "sharePrice":200,"minShares":5,"loanMultiplier":3,
       "annualInterestRate":12,"interestType":"REDUCING_BALANCE",
       "minContributionsRequired":3,"latePenaltyRate":5}'
```

---

## Environment Variables

### Required
| Variable | Description |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL connection |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Redis |
| `JWT_SECRET` | Random 256-bit string — never use the default in production |
| `FINERACT_BASE_URL`, `FINERACT_USERNAME`, `FINERACT_PASSWORD` | Fineract API |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET` | Daraja app credentials |
| `MPESA_SHORTCODE`, `MPESA_PASSKEY` | STK Push |
| `MPESA_STK_CALLBACK_URL` | Public URL for Daraja STK callbacks |

### Withdrawals & Disbursements (B2C)
| Variable | Description |
|---|---|
| `MPESA_B2C_INITIATOR_NAME` | B2C initiator name from Daraja portal |
| `MPESA_B2C_SECURITY_CREDENTIAL` | B2C security credential |
| `MPESA_B2C_CALLBACK_URL`, `MPESA_B2C_TIMEOUT_URL` | B2C result endpoints |

### SMS
| Variable | Description |
|---|---|
| `AT_API_KEY` | Africa's Talking API key |
| `AT_USERNAME` | Africa's Talking username (`sandbox` for testing) |
| `AT_SENDER_ID` | SMS sender ID (default: `BANKIKO`) |

### FCM Push Notifications (optional)
| Variable | Description |
|---|---|
| `FCM_PROJECT_ID` | Firebase project ID |
| `FCM_SERVICE_ACCOUNT_JSON` | `base64 -i serviceAccountKey.json \| tr -d '\n'` |

If `FCM_PROJECT_ID` is blank, all push sends are skipped — SMS still works.

#### Mobile setup for push (when ready):
```bash
npx expo install expo-notifications expo-device
# Add "expo-notifications" to app.json plugins
```

---

## Scheduled Jobs

| Job | Schedule | What it does |
|---|---|---|
| `LoanOverdueScheduler` | Daily 08:00 EAT (05:00 UTC) | Marks PENDING installments past due date as OVERDUE, calculates late penalty (% of installment), sends SMS + FCM push |

---

## Frontend (Next.js 15)

Admin portal at `frontend/`. shadcn/ui, NextAuth CredentialsProvider (JWT stored server-side).

```bash
cd frontend && npm install && npm run dev   # http://localhost:3000
```

Pages: Dashboard · Wallet · Groups · Loans · Share Register · Member Statement · SASRA Reports

---

## Mobile (React Native Expo SDK 56)

Member-facing app at `mobile/`. expo-router, expo-secure-store for token storage.

```bash
cd mobile && npm install && npx expo start
```

Screens: Wallet · Groups · Loans (with repayment schedule) · Statement · Share Purchases

---

## Production Checklist

### Security
- [ ] `JWT_SECRET` is a random 256-bit value
- [ ] CORS locked to production domain
- [ ] Actuator: only `/health` public
- [ ] HTTPS everywhere
- [ ] M-Pesa callback endpoint IP-whitelisted to Safaricom ranges
- [ ] Fineract default `mifos/password` rotated

### Database
- [ ] `spring.jpa.hibernate.ddl-auto=validate`
- [ ] Flyway migrations reviewed before each deploy
- [ ] PostgreSQL and MySQL on managed, backed-up instances

### SASRA Compliance (if registering)
- [ ] Monthly returns generated and filed: `GET /api/reports/sasra/groups/{id}/monthly`
- [ ] Capital adequacy ratio reviewed (outstanding loans / share capital ≤ 300%)
- [ ] Member statements available on demand: `GET /api/reports/statement/me`

### Observability
- [ ] Prometheus scraping `/actuator/prometheus`
- [ ] Alerts on: 5xx error rate, M-Pesa callback failures, pool balance < active loan disbursements

---

## Architecture Decisions

**Modular monolith over microservices** — at the scale of a regional SACCO (hundreds to low thousands of members), microservices add operational cost without benefit. Clean module boundaries allow extraction later if needed.

**Fineract as the ledger** — financial ledgers require double-entry accounting, audit trails, and reconciliation. Fineract handles all of that. Bankiko never writes directly to financial state — it calls Fineract APIs.

**Fineract debited before M-Pesa on withdrawals** — if M-Pesa is called first and Fineract debit then fails, money leaves the system with no ledger record. The safer failure mode is: Fineract debited, M-Pesa fails → flag for reconciliation.

**FCM without Firebase Admin SDK** — the Admin SDK pulls in heavy transitive dependencies. Instead, Bankiko builds and signs its own JWT service account assertion, exchanges it for a short-lived Google OAuth2 token, and calls the FCM HTTP v1 API directly. No dependency on `firebase-admin`.

**Interest calculation in Bankiko, not Fineract** — Fineract's loan product configuration is complex to automate via API. Bankiko calculates the full repayment schedule at approval time using the PMT formula (reducing balance) or simple interest (flat rate) and stores it in `loan_repayments`. This gives full control over the schedule display and OVERDUE logic.
