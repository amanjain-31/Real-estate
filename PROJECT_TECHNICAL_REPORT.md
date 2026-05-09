# Elite Estates — Detailed Technical Report (Interview Preparation)

## 1) Project Overview

Elite Estates is a MERN-stack real-estate platform with three primary personas:

- **User**: browse listings, like properties, contact owners, book tours
- **Owner**: create/manage listings, manage tour requests, view analytics dashboards
- **Admin**: manage users, roles, and platform listings

Core modules:

- Authentication and profile management
- Listing CRUD + advanced search
- Property analytics (views, likes, inquiries)
- Tour booking lifecycle (request, confirm, reschedule, cancel, complete, feedback)

Primary backend entrypoint: [api/index.js](api/index.js)

---

## 2) Technology Stack

### Backend

- Node.js + Express
- MongoDB + Mongoose
- JWT auth via `httpOnly` cookie
- `bcryptjs` for password hashing
- `cookie-parser`, `cors`, `dotenv`

Backend dependencies are defined in [package.json](package.json).

### Frontend

- React 18 + Vite
- Redux Toolkit + redux-persist
- React Router
- Tailwind CSS
- Chart.js + react-chartjs-2
- Firebase (Google OAuth) + Cloudinary upload integration

Frontend dependencies are defined in [client/package.json](client/package.json).

---

## 3) Runtime & Request Flow

1. Server boots from [api/index.js](api/index.js), loads `.env`, connects to MongoDB, applies middleware.
2. API routes mounted under:
   - `/api/auth`
   - `/api/user`
   - `/api/listing`
   - `/api/analytics`
   - `/api/tours`
3. In development, Vite proxies `/api/*` to backend via [client/vite.config.js](client/vite.config.js).
4. In production, Express serves client build (`client/dist`) and falls back to SPA index.

---

## 4) Authentication & Session Model

## 4.1 Sign-in strategy

- Username/password login in [api/controllers/auth.controller.js](api/controllers/auth.controller.js)
- Google OAuth login (Firebase popup on frontend, backend account lookup/create)

## 4.2 Token handling

- JWT generated with payload `{ id, role }`
- Stored in `access_token` cookie, `httpOnly: true`
- Verification middleware: [api/utils/VerifyUser.js](api/utils/VerifyUser.js)

## 4.3 Authorization middleware

- `verifyToken`: validates cookie and loads full user into `req.user`
- `authorizeRoles(...roles)`: role-based gate
- `authorizeOwnerOrAdmin`: allows same-user resource access or admin override

---

## 5) Role-Based Access Control (RBAC) Summary

| Capability | User | Owner | Admin |
|---|---:|---:|---:|
| Register/Login | ✅ | ✅ | ✅ |
| Browse listings | ✅ | ✅ | ✅ |
| Create listing | ❌ | ✅ | ✅ |
| Update/Delete own listing | ❌ | ✅ | ✅ |
| Like/Inquiry | ✅ | ✅ | ✅ |
| Book tour | ✅ | ✅ (for others’ properties) | ✅ |
| Respond to owner-tour requests | ❌ | ✅ (checked in controller) | Depends on ownership logic |
| View owner analytics dashboard | Typically owner intent | ✅ | ✅ (if owner of listings or via broader access path) |
| Admin user/listing management | ❌ | ❌ | ✅ |

Notes:

- Route-level and controller-level authorization are both used.
- Some routes use `verifyToken` only and rely on controller ownership checks.

---

## 6) API Endpoints (Detailed)

## 6.1 Authentication APIs

Source: [api/routes/auth.route.js](api/routes/auth.route.js)

| Method | Endpoint | Auth Required | Role Restriction | Purpose |
|---|---|---|---|---|
| POST | `/api/auth/signup` | No | None | Create user account |
| POST | `/api/auth/signin` | No | None | Username/password login |
| POST | `/api/auth/google` | No | None | Google OAuth login/signup |
| POST | `/api/auth/signout` | No | None | Clear auth cookie |

Controller: [api/controllers/auth.controller.js](api/controllers/auth.controller.js)

Behavior details:

- `signup` hashes password with bcrypt and stores role/phone if provided.
- `signin` finds by username, compares hash, sets cookie.
- `googlesignin` finds/creates user and sets cookie.

## 6.2 User & Admin APIs

Source: [api/routes/user.route.js](api/routes/user.route.js)

