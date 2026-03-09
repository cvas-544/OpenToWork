"""
OpenToWork — Agent API
FastAPI server exposing agent run endpoints for n8n orchestration.
"""

from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="OpenToWork Agent API")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/run/agent1")
def run_agent1():
    try:
        from agents.job_scraper import run
        result = run()
        return {"status": "ok", "new_jobs": len(result), "jobs": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent2")
def run_agent2():
    try:
        from agents.cv_matcher import run
        result = run()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent3")
def run_agent3():
    try:
        from agents.gap_analyst import run
        result = run()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent4")
def run_agent4():
    try:
        from agents.interview_coach import run
        result = run()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent5")
def run_agent5():
    try:
        from agents.reporter import run
        result = run()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent6")
def run_agent6():
    try:
        from agents.app_tracker import run
        result = run()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
