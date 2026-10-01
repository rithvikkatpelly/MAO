"""Process-wide coordination for work that needs the local model."""

import threading

# One heavy pipeline at a time: the local model serves a single request stream, so two
# concurrent runs just make both take roughly twice as long. Trend watch runs take it too.
pipeline_lock = threading.Lock()