| Method | Endpoint | Middleware Chain | Effective Access |
|---|---|---|---|
| GET | `/api/user/test` | none | Public |
| POST | `/api/user/update/:id` | `verifyToken` → `authorizeOwnerOrAdmin` | Owner of `:id` or admin |
| DELETE | `/api/user/delete/:id` | `verifyToken` → `authorizeOwnerOrAdmin` | Owner of `:id` or admin |
| GET | `/api/user/listings/:id` | `verifyToken` | Controller enforces same user or admin |
| GET | `/api/user/:id` | `verifyToken` | Any authenticated user |
| GET | `/api/user/admin/users` | `verifyToken` → `authorizeRoles('admin')` | Admin only |
| GET | `/api/user/admin/listings` | `verifyToken` → `authorizeRoles('admin')` | Admin only |
| PUT | `/api/user/admin/users/:id/role` | `verifyToken` → `authorizeRoles('admin')` | Admin only |
| DELETE | `/api/user/admin/users/:id` | `verifyToken` → `authorizeRoles('admin')` | Admin only |
| DELETE | `/api/user/admin/listings/:id` | `verifyToken` → `authorizeRoles('admin')` | Admin only |

Controller: [api/controllers/user.controller.js](api/controllers/user.controller.js)

Highlights:

- Admin role changes validated against enum (`user`, `owner`, `admin`).
- User listing retrieval filters by `useRef` ownership.

## 6.3 Listing APIs

Source: [api/routes/listing.route.js](api/routes/listing.route.js)

| Method | Endpoint | Middleware Chain | Effective Access |
|---|---|---|---|
| POST | `/api/listing/create` | `verifyToken` → `authorizeRoles('owner','admin')` | Owner/Admin |
| DELETE | `/api/listing/delete/:id` | `verifyToken` → `authorizeRoles('owner','admin')` | Owner/Admin; controller enforces ownership unless admin |
| POST | `/api/listing/update/:id` | `verifyToken` → `authorizeRoles('owner','admin')` | Owner/Admin; controller enforces ownership unless admin |
| GET | `/api/listing/get/:id` | none | Public |
| GET | `/api/listing/get` | none | Public |

Controller: [api/controllers/listing.controller.js](api/controllers/listing.controller.js)

Advanced search query parameters supported:

- `searchTerm`, `location`
- `type` (`sale`/`rent`/`all`)
- `offer`, `parking`, `furnished`
- `minPrice`, `maxPrice`
- `bedrooms`, `bathrooms`
- Pagination: `limit`, `startIndex`
- Sorting: `sort`, `order`

## 6.4 Analytics APIs

Source: [api/routes/analytics.route.js](api/routes/analytics.route.js)

| Method | Endpoint | Middleware Chain | Effective Access |
|---|---|---|---|
| POST | `/api/analytics/view/:listingId` | none | Public view tracking |
| GET | `/api/analytics/like-status/:listingId` | none | Public endpoint |
| GET | `/api/analytics/public/:listingId` | none | Public analytics (sanitized) |
| POST | `/api/analytics/like/:listingId` | `verifyToken` | Authenticated users |
| POST | `/api/analytics/inquiry/:listingId` | `verifyToken` | Authenticated users |
| GET | `/api/analytics/property/:listingId` | `verifyToken` | Controller enforces owner/admin |
| GET | `/api/analytics/dashboard` | `verifyToken` | Authenticated; owner-focused aggregation |

Controller: [api/controllers/analytics.controller.js](api/controllers/analytics.controller.js)

What is tracked:

- Total views + view history (timestamp, user/IP/agent)
- Likes + liker references
- Inquiries by type (`tour_request`, `contact`, etc.)
- Owner dashboard KPIs, 30-day trend, top-performing properties

## 6.5 Tour Booking APIs

Source: [api/routes/tourBooking.route.js](api/routes/tourBooking.route.js)

