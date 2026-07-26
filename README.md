# Munch Catering

Munch Catering is a full-stack catering marketplace application built as a group project during my studies. The project combines a FastAPI backend and an Expo-based frontend to support caterer discovery, quote requests, bookings, messaging, portfolio management, and payment initiation flows.

This repository is now being framed as a stronger portfolio project by pairing the original application with infrastructure work in Terraform, CI/CD, and cloud deployment. The goal is not to pretend it is a mature production platform, but to show a credible end-to-end engineering journey from product idea to deployment readiness.

## Why this project is valuable for a portfolio

- It demonstrates full-stack product thinking, not only isolated frontend or backend work.
- It includes real application workflows such as customer-caterer interaction, booking management, and payments.
- It can be presented as a group project with clear ownership and collaboration experience.
- It becomes more compelling when paired with infrastructure and deployment work, especially Terraform, GitHub Actions, and AWS deployment practices.

## Deployment direction

The app is now prepared for an AWS EC2 deployment using Docker Compose.

The EC2 setup is intentionally simple and fits a free-tier portfolio deployment:

- web tier: Expo web build served by Nginx
- API tier: FastAPI backend running behind the web container
- data tier: MongoDB running as a private Compose service

## Project structure

- `munch_catering_backend` contains the FastAPI API, business logic, tests, and payment integration layer
- `munch-catering-frontend-expo` contains the Expo app for the customer and caterer experience
- `docker-compose.yml` runs the web, API, and database tiers together for EC2
- `.env.docker.example` shows the runtime values needed by the backend container

## Product scope

The application supports:

- customer sign-up, login, and account management
- caterer profile management and portfolio publishing
- quote requests and booking conversion
- booking lifecycle tracking
- direct customer-caterer messaging
- payment initiation with mock mode and M-Pesa Daraja support

## Tech stack

- Backend: FastAPI, Python, MongoDB via Motor
- Frontend: Expo, React Native, TypeScript
- Deployment: Docker Compose on AWS EC2
- Infrastructure: Terraform, AWS, CI/CD workflows

## Local development

### Backend

```bash
cd munch_catering_backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn munch_catering_backend.main:app --reload
```

### Frontend

```bash
cd munch-catering-frontend-expo
npm install
npx expo start
```

## Environment notes

- The backend uses a private `.env` file and includes `.env.example` for safe setup.
- The frontend can point at the backend through `EXPO_PUBLIC_API_URL`.
- In the Docker web build, the frontend calls the backend through `/api`, which Nginx proxies to the API container.
- Payment integrations should remain in test mode unless real sandbox credentials are configured.
- Real Daraja sandbox usage requires valid credentials and a public callback URL.

## Docker deployment

From the repository root:

```bash
cp .env.docker.example .env
docker compose up -d --build
```

The public entrypoint is the frontend container on port `80`. The backend is only reached through Nginx at `/api`, and MongoDB is not published to the host.

## CI/CD pipeline

The GitHub Actions workflow runs the checks before any EC2 deployment can happen:

- frontend dependency install, TypeScript check, lint, and web build
- backend dependency install and automated test suite
- Docker Compose validation
- backend and frontend image builds
- image vulnerability scans for high and critical findings

The deploy job only runs from the manual workflow button, and it depends on all checks passing first. It uses AWS Systems Manager to reach the EC2 instance, then pulls the selected branch and runs the three-tier Compose stack.

## Verification checks

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

## Portfolio framing

This project is strongest when described as a group project that evolved into a more complete engineering portfolio piece. In a professional context, the message should be:

- the application was built as a collaborative academic project
- it was then strengthened with modern engineering practices around deployment, infrastructure, and CI/CD
- it demonstrates both product development and operational awareness

## Notes
This repo is currently structured for straightforward local development. It is easy to evolve  later because the frontend and backend are already cleanly separated.
The app is currently evlolving for the cloud(Dockerization, Iac, and cloud deployment on AWS).
