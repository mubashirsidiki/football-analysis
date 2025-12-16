"""
Centralized logging configuration with pretty, spacious formatting.
"""

import logging

from rich.console import Console
from rich.logging import RichHandler
from rich.traceback import install

# Install rich traceback handler for better error display
install(show_locals=True)

# Create console for rich output
console = Console()

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[
        RichHandler(
            console=console,
            rich_tracebacks=True,
            show_path=True,
            markup=True,
            show_time=True,
            show_level=True,
            tracebacks_show_locals=True,
        )
    ],
)

# Create logger instance
logger = logging.getLogger("football_analysis")

# Set log levels for different modules
logging.getLogger("uvicorn").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str = None):
    """Get a logger instance with the given name."""
    if name:
        return logging.getLogger(f"football_analysis.{name}")
    return logger
