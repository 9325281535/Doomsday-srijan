# 🚀 NexScheduler AI

<div align="center">
  <img src="https://img.shields.io/badge/Team-Doomsday-ef4444?style=for-the-badge&logo=github" alt="Team Doomsday">
  <img src="https://img.shields.io/badge/Event-SRIJAN_Phase_2-3b82f6?style=for-the-badge" alt="SRIJAN Phase 2">
  <img src="https://img.shields.io/badge/Domain-Job_Sequencing-00ff88?style=for-the-badge" alt="Job Sequencing">
</div>

<br>

**NexScheduler AI** is an intelligent, real-time job scheduling decision engine built by **Team Doomsday** for SRIJAN. 

It dynamically allocates compute resources (CPU, GPU, RAM) to competing jobs using a multi-factor scoring algorithm—combining urgency, aging, resource efficiency, and priority. Unlike legacy schedulers (FCFS, Round Robin), NexScheduler continuously re-evaluates every job, preempts lower-priority work when critical deadlines approach, and guarantees no job ever starves.

## 🎯 The Core IP: Dynamic Priority Score

Instead of static priorities, our engine recalculates a live score for every job, every 500ms tick:

```text
Dynamic Score = (W1 × Urgency) + (W2 × Aging) + (W3 × Resource Efficiency) + (W4 × Base Priority)
```
* **Urgency:** Spikes as a deadline approaches.
* **Aging:** Linearly grows the longer a job waits (Starvation Guard).
* **Resource Efficiency:** Favors jobs that fit perfectly into currently available CPU/GPU units.
* **AI Optimizer:** Weights (W1-W4) are self-tuned by an online gradient descent agent based on real-time miss rates.

## ✨ Key Features
- ⚡ **Real-Time Preemption:** Critical jobs instantly preempt (pause) lower-priority jobs.
- 🛡️ **Guaranteed Starvation Fix:** "Aging" ensures low-priority jobs eventually get executed.
- 🧠 **Explainability Panel:** Visually explains *why* the scheduler picked a specific job.
- ⚔️ **Algorithm Battle Mode:** Compares NexScheduler vs FCFS vs Round Robin vs Static Priority live on the same workload.
- 📊 **Real-time WebSockets:** Live dashboard updating without refreshes.

---

## 🛠️ Tech Stack
* **Frontend:** React 18, Next.js, Tailwind, WebSockets
* **Backend:** Python 3.11, FastAPI, Uvicorn, NumPy
* **Data/State:** Redis (In-memory queues)
* **Deployment:** Docker & Docker Compose

---

## 🏃‍♂️ How to Run (Quick Start)

### Option 1: Docker (Recommended)
```bash
# Clone the repository
git clone https://github.com/9325281535/Doomsday-srijan.git
cd Doomsday-srijan

# Build and start all services
docker-compose up --build

# Open the dashboard
http://localhost:3000/scheduler
```

### Option 2: Manual Run
**Terminal 1 (Backend):**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
**Terminal 2 (Frontend):**
```bash
cd frontend
npm install
npm run dev
# Go to http://localhost:3000/scheduler
```

---

## 🎬 Built-in Demo Scenarios

The dashboard includes 4 one-click demo scenarios for judges:
1. **⚡ Urgent Preemption:** A critical job arrives and immediately kicks out a running job.
2. **🐢 Starvation Fix:** A low-priority job ages up and eventually forces execution.
3. **🖥️ GPU Bottleneck:** Heavy GPU jobs contend, forcing CPU-only jobs to run to maximize throughput.
4. **⚔️ Algorithm Battle:** Evaluates all 4 algorithms and proves NexScheduler achieves the lowest deadline miss rate and highest utilization.

---
<div align="center">
  <i>Built with ❤️ by Team Doomsday for SRIJAN Hackathon</i>
</div>