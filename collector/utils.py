from datetime import datetime, timezone
from typing import List, Dict, Set, Any, Optional

def find_new_build_numbers(jenkins_builds: List[Dict[str, Any]], existing_build_numbers: Set[int]) -> List[int]:
    """
    Given a list of builds from Jenkins API (each item having a "number" key)
    and a set of build numbers already in the DB, returns sorted list of new build numbers.
    """
    new_numbers = []
    for b in jenkins_builds:
        num = b.get("number")
        if isinstance(num, int) and num not in existing_build_numbers:
            new_numbers.append(num)
    # Sort ascending so we process and save oldest builds first
    new_numbers.sort()
    return new_numbers

def parse_jenkins_build_detail(job_name: str, build_number: int, detail: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Parses a single build detail dictionary from Jenkins API.
    Returns parsed dictionary or None if the build is in progress (result is None).
    """
    result = detail.get("result")
    if result is None:
        # Build is in progress
        return None
        
    timestamp_ms = detail.get("timestamp")
    duration_ms = detail.get("duration", 0)
    
    if timestamp_ms is not None:
        # Convert millisecond epoch to datetime object in UTC timezone
        started_at = datetime.fromtimestamp(timestamp_ms / 1000.0, tz=timezone.utc)
    else:
        started_at = datetime.now(timezone.utc)
        
    duration_seconds = float(duration_ms) / 1000.0 if duration_ms else 0.0
    
    return {
        "job_name": job_name,
        "build_number": build_number,
        "status": str(result).upper(),
        "started_at": started_at,
        "duration_seconds": duration_seconds
    }
