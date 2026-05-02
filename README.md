# Draft Kit UI Backend

Next.js backend for fantasy baseball draft management league APIs.

## Libraries

- **Next.js 15 + React 19** - API route runtime
- **TypeScript** - Strict mode
- **Mongoose** - MongoDB ODM
- **Zod** - Request validation and shared types
- **Vitest** - Backend testing

## Setup & Run

```bash
# Install
npm install

# Environment
cp .env.example .env.local

# Run
npm run dev              # Dev server (http://localhost:3002)
npm run build            # Production build
npm start                # Production server
npm test                 # Run tests
```

Set `MONGODB_URI` and optionally `MONGODB_DB_NAME` in `.env.local`.
Set `CORS_ALLOWED_ORIGINS` to a comma-separated list of allowed frontend origins for browser requests.

## User Isolation

All league and notebook API routes now require the `X-User-Id` request header.

- `POST /api/users` creates or reuses a user and returns the Mongo `_id`
- `GET /api/users/me` returns the user identified by `X-User-Id`
- `GET|POST /api/leagues` require `X-User-Id`
- `GET|PUT|DELETE /api/leagues/[leagueId]` require `X-User-Id`
- `GET|POST /api/notebooks` require `X-User-Id`
- `GET|PUT|DELETE /api/notebooks/[id]` require `X-User-Id`

Ownership is enforced in the service layer. Requests with a missing or invalid `X-User-Id` return `401`. Requests for another user's league or notebook return `403`.

## Adding a Feature

Create a new folder in `src/features/[feature-name]/`:

**1. `types/[feature].types.ts`** - Zod schemas and TypeScript types

- Define request and response schemas
- Export inferred TypeScript types using `z.infer<>`

**2. `server/[feature].model.ts`** - Mongoose models

- Define schema indexes and validation
- Export the model singleton

**3. `server/[feature].service.ts`** - Database operations

- Keep query and persistence logic here
- Return typed results

**4. `utils/[feature].seed.ts`** - Seed helpers when needed

- Keep initialization logic separate from route handlers

**5. Create route in `src/app/api/[feature]/route.ts`**

- Validate input with Zod
- Connect to MongoDB
- Delegate database work to the service layer

## Feature Rules

- Features are self-contained where practical
- Route handlers should stay thin
- Shared server code goes in `src/shared/server/`
- Tests live next to code (`*.test.ts`)
- Use kebab-case for files

## Route Pattern

**Types** → **Route** → **Service** → **Model**

Requests are validated with Zod, route handlers orchestrate the request, services own database logic, and models define persistence.
# draft-kit-backend
