"""FastAPI application entry point."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import get_db, init_tables
from .routes import router

app = FastAPI(title="Moobu API", version="0.1.0")

_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
def startup():
    db = get_db()
    init_tables(db)


@app.get("/api/health")
def health():
    return {"status": "ok"}