| Method | Endpoint | Middleware Chain | Effective Access |
|---|---|---|---|
| POST | `/api/tours/book/:listingId` | `verifyToken` | Authenticated users |
| GET | `/api/tours/user/bookings` | `verifyToken` | Authenticated users (own bookings) |
| POST | `/api/tours/reschedule-response/:bookingId` | `verifyToken` | Booking user (controller check) |
| POST | `/api/tours/feedback/:bookingId` | `verifyToken` | Booking user after completion |
| GET | `/api/tours/owner/bookings` | `verifyToken` | Owner context (controller check) |
| POST | `/api/tours/owner/respond/:bookingId` | `verifyToken` | Booking owner only (controller check) |
| POST | `/api/tours/owner/complete/:bookingId` | `verifyToken` | Booking owner only (controller check) |
| GET | `/api/tours/owner/dashboard-stats` | `verifyToken` | Owner context |
| GET | `/api/tours/details/:bookingId` | `verifyToken` | Booking owner or booking user |
| POST | `/api/tours/cancel/:bookingId` | `verifyToken` | Booking owner or booking user |

Controller: [api/controllers/tourBooking.controller.js](api/controllers/tourBooking.controller.js)

Tour state model:

- `pending` → `confirmed` / `rescheduled` / `cancelled`
- `confirmed` → `completed` or `cancelled`
- `rescheduled` can be accepted/declined by user

---

## 7) Data Model Summary

## 7.1 User model

Source: [api/models/user.model.js](api/models/user.model.js)

Important fields:

- `username`, `email` unique
- `password` hash
- `role` enum: `user`, `owner`, `admin`
- `phone`, `avatar`, `isVerified`

## 7.2 Listing model

Source: [api/models/listing.model.js](api/models/listing.model.js)

Important fields:

- Core property attributes (name, description, address, beds/baths, prices)
- Feature flags (parking, furnished, offer)
- `type` (sale/rent)
- `imageUrls[]`
- `useRef` owner id (stored as string)

## 7.3 Property analytics model

Source: [api/models/propertyAnalytics.model.js](api/models/propertyAnalytics.model.js)

Important fields:

- `listingId` ref
- `views`, `viewHistory[]`
- `likes[]`, `totalLikes`
- `inquiries[]`

Indexes:

- `listingId`
- `likes.userId`

## 7.4 Tour booking model

Source: [api/models/tourBooking.model.js](api/models/tourBooking.model.js)

Important fields:

- `listingId`, `userId`, `ownerId`
- `tourType` (`physical`, `virtual`)
- `status` lifecycle
- schedule fields (`requestedDate/time`, `confirmedDate/time`)
- `ownerResponse.rescheduleOptions[]`
- `reschedulingHistory[]`
- `meetingLink`, `feedback`, completion metadata

Indexes:

- `(listingId, userId)`
- `(ownerId, status)`
- `(requestedDate, status)`

---

## 8) Frontend Route & UI Access Map

Primary router: [client/src/App.jsx](client/src/App.jsx)

Public pages:

- `/`, `/signin`, `/signup`, `/about`, `/contact`, `/help`, `/privacy`, `/terms`
- `/listing/:id`, `/search`

Authenticated pages (via `PrivateRoute`):

- `/profile`, `/dashboard`, `/my-tours`, `/tours-dashboard`
- `/create-listing`, `/createlisting`, `/mylisting`, `/updatelisting/:listingId`
- `/admin`, `/analytics`

Auth state persistence:

- Redux slice: [client/src/redux/user/useSlice.js](client/src/redux/user/useSlice.js)
- Store + persist: [client/src/redux/store.js](client/src/redux/store.js)

---

## 9) Major Business Workflows

## 9.1 Authentication workflow

1. User submits credentials in Signin page.
2. Backend validates and returns profile + sets JWT cookie.
3. Frontend stores `currentUser` in Redux and persists state.

## 9.2 Listing management workflow

1. Owner uploads images to Cloudinary from frontend form.
2. Owner submits listing payload to `/api/listing/create`.
3. Listing appears in home/search feeds.

## 9.3 Search workflow

1. UI controls update URL query params.
2. API receives query and builds dynamic Mongoose filter.
3. Supports pagination and sort for scalable browsing.

## 9.4 Analytics workflow

1. Listing detail page posts view events.
2. Likes/inquiries mutate property analytics documents.
3. Owner dashboard aggregates totals + trendline + top properties.

## 9.5 Tour workflow

1. User submits tour request.
2. Owner confirms/cancels/reschedules.
3. User responds to reschedule options.
4. Owner marks completion; user can submit feedback.

---

## 10) Security & Authorization Observations

Strengths:

- `httpOnly` cookie tokens (reduced XSS token theft risk)
- Reusable auth + role middleware
- Ownership checks in controllers for critical mutations
- Password hashing with bcrypt

