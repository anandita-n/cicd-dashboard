from datetime import datetime, timedelta, date
from typing import List, Dict, Any

def compute_daily_failure_rate(builds: List[Dict[str, Any]], days: int, end_date: date = None) -> List[Dict[str, Any]]:
    """
    Computes failure rate grouped by day over the last N days.
    Only status == "FAILURE" counts as failed.
    """
    if end_date is None:
        end_date = datetime.now().date()
    
    # Generate the list of dates in the range, ordered chronologically
    date_list = [end_date - timedelta(days=x) for x in range(days)]
    date_list.reverse()
    
    builds_by_date = {}
    for b in builds:
        started_at = b.get("started_at")
        if isinstance(started_at, str):
            try:
                # Handle ISO format with possible timezone info or milliseconds
                # Replace 'Z' with '+00:00' to assist fromisoformat
                clean_str = started_at.replace("Z", "+00:00")
                dt = datetime.fromisoformat(clean_str)
                b_date = dt.date()
            except ValueError:
                continue
        elif isinstance(started_at, datetime):
            b_date = started_at.date()
        else:
            continue
        
        b_date_str = b_date.isoformat()
        if b_date_str not in builds_by_date:
            builds_by_date[b_date_str] = []
        builds_by_date[b_date_str].append(b)
        
    results = []
    for d in date_list:
        d_str = d.isoformat()
        day_builds = builds_by_date.get(d_str, [])
        total = len(day_builds)
        
        failed = sum(1 for b in day_builds if b.get("status") == "FAILURE")
        
        rate = 0.0
        if total > 0:
            rate = round(failed / total, 4)
            
        results.append({
            "date": d_str,
            "failure_rate": rate,
            "total_builds": total,
            "failed_builds": failed
        })
        
    return results

def compute_daily_duration_trend(builds: List[Dict[str, Any]], days: int, end_date: date = None) -> List[Dict[str, Any]]:
    """
    Computes average build duration in seconds grouped by day over the last N days.
    """
    if end_date is None:
        end_date = datetime.now().date()
        
    date_list = [end_date - timedelta(days=x) for x in range(days)]
    date_list.reverse()
    
    builds_by_date = {}
    for b in builds:
        started_at = b.get("started_at")
        if isinstance(started_at, str):
            try:
                clean_str = started_at.replace("Z", "+00:00")
                dt = datetime.fromisoformat(clean_str)
                b_date = dt.date()
            except ValueError:
                continue
        elif isinstance(started_at, datetime):
            b_date = started_at.date()
        else:
            continue
            
        b_date_str = b_date.isoformat()
        if b_date_str not in builds_by_date:
            builds_by_date[b_date_str] = []
        builds_by_date[b_date_str].append(b)
        
    results = []
    for d in date_list:
        d_str = d.isoformat()
        day_builds = builds_by_date.get(d_str, [])
        total = len(day_builds)
        
        avg_duration = 0.0
        if total > 0:
            total_duration = sum(float(b.get("duration_seconds", 0.0)) for b in day_builds)
            avg_duration = round(total_duration / total, 2)
            
        results.append({
            "date": d_str,
            "average_duration": avg_duration,
            "total_builds": total
        })
        
    return results

def compute_top_failing_jobs(builds: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Computes ranking of top failing jobs, sorted by failure count then failure rate.
    """
    job_stats = {}
    for b in builds:
        job_name = b.get("job_name")
        if not job_name:
            continue
        if job_name not in job_stats:
            job_stats[job_name] = {"total_builds": 0, "failed_builds": 0}
        
        job_stats[job_name]["total_builds"] += 1
        if b.get("status") == "FAILURE":
            job_stats[job_name]["failed_builds"] += 1
            
    results = []
    for job_name, stats in job_stats.items():
        total = stats["total_builds"]
        failed = stats["failed_builds"]
        rate = round(failed / total, 4) if total > 0 else 0.0
        results.append({
            "job_name": job_name,
            "failed_builds": failed,
            "failure_rate": rate,
            "total_builds": total
        })
        
    # Sort by failed builds (descending), then failure rate (descending)
    results.sort(key=lambda x: (x["failed_builds"], x["failure_rate"]), reverse=True)
    return results
