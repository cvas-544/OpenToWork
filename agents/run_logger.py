"""
Shared automation run logger.
Writes agent execution results to the automation_logs table.

Usage:
    from agents.run_logger import RunLogger

    logger = RunLogger(run_id="abc-123", agent_name="Agent 2 — CV Matcher")
    logger.start()
    ...
    logger.success(jobs_scored=21, jobs_passed=16)
    # or
    logger.fail(error="Connection timeout")
"""

import os
import json
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()


class RunLogger:
    def __init__(self, run_id: str, agent_name: str):
        self.run_id = run_id
        self.agent_name = agent_name
        self.started_at = None
        self.log_id = None

    def _conn(self):
        return psycopg2.connect(os.environ["DATABASE_URL"])

    def start(self):
        self.started_at = datetime.now()
        conn = self._conn()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO automation_logs (run_id, agent_name, status, started_at)
               VALUES (%s, %s, 'running', %s) RETURNING id""",
            (self.run_id, self.agent_name, self.started_at),
        )
        self.log_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

    def success(self, jobs_found=None, jobs_scored=None, jobs_passed=None, details=None):
        conn = self._conn()
        cur = conn.cursor()
        cur.execute(
            """UPDATE automation_logs SET
               status = 'success',
               completed_at = %s,
               jobs_found = %s,
               jobs_scored = %s,
               jobs_passed = %s,
               details = %s
               WHERE id = %s""",
            (
                datetime.now(),
                jobs_found,
                jobs_scored,
                jobs_passed,
                json.dumps(details) if details else None,
                self.log_id,
            ),
        )
        conn.commit()
        cur.close()
        conn.close()

    def fail(self, error: str, details=None):
        conn = self._conn()
        cur = conn.cursor()
        cur.execute(
            """UPDATE automation_logs SET
               status = 'failed',
               completed_at = %s,
               error_message = %s,
               details = %s
               WHERE id = %s""",
            (
                datetime.now(),
                str(error)[:1000],
                json.dumps(details) if details else None,
                self.log_id,
            ),
        )
        conn.commit()
        cur.close()
        conn.close()
