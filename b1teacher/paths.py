import os
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("B1_TEACHER_DATA", PROJECT / ".local")).resolve()
