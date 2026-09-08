FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup -S munch && adduser -S munch -G munch

RUN apk add --no-cache --virtual .build-deps gcc musl-dev libffi-dev

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && apk del .build-deps

COPY main.py .
COPY munch_catering_backend ./munch_catering_backend
COPY portfolio_images ./portfolio_images

RUN chown -R munch:munch /app
USER munch

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "munch_catering_backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
