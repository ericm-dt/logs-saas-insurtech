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

# Processing delays: Probabilistically select items based on age (simulates realistic workflow variance)
# Instead of hard cutoffs, uses probability curves that favor items near the target age
# This prevents artificial clustering at boundaries and creates natural processing time variance
TARGET_QUOTE_AGE_MINUTES = 12   # Quotes are most likely to be converted around 12 minutes after creation
TARGET_CLAIM_AGE_MINUTES = 18   # Claims are most likely to be processed around 18 minutes after filing
TARGET_POLICY_AGE_MINUTES = 30  # Policies are most likely to be updated around 30 minutes after creation

# Global storage for seeded data (populated during Locust initialization)
USERS = []
ORGANIZATIONS = []
