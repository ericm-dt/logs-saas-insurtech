"""
Behavior modules for Locust load testing.
Each behavior class represents a distinct user workflow.
"""

from .base import BaseAgentBehavior
from .quote_behavior import QuoteManagementBehavior
from .claims_behavior import ClaimsManagementBehavior

__all__ = [
    'BaseAgentBehavior',
    'QuoteManagementBehavior',
    'ClaimsManagementBehavior',
]
