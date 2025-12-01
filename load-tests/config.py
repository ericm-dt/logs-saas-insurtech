"""
Configuration constants for load testing.
"""

# Configuration: User segmentation for A/B testing and error scenarios
# Percentage of users in Group A (0-100). Group B gets the remainder.
GROUP_A_PERCENTAGE = 50  # Set to desired percentage (e.g., 50 = 50% Group A, 50% Group B)

# User session rotation: Re-login as a different user after N tasks to improve variety
# Set both to 0 to disable rotation (user stays same for entire session)
MIN_TASKS_BEFORE_ROTATION = 5   # Minimum tasks before rotation
MAX_TASKS_BEFORE_ROTATION = 15  # Maximum tasks before rotation

# Global storage for seeded data (populated during Locust initialization)
USERS = []
ORGANIZATIONS = []
