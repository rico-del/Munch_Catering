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

    @app.get("/portfolio/images/{filename}")
    async def get_portfolio_image(filename: str):
        if settings.USE_S3_STORAGE and settings.S3_BUCKET_NAME:
            try:
                import boto3
                from fastapi.responses import RedirectResponse

                s3 = boto3.client("s3", region_name=settings.AWS_REGION)
                presigned_url = s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": settings.S3_BUCKET_NAME, "Key": f"portfolio_images/{filename}"},
                    ExpiresIn=3600,
                )
                return RedirectResponse(url=presigned_url, status_code=307)
            except Exception as exc:
                logger.warning("Failed generating presigned URL for %s: %s", filename, exc)
        local_path = settings.PORTFOLIO_DIR / filename
        if local_path.exists():
            from fastapi.responses import FileResponse

            return FileResponse(str(local_path))
        return JSONResponse(status_code=404, content={"detail": "Image not found"})

    app.mount("/portfolio/static_images", StaticFiles(directory=str(settings.PORTFOLIO_DIR)), name="portfolio_static_images")


    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception):
        logger.exception("Unhandled server error: %s", exc)
        return JSONResponse(status_code=500, content={"detail": "An internal server error occurred"})


    @app.get("/")
    async def root():
        return {"status": "Munch Catering API Online"}


    @app.get("/health")
    async def health():
        return {"status": "healthy", "service": "munch-catering-backend"}

    return app


app = create_app()