Areas to improve:

1. **Signup role assignment**
   - Current signup accepts role from request body.
   - Recommend forcing default role (`user`) server-side; admin-only role elevation.

2. **Cookie hardening**
   - Add `sameSite` and `secure` in production for auth cookie.

3. **Input validation layer**
   - Add centralized request schema validation (Joi/Zod/express-validator).

4. **Rate limiting and abuse controls**
   - Add rate limits on auth and analytics write endpoints.

5. **Consistent ownership field naming/types**
   - Listing owner currently stored as `useRef` string; moving to ObjectId ref improves consistency.

6. **Route-level vs controller-level policy consistency**
   - Some role checks are implicit in controller logic; can standardize with dedicated middleware.

---

## 11) Code Quality / Consistency Notes

1. Listing schema uses `{ timestamp: true }` (singular) in [api/models/listing.model.js](api/models/listing.model.js).
   - Should be `{ timestamps: true }` to auto-manage `createdAt/updatedAt`.

2. Mixed naming appears in frontend/backend (`useRef` vs `userRef`, `photo` vs `photoURL`) across modules.

3. `api/models/analytics.model.js` exists but is empty; can remove or implement to avoid confusion.

4. Some UI routes are only `PrivateRoute` protected and rely on backend checks for role-level security (which is good), but frontend route-level `RoleProtectedRoute` can improve UX gating.

---

## 12) Interview-Ready Talking Points

## 12.1 60-second architecture pitch

“This is a MERN real-estate platform with role-based user journeys. I separated concerns into routes, controllers, and models on Express, and enforced authorization via JWT cookie auth plus role/ownership middleware. Listings support dynamic server-side filtering, tours are implemented as a stateful workflow, and analytics collect engagement events and aggregate owner dashboards. On the frontend, React Router and Redux Persist provide route protection and durable session state.”

## 12.2 Likely interviewer questions you can answer

- How does authorization work across layers?
- Where do you enforce ownership constraints?
- How do search filters map from UI to DB query?
- Why use a separate analytics collection instead of listing document counters?
- How would you scale tour scheduling conflict checks?
- What are current security gaps and next steps?

## 12.3 Interview Q&A — Suggested Answers

### Q1) How does authorization work across layers?

**Answer (short interview version):**

Authorization is enforced in two layers. First, route middleware validates the JWT cookie and loads the user into `req.user`. Then role/ownership middleware (or controller checks) decides whether the action is allowed. For example, listing create/update/delete is restricted to owner/admin at route level, and update/delete also validates actual resource ownership in the controller.

**Answer (deeper detail):**

- `verifyToken` reads `access_token` from cookie and verifies JWT.
- On success, it fetches user details from DB and attaches user context to request.
- `authorizeRoles(...)` does coarse-grained RBAC (admin/owner/user).
- `authorizeOwnerOrAdmin` (or controller logic) does fine-grained ABAC-style ownership checks.
- This prevents both unauthenticated access and cross-tenant access (user modifying another user’s data).

### Q2) Where do you enforce ownership constraints?

**Answer (short interview version):**

Ownership is enforced primarily in controllers for mutation safety, even after role middleware passes. In listing updates/deletes, we compare `req.user._id` against listing owner reference; only admin bypasses this. Similar checks exist in tour flows where only booking owner/user can perform specific actions.

**Examples you can mention:**

- Listings: owner/admin route gate + controller check against listing owner id.
- Profile updates/deletes: `authorizeOwnerOrAdmin` with `:id` check.
- Tour responses: only property owner can confirm/reschedule/cancel request; only booking user can accept/decline reschedule.

### Q3) How do search filters map from UI to DB query?

**Answer (short interview version):**

The search page stores filters in URL query params, then calls `/api/listing/get`. Backend parses params and builds a dynamic Mongoose query object with regex search, boolean filters, numeric ranges, sorting, limit, and offset.

**Flow explanation:**

1. User changes filters (`type`, `minPrice`, `bedrooms`, etc.).
2. Frontend serializes selected filters into URL query string.
3. Backend maps query params into Mongo filter fields:
   - regex for text (`name`, `address`)
   - `$gte/$lte` for prices
   - exact/enum matches for type/features
4. Results are sorted + paginated via `limit` and `startIndex`.

