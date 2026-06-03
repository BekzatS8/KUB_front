# crm-platform — frontend

This repository contains the Next.js frontend for the CRM platform.

## Getting started

- Copy `.env.local` or set environment variables before running locally:

  - `NEXT_PUBLIC_API_BASE_URL` — base URL for the backend API (required for runtime API calls)
  - Optionally `AUTH_TOKEN` for smoke tests (Bearer token)

- Install and run:
  - pnpm install (or npm/yarn)
  - pnpm dev

## Postman → TypeScript generation

A generator script is provided to produce TypeScript models and API clients from the Postman collection located in `postman/kub-api.postman_collection.json`.

- Create/replace the collection file `postman/kub-api.postman_collection.json`.
- Run:

```
node scripts/generate-ts-from-postman.js
```

This will write generated models to `src/models/` and API clients to `src/api/`.

## Smoke tests

A lightweight smoke test script can be used to validate a few endpoints against your backend (non-destructive):

```
# set the API base and optional AUTH token
NEXT_PUBLIC_API_BASE_URL=https://api.example.com AUTH_TOKEN=ey... npm run smoke
```

It will attempt several GET requests and print response statuses.

## Notes

- The app uses a central axios instance in `src/api/index.ts`. Token handling is done via localStorage keys `auth_token` and `refresh_token`.
- File uploads use `multipart/form-data` and downloads are handled as blobs on the client.

If you want, I can add more detailed developer docs or example `.env.local` entries.
