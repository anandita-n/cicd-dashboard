import os
import json
import time
import sys
import requests
from datetime import datetime

# Add project root to sys.path to allow running standalone from anywhere
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.database import engine, SessionLocal, Base
from backend.app.models import Build
from collector.utils import find_new_build_numbers, parse_jenkins_build_detail

# Ensure database tables are created
Base.metadata.create_all(bind=engine)

def load_config():
    # Load .env file manually if it exists to set environment variables
    env_file = os.path.join(project_root, ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        os.environ[k] = v
        except Exception as e:
            print(f"Error loading .env file: {e}")

    config = {
        "jenkins_url": "http://localhost:8080",
        "jobs": ["snap-link"],
        "poll_interval_seconds": 60,
        "db_path": "data/pipeline.db",
        "jenkins_user": "",
        "jenkins_token": ""
    }
    
    # Load config.json if present
    config_file = os.path.join(project_root, "config.json")
    if os.path.exists(config_file):
        try:
            with open(config_file, "r") as f:
                file_config = json.load(f)
                config.update(file_config)
        except Exception as e:
            print(f"Error loading config.json: {e}. Using defaults.")
            
    # Override from environment variables
    config["jenkins_url"] = os.getenv("JENKINS_URL", config["jenkins_url"])
    
    env_jobs = os.getenv("JENKINS_JOBS")
    if env_jobs:
        config["jobs"] = [j.strip() for j in env_jobs.split(",") if j.strip()]
        
    env_interval = os.getenv("POLL_INTERVAL")
    if env_interval:
        try:
            config["poll_interval_seconds"] = int(env_interval)
        except ValueError:
            pass
            
    config["jenkins_user"] = os.getenv("JENKINS_USER", config["jenkins_user"])
    config["jenkins_token"] = os.getenv("JENKINS_TOKEN", config["jenkins_token"])
            
    return config

def poll_job(job_name: str, config: dict, db):
    jenkins_url = config["jenkins_url"]
    user = config["jenkins_user"]
    token = config["jenkins_token"]
    
    auth = (user, token) if user and token else None
    
    print(f"[{datetime.now().isoformat()}] Polling job: {job_name}")
    api_url = f"{jenkins_url.rstrip('/')}/job/{job_name}/api/json"
    
    try:
        response = requests.get(api_url, auth=auth, timeout=10)
        if response.status_code == 404:
            print(f"Job '{job_name}' not found on Jenkins.")
            return
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to fetch job data for '{job_name}': {e}")
        return
        
    data = response.json()
    jenkins_builds = data.get("builds", [])
    
    # Fetch completed builds for this job from database (status is not BUILDING)
    completed_builds = db.query(Build.build_number).filter(
        Build.job_name == job_name,
        Build.status != "BUILDING"
    ).all()
    completed_numbers = {b[0] for b in completed_builds}
    
    new_numbers = find_new_build_numbers(jenkins_builds, completed_numbers)
    if not new_numbers:
        print(f"No new or in-progress builds to ingest/update for job '{job_name}'.")
        return
        
    print(f"Found {len(new_numbers)} builds to ingest or update: {new_numbers}")
    
    for num in new_numbers:
        build_api_url = f"{jenkins_url.rstrip('/')}/job/{job_name}/{num}/api/json"
        try:
            build_resp = requests.get(build_api_url, auth=auth, timeout=10)
            build_resp.raise_for_status()
            build_detail = build_resp.json()
        except Exception as e:
            print(f"Failed to fetch detail for build '{job_name}' #{num}: {e}")
            continue
            
        parsed = parse_jenkins_build_detail(job_name, num, build_detail)
        if parsed is None:
            continue
            
        # Check if build already exists in DB
        db_build = db.query(Build).filter(
            Build.job_name == job_name,
            Build.build_number == num
        ).first()
        
        if db_build:
            # Update existing build
            db_build.status = parsed["status"]
            db_build.started_at = parsed["started_at"].replace(tzinfo=None)
            db_build.duration_seconds = parsed["duration_seconds"]
            print(f"Updated '{job_name}' #{num} (Status: {parsed['status']}, Duration: {parsed['duration_seconds']}s)")
        else:
            # Insert new build
            db_build = Build(
                job_name=parsed["job_name"],
                build_number=parsed["build_number"],
                status=parsed["status"],
                started_at=parsed["started_at"].replace(tzinfo=None),  # SQLite naive DateTime
                duration_seconds=parsed["duration_seconds"]
            )
            db.add(db_build)
            print(f"Ingested '{job_name}' #{num} (Status: {parsed['status']}, Duration: {parsed['duration_seconds']}s)")
            
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Failed to save/update build '{job_name}' #{num} to DB: {e}")

def main():
    config = load_config()
    print("==================================================")
    print("Starting Jenkins CI/CD Data Collector...")
    print(f"Jenkins URL: {config['jenkins_url']}")
    print(f"Tracking Jobs: {config['jobs']}")
    print(f"Poll Interval: {config['poll_interval_seconds']} seconds")
    if config["jenkins_user"]:
        print(f"Authentication: Enabled (User: {config['jenkins_user']})")
    else:
        print("Authentication: Disabled (Anonymous)")
    print("==================================================")
    
    try:
        while True:
            db = SessionLocal()
            try:
                for job in config["jobs"]:
                    poll_job(job, config, db)
            except Exception as e:
                print(f"Unexpected error in polling iteration: {e}")
            finally:
                db.close()
                
            time.sleep(config["poll_interval_seconds"])
    except KeyboardInterrupt:
        print("\nStopping Jenkins CI/CD Data Collector. Goodbye!")

if __name__ == "__main__":
    main()
