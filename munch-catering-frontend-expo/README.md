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

## Screenshots

The web screenshots show the customer experience, and the native mobile screenshots show the caterer experience.

### Customer Web Experience

| Home | Discover |
| --- | --- |
| <img src="assets/images/Home%28web%29.png" alt="Munch customer web home screen" width="420"> | <img src="assets/images/Discover%28web%29.png" alt="Munch customer web caterer discovery screen" width="420"> |

| Bookings | Messages |
| --- | --- |
| <img src="assets/images/Bookings%28web%29.png" alt="Munch customer web bookings screen" width="420"> | <img src="assets/images/Message%28web%29.png" alt="Munch customer web messaging screen" width="420"> |

| Profile | Settings |
| --- | --- |
| <img src="assets/images/Profile%28web%29.png" alt="Munch customer web profile screen" width="420"> | <img src="assets/images/Settings%28web%29.png" alt="Munch customer web settings screen" width="420"> |

| Sign In | Login |
| --- | --- |
| <img src="assets/images/sign-in%28web%29.png" alt="Munch customer web sign in screen" width="420"> | <img src="assets/images/login%28web%29.png" alt="Munch customer web login screen" width="420"> |

### Caterer Native Mobile Experience

| Admin Dashboard | Inquiries | Bookings |
| --- | --- | --- |
| <img src="assets/images/Admin%20Dashboard%28mobile%29.png" alt="Munch caterer mobile admin dashboard" width="180"> | <img src="assets/images/Inquiries%28mobile%29.png" alt="Munch caterer mobile inquiries screen" width="180"> | <img src="assets/images/Bookings%28mobile%29.png" alt="Munch caterer mobile bookings screen" width="180"> |

| Portfolio | Messages | Profile |
| --- | --- | --- |
| <img src="assets/images/Portfolio%28mobile%29.png" alt="Munch caterer mobile portfolio screen" width="180"> | <img src="assets/images/Message%28mobile%29.png" alt="Munch caterer mobile messaging screen" width="180"> | <img src="assets/images/Profile1%28mobile%29.png" alt="Munch caterer mobile profile screen" width="180"> |

| Profile Details | Profile Preview | Sign In | Login |
| --- | --- | --- | --- |
| <img src="assets/images/Profile2%28mobile%29.png" alt="Munch caterer mobile profile details screen" width="150"> | <img src="assets/images/Profile3%28mobile%29.png" alt="Munch caterer mobile profile preview screen" width="150"> | <img src="assets/images/sign-in%28mobile%29.png" alt="Munch caterer mobile sign in screen" width="150"> | <img src="assets/images/login%28mobile%29.png" alt="Munch caterer mobile login screen" width="150"> |

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