### Q4) Why use a separate analytics collection instead of counters inside listing documents?

**Answer (short interview version):**

Analytics writes are high-frequency and structurally different from listing CRUD. A separate collection avoids write contention on listing documents, keeps listing payload lean, and supports richer event history (view history, liker identities, inquiry events) and analytics-specific indexes.

**Trade-off discussion:**

- **Pros:** better separation of concerns, better query/index strategy, easier dashboard aggregations.
- **Cons:** eventual consistency possibility; extra join/lookups for enriched views.
- **Why acceptable here:** read-heavy listing experience with append-heavy engagement events benefits from decoupling.

### Q5) How would you scale tour scheduling conflict checks?

**Answer (short interview version):**

I would normalize requested/confirmed slots into a canonical `startAt/endAt` model, then enforce uniqueness and conflict checks with indexed owner+time-range queries. For higher scale, I’d use transactional booking confirmation and optional distributed locking around owner-time slots.

**Concrete steps:**

- Store canonical datetime ranges rather than separate date/time strings.
- Add compound indexes: `(ownerId, confirmedDate, confirmedTime, status)` or range-based index.
- Reject overlapping tours for same owner and active statuses.
- Use Mongo transactions for final confirm step when parallel requests race.
- Add background reminder/notification pipeline via queue for reliability.

### Q6) What are current security gaps and next steps?

**Answer (short interview version):**

The biggest gap is role assignment at signup, because role should not be client-controlled. Additional hardening includes cookie flags, centralized validation, rate limiting, and stricter CORS by environment.

**Priority order you can present:**

1. Force default role on signup; allow role changes only via admin endpoint.
2. Cookie hardening: `httpOnly`, `secure` (prod), `sameSite`, proper expiry.
3. Add request validation schemas for all write endpoints.
4. Add auth and analytics write rate limits.
5. Improve observability: auth audit logs + admin action logs.

### Q7) Why choose cookie-based JWT instead of localStorage token?

**Answer:**

`httpOnly` cookies reduce XSS exposure because JavaScript cannot directly read tokens. It simplifies authenticated fetches through browser cookie handling. The trade-off is CSRF risk, which should be mitigated via `sameSite` and CSRF strategy for sensitive endpoints.

### Q8) How would you productionize this codebase?

**Answer:**

I’d add CI with lint/test gates, environment-based configuration, structured logging, health checks, and monitoring. On the app side: validation middleware, consistent schema typing (ObjectId references), idempotent writes for analytics, and integration tests around auth, listing ownership, and tour state transitions.

## 12.4 Good “next iteration” proposals

- Add request validation and API contracts
- Add tests (controller + integration)
- Add refresh token rotation/session revocation strategy
- Add audit logs for admin actions
- Add optimistic concurrency for high-frequency analytics updates

---

## 13) File Map (for quick navigation)

- Backend bootstrap: [api/index.js](api/index.js)
- Auth routes/controller: [api/routes/auth.route.js](api/routes/auth.route.js), [api/controllers/auth.controller.js](api/controllers/auth.controller.js)
- User/admin: [api/routes/user.route.js](api/routes/user.route.js), [api/controllers/user.controller.js](api/controllers/user.controller.js)
- Listings: [api/routes/listing.route.js](api/routes/listing.route.js), [api/controllers/listing.controller.js](api/controllers/listing.controller.js)
- Analytics: [api/routes/analytics.route.js](api/routes/analytics.route.js), [api/controllers/analytics.controller.js](api/controllers/analytics.controller.js)
- Tours: [api/routes/tourBooking.route.js](api/routes/tourBooking.route.js), [api/controllers/tourBooking.controller.js](api/controllers/tourBooking.controller.js)
- Auth middleware: [api/utils/VerifyUser.js](api/utils/VerifyUser.js)
- Models: [api/models](api/models)
- Frontend router: [client/src/App.jsx](client/src/App.jsx)
- Redux auth state: [client/src/redux/user/useSlice.js](client/src/redux/user/useSlice.js)

---

## 14) Conclusion

From an interview perspective, this project is strong because it demonstrates:

- Full-stack feature ownership
- Practical RBAC implementation
- Real-world workflows (tour lifecycle)
- Event analytics + dashboarding
- Production-style project structure

With modest hardening around validation, cookie policy, role assignment control, and consistency cleanups, it can be presented as a robust portfolio-grade system.
