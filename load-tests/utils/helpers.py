"""
Helper functions and decorators for load testing.
"""

import random
import logging
from config import GROUP_A_PERCENTAGE, MIN_TASKS_BEFORE_ROTATION, MAX_TASKS_BEFORE_ROTATION

logger = logging.getLogger(__name__)


def get_user_group(organization_id: str) -> str:
    """
    Deterministically assign a user to Group A or B based on their organization ID.
    Uses a hash function to ensure consistent assignment across all tasks.
    All users in the same organization will be in the same group.
    
    Args:
        organization_id: The organization's unique identifier
    
    Returns:
        'A' or 'B' based on GROUP_A_PERCENTAGE configuration
    """
    # Use hash of organization_id to get a consistent number
    hash_value = hash(organization_id)
    # Convert to percentage (0-99)
    percentage = abs(hash_value) % 100
    # Assign to Group A if below threshold, otherwise Group B
    return 'A' if percentage < GROUP_A_PERCENTAGE else 'B'


def get_user_agent(user_group: str) -> str:
    """
    Get User-Agent string based on user group to simulate different API clients.
    
    Args:
        user_group: 'A' or 'B'
    
    Returns:
        User-Agent header string
    """
    if user_group == 'A':
        return "InsureTech-API-Client/2.1.0 (Group-A)"
    else:
        return "InsureTech-API-Client/2.1.0 (Group-B)"


def with_rotation(task_func):
    """
    Decorator to automatically check for user rotation before executing a task.
    This avoids having to manually call check_rotation() in every task method.
    
    Usage:
        @task(5)
        @with_rotation
        def my_task(self):
            # Task implementation
    """
    def wrapper(self, *args, **kwargs):
        # Check if it's time to rotate to a different user
        if hasattr(self, 'rotation_threshold') and self.rotation_threshold > 0:
            self.task_count += 1
            if self.task_count >= self.rotation_threshold:
                logger.info(f"Rotating user after {self.task_count} tasks for variety")
                self.task_count = 0
                # Set new random threshold for next rotation
                self.rotation_threshold = random.randint(MIN_TASKS_BEFORE_ROTATION, MAX_TASKS_BEFORE_ROTATION)
                self.login()  # Re-login as a different random user
        
        # Execute the actual task
        return task_func(self, *args, **kwargs)
    
    return wrapper
