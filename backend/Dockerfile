# Build context is the repository root, because the API imports src/core.
ARG PYTHON_IMAGE=python:3.12-slim
FROM ${PYTHON_IMAGE}

ARG PIP_INDEX_URL=
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/code
WORKDIR /code

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir ${PIP_INDEX_URL:+--index-url $PIP_INDEX_URL} -r backend/requirements.txt

COPY src ./src
COPY backend ./backend

RUN useradd --create-home app && chown -R app /code
USER app

EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
