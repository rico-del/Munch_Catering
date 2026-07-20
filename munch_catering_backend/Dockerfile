FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system munch && adduser --system --ingroup munch munch

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY munch_catering_backend ./munch_catering_backend
COPY portfolio_images ./portfolio_images

RUN chown -R munch:munch /app
USER munch

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "munch_catering_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
