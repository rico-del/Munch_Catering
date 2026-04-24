from motor.motor_asyncio import AsyncIOMotorClient
from munch_catering_backend.settings import settings

# Centralized database configuration using pydantic BaseSettings
client = AsyncIOMotorClient(settings.MONGO_URL)

# Use the configured database name
# This is the database that will appear in MongoDB Compass
db = client[settings.DB_NAME]


def get_db():
    return db
