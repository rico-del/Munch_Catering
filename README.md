# Munch App

Munch App is a two-part catering marketplace project built around a FastAPI backend and an Expo frontend. The product supports caterer discovery, quote requests, bookings, messaging, portfolio management, and deposit payment flows.

This repository is organized as a simple monorepo with one folder for the backend and one for the frontend.

## Project Structure
- `munch_catering_backend` contains the FastAPI API, business logic, tests, and payment integration layer
- `munch-catering-frontend-expo` contains the Expo app for customer and caterer workflows

## What The Product Covers
- customer signup, login, and account management
- caterer profile management and portfolio publishing
- quote requests and booking conversion
- booking lifecycle tracking
- direct customer-caterer messaging
- payment initiation with mock mode and M-Pesa Daraja support

## Screenshots

The app presents two connected experiences: the web interface highlights the customer journey, while the native mobile interface focuses on caterer operations.

### Customer Web Experience

| Home | Discover |
| --- | --- |
| <img src="munch-catering-frontend-expo/assets/images/Home%28web%29.png" alt="Munch customer web home screen" width="420"> | <img src="munch-catering-frontend-expo/assets/images/Discover%28web%29.png" alt="Munch customer web caterer discovery screen" width="420"> |

| Bookings | Messages |
| --- | --- |
| <img src="munch-catering-frontend-expo/assets/images/Bookings%28web%29.png" alt="Munch customer web bookings screen" width="420"> | <img src="munch-catering-frontend-expo/assets/images/Message%28web%29.png" alt="Munch customer web messaging screen" width="420"> |

| Profile | Settings |
| --- | --- |
| <img src="munch-catering-frontend-expo/assets/images/Profile%28web%29.png" alt="Munch customer web profile screen" width="420"> | <img src="munch-catering-frontend-expo/assets/images/Settings%28web%29.png" alt="Munch customer web settings screen" width="420"> |

| Sign In | Login |
| --- | --- |
| <img src="munch-catering-frontend-expo/assets/images/sign-in%28web%29.png" alt="Munch customer web sign in screen" width="420"> | <img src="munch-catering-frontend-expo/assets/images/login%28web%29.png" alt="Munch customer web login screen" width="420"> |

### Caterer Native Mobile Experience

| Admin Dashboard | Inquiries | Bookings |
| --- | --- | --- |
| <img src="munch-catering-frontend-expo/assets/images/Admin%20Dashboard%28mobile%29.png" alt="Munch caterer mobile admin dashboard" width="180"> | <img src="munch-catering-frontend-expo/assets/images/Inquiries%28mobile%29.png" alt="Munch caterer mobile inquiries screen" width="180"> | <img src="munch-catering-frontend-expo/assets/images/Bookings%28mobile%29.png" alt="Munch caterer mobile bookings screen" width="180"> |

| Portfolio | Messages | Profile |
| --- | --- | --- |
| <img src="munch-catering-frontend-expo/assets/images/Portfolio%28mobile%29.png" alt="Munch caterer mobile portfolio screen" width="180"> | <img src="munch-catering-frontend-expo/assets/images/Message%28mobile%29.png" alt="Munch caterer mobile messaging screen" width="180"> | <img src="munch-catering-frontend-expo/assets/images/Profile1%28mobile%29.png" alt="Munch caterer mobile profile screen" width="180"> |

| Profile Details | Profile Preview | Sign In | Login |
| --- | --- | --- | --- |
| <img src="munch-catering-frontend-expo/assets/images/Profile2%28mobile%29.png" alt="Munch caterer mobile profile details screen" width="150"> | <img src="munch-catering-frontend-expo/assets/images/Profile3%28mobile%29.png" alt="Munch caterer mobile profile preview screen" width="150"> | <img src="munch-catering-frontend-expo/assets/images/sign-in%28mobile%29.png" alt="Munch caterer mobile sign in screen" width="150"> | <img src="munch-catering-frontend-expo/assets/images/login%28mobile%29.png" alt="Munch caterer mobile login screen" width="150"> |

## Running The Project Locally

### Backend
```bash
cd munch_catering_backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Frontend
```bash
cd munch-catering-frontend-expo
npm install
npx expo start
```

## Local Environment Notes
- The backend uses a private `.env` file and includes `.env.example` for safe setup.
- The frontend can point at the backend through `EXPO_PUBLIC_API_BASE_URL`.
- For safe local work, the backend payment provider can remain in `test` mode.
- Real Daraja sandbox usage requires valid credentials and a public callback URL.

## Checks

### Backend
```bash
cd munch_catering_backend
python -m unittest discover -s tests -v
```

### Frontend
```bash
cd munch-catering-frontend-expo
npx tsc --noEmit
npm run lint
```


## Notes
This repo is currently structured for straightforward local development. It is easy to evolve  later because the frontend and backend are already cleanly separated.
