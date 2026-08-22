"""
Loads .env once, at the earliest point any entrypoint imports anything from
`app`. Every script that reads an environment variable (GROQ_API_KEY,
DATABASE_URL, AUDIT_HMAC_KEY) should `import app.config` — or import anything
else from `app` that itself imports this — before touching os.environ.

This was a real bug in the first version of this scaffold: python-dotenv was
in requirements.txt but nothing ever called load_dotenv(), so .env silently
had no effect and GROQ_API_KEY only worked if set as a real OS environment
variable. Caught by actually running `python -m app.agent.graph` against a
real .env file.
"""
from dotenv import load_dotenv

load_dotenv()
