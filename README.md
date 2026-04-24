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
