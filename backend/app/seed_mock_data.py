import os
import sys
import random
from datetime import datetime, timedelta, timezone

# Add project root to sys.path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.database import engine, SessionLocal, Base
from backend.app.models import Build

# Recreate tables if needed
Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()
    # Check if database has any existing data
    if db.query(Build).count() > 0:
        print("Database already has records. Skipping seeding.")
        db.close()
        return

    print("Seeding mock build history for testing...")
    
    # 38 builds of snap-link spread over the last 12 days
    now = datetime.now(timezone.utc)
    
    # snap-link builds (38 builds)
    for i in range(1, 39):
        # Simulating specific failure points
        status = "SUCCESS"
        if i in [5, 12, 13, 20, 28, 33]:
            status = "FAILURE"
        elif i in [8, 25]:
            status = "ABORTED"
            
        days_ago = (38 - i) * 0.3  # Roughly 3 builds per day
        started_at = now - timedelta(days=days_ago)
        
        # Duration: success runs take ~120s; failures fail fast (~30s)
        duration = random.uniform(90.0, 150.0)
        if status == "FAILURE":
            duration = random.uniform(15.0, 45.0)
            
        build = Build(
            job_name="snap-link",
            build_number=i,
            status=status,
            started_at=started_at.replace(tzinfo=None),
            duration_seconds=round(duration, 2)
        )
        db.add(build)
        
    # Seeding another mock job 'auth-service' for multi-job comparison (15 builds, higher failure rate)
    for i in range(1, 16):
        status = "SUCCESS"
        if i in [2, 3, 7, 8, 11, 14]:
            status = "FAILURE"
            
        days_ago = (15 - i) * 0.8
        started_at = now - timedelta(days=days_ago)
        duration = random.uniform(80.0, 240.0)
        if status == "FAILURE":
            duration = random.uniform(20.0, 50.0)
            
        build = Build(
            job_name="auth-service",
            build_number=i,
            status=status,
            started_at=started_at.replace(tzinfo=None),
            duration_seconds=round(duration, 2)
        )
        db.add(build)

    db.commit()
    print(f"Successfully seeded database with {db.query(Build).count()} mock builds!")
    db.close()

if __name__ == "__main__":
    seed()
