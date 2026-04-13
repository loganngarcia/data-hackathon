FROM python:3.12-slim

WORKDIR /app

COPY api/pyproject.toml .
COPY api/src/ src/

RUN pip install --no-cache-dir .

COPY data/moobu.duckdb data/moobu.duckdb

ENV MOOBU_DB_PATH=/app/data/moobu.duckdb

EXPOSE 8000

CMD ["uvicorn", "moobu_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
