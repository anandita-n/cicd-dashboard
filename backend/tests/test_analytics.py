from datetime import datetime, date, timezone
from collector.utils import find_new_build_numbers, parse_jenkins_build_detail
from backend.app.aggregation import (
    compute_daily_failure_rate,
    compute_daily_duration_trend,
    compute_top_failing_jobs
)

# Test duplicate build detection
def test_find_new_build_numbers():
    jenkins_builds = [
        {"number": 40},
        {"number": 39},
        {"number": 38},
        {"number": 37}
    ]
    existing = {37, 38}
    new_numbers = find_new_build_numbers(jenkins_builds, existing)
    # Should find 39 and 40, sorted ascending
    assert new_numbers == [39, 40]

def test_find_new_build_numbers_empty():
    assert find_new_build_numbers([], {1, 2}) == []
    assert find_new_build_numbers([{"number": 1}], set()) == [1]

# Test parsing details
def test_parse_jenkins_build_detail_completed():
    detail = {
        "result": "SUCCESS",
        "timestamp": 1689031200000, # 2023-07-11 00:40:00 UTC
        "duration": 123400 # 123.4 seconds
    }
    parsed = parse_jenkins_build_detail("snap-link", 12, detail)
    assert parsed is not None
    assert parsed["job_name"] == "snap-link"
    assert parsed["build_number"] == 12
    assert parsed["status"] == "SUCCESS"
    assert parsed["duration_seconds"] == 123.4
    assert parsed["started_at"].year == 2023

def test_parse_jenkins_build_detail_in_progress():
    detail = {
        "result": None,
        "timestamp": 1689031200000,
        "duration": 0
    }
    parsed = parse_jenkins_build_detail("snap-link", 13, detail)
    assert parsed is not None
    assert parsed["status"] == "BUILDING"

# Test failure rate logic
def test_compute_daily_failure_rate():
    end = date(2026, 7, 11)
    builds = [
        {"started_at": "2026-07-11T10:00:00Z", "status": "SUCCESS"},
        {"started_at": "2026-07-11T11:00:00Z", "status": "FAILURE"},
        {"started_at": "2026-07-10T12:00:00Z", "status": "FAILURE"},
        {"started_at": "2026-07-10T13:00:00Z", "status": "ABORTED"}, # Should be counted as total, but not failed
        {"started_at": "2026-07-09T08:00:00Z", "status": "SUCCESS"}
    ]
    
    # 3 days window (9th, 10th, 11th)
    rates = compute_daily_failure_rate(builds, days=3, end_date=end)
    
    assert len(rates) == 3
    # Rates should be chronological: 9th, 10th, 11th
    # 9th: 1 SUCCESS -> total = 1, failed = 0 -> rate = 0.0
    assert rates[0]["date"] == "2026-07-09"
    assert rates[0]["total_builds"] == 1
    assert rates[0]["failure_rate"] == 0.0
    
    # 10th: 1 FAILURE, 1 ABORTED -> total = 2, failed = 1 -> rate = 0.5
    assert rates[1]["date"] == "2026-07-10"
    assert rates[1]["total_builds"] == 2
    assert rates[1]["failed_builds"] == 1
    assert rates[1]["failure_rate"] == 0.5
    
    # 11th: 1 SUCCESS, 1 FAILURE -> total = 2, failed = 1 -> rate = 0.5
    assert rates[2]["date"] == "2026-07-11"
    assert rates[2]["total_builds"] == 2
    assert rates[2]["failed_builds"] == 1
    assert rates[2]["failure_rate"] == 0.5

def test_compute_daily_failure_rate_zero_builds():
    end = date(2026, 7, 11)
    rates = compute_daily_failure_rate([], days=2, end_date=end)
    assert len(rates) == 2
    assert rates[0]["date"] == "2026-07-10"
    assert rates[0]["total_builds"] == 0
    assert rates[0]["failure_rate"] == 0.0
    assert rates[1]["date"] == "2026-07-11"
    assert rates[1]["total_builds"] == 0
    assert rates[1]["failure_rate"] == 0.0

# Test duration trend logic
def test_compute_daily_duration_trend():
    end = date(2026, 7, 11)
    builds = [
        {"started_at": "2026-07-11T10:00:00Z", "duration_seconds": 100.0},
        {"started_at": "2026-07-11T11:00:00Z", "duration_seconds": 200.0},
        {"started_at": "2026-07-09T08:00:00Z", "duration_seconds": 150.0}
    ]
    
    trends = compute_daily_duration_trend(builds, days=3, end_date=end)
    assert len(trends) == 3
    # 9th: 150.0
    assert trends[0]["date"] == "2026-07-09"
    assert trends[0]["average_duration"] == 150.0
    # 10th: 0 builds
    assert trends[1]["date"] == "2026-07-10"
    assert trends[1]["average_duration"] == 0.0
    # 11th: avg of 100 and 200 -> 150.0
    assert trends[2]["date"] == "2026-07-11"
    assert trends[2]["average_duration"] == 150.0

# Test top failing jobs logic
def test_compute_top_failing_jobs():
    builds = [
        {"job_name": "snap-link", "status": "FAILURE"},
        {"job_name": "snap-link", "status": "SUCCESS"},
        {"job_name": "snap-link", "status": "FAILURE"}, # snap-link: 3 builds, 2 failures
        {"job_name": "other-job", "status": "FAILURE"}, # other-job: 1 build, 1 failure
        {"job_name": "good-job", "status": "SUCCESS"}   # good-job: 1 build, 0 failures
    ]
    
    ranking = compute_top_failing_jobs(builds)
    assert len(ranking) == 3
    
    # snap-link should be first because it has 2 failed builds (more than other-job's 1)
    assert ranking[0]["job_name"] == "snap-link"
    assert ranking[0]["failed_builds"] == 2
    assert ranking[0]["failure_rate"] == round(2/3, 4)
    
    # other-job is second (1 failure)
    assert ranking[1]["job_name"] == "other-job"
    assert ranking[1]["failed_builds"] == 1
    assert ranking[1]["failure_rate"] == 1.0
    
    # good-job is last (0 failures)
    assert ranking[2]["job_name"] == "good-job"
    assert ranking[2]["failed_builds"] == 0
    assert ranking[2]["failure_rate"] == 0.0
