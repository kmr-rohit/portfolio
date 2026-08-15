ARG PYTHON_IMAGE=python:3.13.14-alpine3.23@sha256:9fdbf2e3e82628351513560b121e2ee6ce31cac212be9e070c5a5e2769fb5e76
FROM ${PYTHON_IMAGE}

RUN addgroup -S -g 10001 workbench \
    && adduser -S -D -H -u 10001 -G workbench workbench

WORKDIR /app
COPY --chown=10001:10001 app/server.py /app/server.py

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WORKBENCH_BIND_HOST=0.0.0.0 \
    WORKBENCH_PORT=8080 \
    REDIS_HOST=redis \
    REDIS_PORT=6379

USER 10001:10001
EXPOSE 8080

ENTRYPOINT ["python", "/app/server.py"]
