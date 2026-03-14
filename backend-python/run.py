"""
Startup script for NeuroLex backend.
Sets PYTHONUTF8=1 before launching uvicorn so that print() never crashes
on Windows when Gemini returns emoji in its responses.
"""
import os, sys

os.environ["PYTHONUTF8"] = "1"
os.environ["PYTHONIOENCODING"] = "utf-8"

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("BACKEND_PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
