# CI/CD Pipeline Observability Dashboard

A portfolio CI/CD pipeline observability dashboard that collects Jenkins build history and visualizes daily failure rates and build duration trends over time.

---

## Architecture & Technology Stack

- **Data Collector** (`collector/poll_jenkins.py`): Standalone Python daemon polling Jenkins REST APIs on a configurable interval. Decoupled parsing and duplicate-filtering logic (`collector/utils.py`).
- **Backend API** (`backend/app/main.py`): Fast, lightweight FastAPI server exposing pre-shaped endpoints for data charts. Pure testable aggregation logic (`backend/app/aggregation.py`).
- **Database** (`data/pipeline.db`): SQLite database with SQLAlchemy ORM models.
- **Frontend** (`frontend/`): React application built on Vite and styled with plain CSS (clean design, single blue accent, neutral background, no glassmorphism or glow effects), utilizing **Recharts** for visualizations.

---

## Why SQLite Was Chosen Over In-Memory Storage

For a CI/CD dashboard tracking historical statistics (e.g., 30-day build duration averages, 7-day failure trends):
1. **Persistence Across Restarts**: Historical data must survive service restarts. If we used an in-memory database (`sqlite:///:memory:`), stopping and starting the FastAPI server or the collector daemon would wipe out all gathered historical trends.
2. **Process Separation**: The data collector daemon and the FastAPI server run as separate, independent processes. An in-memory database cannot easily be shared between two running Python processes without complex IPC. Using a local SQLite file (`data/pipeline.db`) allows the collector to write new data while the FastAPI app concurrently reads it.
3. **Lightweight & Portable**: SQLite requires zero system installation or administration, keeping the repository self-contained and easily demonstrable.

---

## Quick Start Guide

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Python 3.8+**
- **Node.js 16+** (and npm)

---

### 2. Configuration & Credentials

The collector reads configuration from `config.json` in the root of the workspace. By default, it tracks the job `"snap-link"` on `http://localhost:8080`.

If your local Jenkins instance requires authentication, edit `config.json` to configure your credentials:
```json
{
  "jenkins_url": "http://localhost:8080",
  "jobs": ["snap-link"],
  "poll_interval_seconds": 60,
  "db_path": "data/pipeline.db",
  "jenkins_user": "YOUR_USERNAME",
  "jenkins_token": "YOUR_API_TOKEN_OR_PASSWORD"
}
```
*Note: To generate a Jenkins API token, go to `Jenkins -> Click User (top-right) -> Configure -> API Token -> Add new Token`.*

---

### 3. Immediate Testing: Seed Mock Data (Recommended)

To evaluate and demonstrate the dashboard immediately with 12 days of realistic build data (53 builds covering successes, failures, and aborts) without waiting for Jenkins pipelines:
```bash
python backend/app/seed_mock_data.py
```

---

### 4. Running the Components

Run each component in a separate terminal from the root workspace folder:

#### A. Run the Data Collector
Starts the daemon that polls the Jenkins REST API:
```bash
python collector/poll_jenkins.py
```

#### B. Run the Backend API
Starts the FastAPI web server:
```bash
uvicorn backend.app.main:app --reload
```
The API documentation will be available at `http://localhost:8000/docs`.

#### C. Run the React Frontend
Installs the node packages (if not already done) and runs the Vite dev server:
```bash
# Navigate to frontend folder and start Vite
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser to view the dashboard.

---

## Running Unit Tests

Unit tests cover the key business logic (duplicate detection, duration trend grouping, failure rate calculations, and handling jobs with zero builds safely):
```bash
python -m pytest backend/tests/
```
