# Munch Catering Frontend

This is the Expo frontend for the Munch catering marketplace. It provides the customer and caterer experiences for discovery, quoting, booking, messaging, portfolio management, and account settings.

The app is designed as a single mobile-first experience with role-aware flows. It connects to the FastAPI backend in the sibling `munch_catering_backend` folder.

## What The App Includes
- login and signup flows with persisted sessions
- separate customer and caterer experiences in one app shell
- caterer discovery with portfolio previews, ratings, and pricing tiers
- quote requests, bookings, payment initiation, and booking detail views
- direct messaging between customers and caterers
- caterer profile editing and portfolio uploads
- stored theme preference with light and dark modes

## Local Setup
Install dependencies and start Expo:

```bash
npm install
npx expo start
```

Useful shortcuts:
- `npm run android`
- `npm run ios`
- `npm run web`

## Backend Connection
The frontend reads its backend base URL from `EXPO_PUBLIC_API_BASE_URL`.

Typical local web setup:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

Typical Android emulator setup:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
```

If the variable is not set, the app falls back to local defaults in the API client.

## Useful Files
- `app/index.tsx` contains the main app experience and screen composition
- `lib/api.ts` wraps backend requests
- `lib/session.ts` handles persisted auth and theme state
- `lib/munch-data.ts` contains shared frontend types, formatting helpers, and design tokens


