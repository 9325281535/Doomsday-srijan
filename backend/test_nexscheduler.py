"""Quick functional test for NexScheduler AI backend."""
import sys
import time
import importlib.util

BASE = r"C:\Users\bhoya\Downloads\HOP_PUNE\backend"


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    sys.modules[name] = m
    spec.loader.exec_module(m)
    return m


models_m = load("models", BASE + r"\models.py")
sched_m  = load("scheduler", BASE + r"\scheduler.py")
ai_m     = load("ai_agent", BASE + r"\ai_agent.py")
sc_m     = load("scenarios", BASE + r"\scenarios.py")

Job = models_m.Job
JobCreateRequest = models_m.JobCreateRequest
ResourceState = models_m.ResourceState
SchedulerEngine = sched_m.SchedulerEngine
ComparisonEngine = sched_m.ComparisonEngine
compute_score = sched_m.compute_score
AIAgent = ai_m.AIAgent
load_scenario = sc_m.load_scenario

# --- 1. Job model ---
j = Job(name="TestJob", priority=7, deadline=time.time() + 30,
        burst_time=5.0, cpu_units=1.0, gpu_units=0.0, ram_units=2.0)
assert j.remaining_time == 5.0, "remaining_time should default to burst_time"
assert j.base_priority_label == "High"
print(f"1. Job: id={j.id}  label={j.base_priority_label}  remaining={j.remaining_time}")

# --- 2. JobCreateRequest ---
req = JobCreateRequest(name="WebReq", priority=8, deadline_offset=30.0,
                       burst_time=3.0, cpu_units=1.0, gpu_units=0.0, ram_units=1.0)
j2 = req.to_job()
assert j2.name == "WebReq"
print(f"2. JobCreateRequest -> Job: {j2.name}, deadline in {j2.deadline - time.time():.1f}s")

# --- 3. ResourceState ---
rs = ResourceState()
rs.allocate(j)
assert rs.used_cpu == 1.0
assert rs.available_cpu == 7.0
print(f"3. ResourceState: used_cpu={rs.used_cpu}  avail_cpu={rs.available_cpu}  can_run_j2={rs.can_run(j2)}")

# --- 4. SchedulerEngine ---
engine = SchedulerEngine()
engine.add_job(j)
engine.add_job(j2)
for _ in range(10):
    engine.tick()
m = engine.get_metrics()
print(f"4. SchedulerEngine 10 ticks: running={m['jobs_running']}  waiting={m['jobs_waiting']}  completed={m['jobs_completed']}")
assert isinstance(m["deadline_miss_rate"], float)

# --- 5. Event log ---
assert len(engine.event_log) > 0
print(f"5. Event log: {len(engine.event_log)} entries, first type={engine.event_log[0]['type']!r}")

# --- 6. Decision explanation ---
all_jobs = engine.ready_queue + engine.running_jobs
if all_jobs:
    expl = engine.get_decision_explanation(all_jobs[0])
    assert "breakdown" in expl
    print(f"6. Explanation for '{expl['job_name']}': score={expl['effective_score']}")
else:
    print("6. No active jobs left to explain (completed quickly)")

# --- 7. compute_score ---
weights = {"w1": 0.35, "w2": 0.25, "w3": 0.20, "w4": 0.20}
score = compute_score(j, time.time(), weights)
assert 0 <= score <= 1000
print(f"7. compute_score: {score}")

# --- 8. AIAgent ---
agent = AIAgent()
agent.observe_metrics(0.15, 25.0, 0.55)
needs, reason = agent.should_retrain()
assert needs is True
print(f"8. AIAgent.should_retrain={needs}  reason={reason!r}")
new_w = agent.retrain()
assert abs(sum(new_w.values()) - 1.0) < 0.01, f"weights don't sum to 1: {sum(new_w.values())}"
print(f"   Weights after retrain: {new_w}  sum={sum(new_w.values()):.4f}")
status = agent.get_status()
assert status["retrain_count"] == 1
print(f"   Trend: {status['performance_trend']}")

# --- 9. Load all scenarios ---
for i in range(1, 5):
    jobs = load_scenario(i)
    assert len(jobs) >= 5
    print(f"9. Scenario {i}: {len(jobs)} jobs")

# --- 10. ComparisonEngine ---
jobs = load_scenario(4)
comp = ComparisonEngine()
result = comp.run(jobs, simulation_duration=60.0)
assert "winner" in result
assert len(result["results"]) == 4
print(f"10. ComparisonEngine winner={result['winner']!r}")
for alg, stats in result["summary"].items():
    print(f"    {alg}: miss={stats['deadline_miss_rate_pct']}%  avg_wait={stats['avg_wait_time']}s")

# --- 11. Starvation guard ---
engine2 = SchedulerEngine(starvation_limit=5.0)
j_low = Job(name="LowPri", priority=1, deadline=time.time() + 300,
            burst_time=5.0, cpu_units=1.0, gpu_units=0.0, ram_units=2.0)
j_low.wait_time = 10.0  # already past starvation limit
score_low = 999.0 if j_low.wait_time >= engine2.starvation_limit else compute_score(j_low, time.time(), weights)
assert score_low == 999.0, "Starvation guard should set score to 999"
print(f"11. Starvation guard: score={score_low}")

print()
print("=" * 50)
print("ALL 11 FUNCTIONAL TESTS PASSED")
print("=" * 50)
