# Munch Catering Backend

This backend powers the Munch catering marketplace. It handles authentication, customer and caterer account flows, quote and booking management, messaging, portfolio uploads, and payment initiation.

The project is built with FastAPI and MongoDB-oriented data access. The current payment layer supports a safe local test mode and an M-Pesa Daraja integration path for sandbox or live environments.

## What This Service Does
- authenticates customers and caterers with JWTs
- exposes profile management routes for both users and caterers
- supports quote requests, booking creation, and lifecycle tracking
- stores and serves caterer portfolio images
- powers direct messaging between customers and caterers
- initiates deposit payments through either a mock provider or M-Pesa

## Local Setup
Create and activate a virtual environment, then install dependencies:

```bash
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

## Environment
Use `.env.example` as the starting point for your private `.env`.

Minimum required values:

```env
MONGO_URI=your_mongo_connection
SECRET_KEY=your_jwt_secret
ALGORITHM=HS256
```

Optional payment configuration:

```env
# Safe local default
PAYMENT_PROVIDER=test

# Real Daraja setup
# PAYMENT_PROVIDER=mpesa
# MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_SHORTCODE=
MPESA_CALLBACK_URL=
```

## Running The API
From this folder:

```bash
python -m uvicorn main:app --reload
```

You can also run the package-qualified entrypoint:

```bash
python -m uvicorn munch_catering_backend.main:app --reload
```

By default, the API will be available at `http://localhost:8000`.

## Payment Modes
- `PAYMENT_PROVIDER=test` is the recommended local default. It keeps payment flows deterministic and safe for development and automated tests.
- `PAYMENT_PROVIDER=mpesa` with `MPESA_ENV=sandbox` enables real Daraja sandbox requests when valid credentials and a public callback URL are configured.
- `PAYMENT_PROVIDER=mpesa` with `MPESA_ENV=live` is intended for production only.

Important notes:
- `MPESA_CALLBACK_URL` must be publicly reachable for real Daraja usage.
- `localhost` callback URLs will not work with Safaricom callbacks.

## Useful Files
- `main.py` keeps the local entrypoint simple
- `munch_catering_backend/main.py` creates and configures the FastAPI app
- `munch_catering_backend/user_auth.py` handles registration and login
- `munch_catering_backend/booking_api.py` manages booking and quote flows
- `munch_catering_backend/payment_api.py` handles payment initiation and callbacks
- `munch_catering_backend/payment_providers.py` contains the payment provider integration layer

## Checks
Run the backend test suite with:

```bash
python -m unittest discover -s tests -v
```

