import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from munch_catering_backend.booking_api import router as booking
from munch_catering_backend.caterer_api import router as caterer
from munch_catering_backend.caterer_stats_api import router as admin_stats
from munch_catering_backend.messages_api import router as messages
from munch_catering_backend.payment_api import router as payment
from munch_catering_backend.portfolio_api import router as portfolio
from munch_catering_backend.search_api import router as search
from munch_catering_backend.settings import settings
from munch_catering_backend.user_auth import router as auth
from munch_catering_backend.user_profile_api import router as user_profile

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_app() -> FastAPI:
    settings.validate()
    app = FastAPI(title="Munch Catering API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth)
    app.include_router(user_profile)
    app.include_router(booking)
    app.include_router(payment)
    app.include_router(caterer)
    app.include_router(search)
    app.include_router(messages)
    app.include_router(admin_stats)
    app.include_router(portfolio)

    settings.PORTFOLIO_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/portfolio/images", StaticFiles(directory=str(settings.PORTFOLIO_DIR)), name="portfolio_images")


    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception):
        logger.exception("Unhandled server error: %s", exc)
        return JSONResponse(status_code=500, content={"detail": "An internal server error occurred"})


    @app.get("/")
    async def root():
        return {"status": "Munch Catering API Online"}

    return app


app = create_app()
