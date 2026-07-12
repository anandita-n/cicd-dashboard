from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os

from .database import get_db, Base, engine
from .models import Build
from .aggregation import (
    compute_daily_failure_rate,
    compute_daily_duration_trend,
    compute_top_failing_jobs
)

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Jenkins CI/CD Observability Dashboard API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Open to all origins for portfolio convenience
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/builds/recent")
def get_recent_builds(
    limit: int = Query(20, ge=1, le=100),
    job: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns the most recent builds, ordered by build number and start time descending.
    """
    query = db.query(Build)
    if job:
        query = query.filter(Build.job_name == job)
    builds = query.order_by(Build.started_at.desc(), Build.build_number.desc()).limit(limit).all()
    return [b.to_dict() for b in builds]

@app.get("/api/stats/failure-rate")
def get_failure_rate(
    days: int = Query(7, ge=1, le=90),
    job: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns daily failure rate stats over the last N days.
    """
    query = db.query(Build)
    if job:
        query = query.filter(Build.job_name == job)
    builds = query.all()
    build_dicts = [b.to_dict() for b in builds]
    return compute_daily_failure_rate(build_dicts, days=days)

@app.get("/api/stats/duration-trend")
def get_duration_trend(
    job: str = Query(..., min_length=1),
    days: int = Query(30, ge=1, le=180),
    db: Session = Depends(get_db)
):
    """
    Returns the average duration of builds per day over the last N days for a specific job.
    """
    builds = db.query(Build).filter(Build.job_name == job).all()
    build_dicts = [b.to_dict() for b in builds]
    return compute_daily_duration_trend(build_dicts, days=days)

@app.get("/api/stats/top-failing-jobs")
def get_top_failing_jobs(
    job: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns all jobs ranked by failure count and failure rate.
    """
    query = db.query(Build)
    if job:
        query = query.filter(Build.job_name == job)
    builds = query.all()
    build_dicts = [b.to_dict() for b in builds]
    return compute_top_failing_jobs(build_dicts)
