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


def get_user_speed_factor(user_identifier: str) -> float:
    """
    Generate a consistent processing speed factor for a user based on their identifier.
    Creates realistic agent personality variance - some agents are naturally faster,
    others are more methodical and slower.
    
    Args:
        user_identifier: Unique user identifier (user ID preferred, email as fallback)
    
    Returns:
        Speed multiplier between 0.7 and 1.3:
        - 0.7 = fast agent (processes 30% faster)
        - 1.0 = average agent
        - 1.3 = slow/thorough agent (takes 30% longer)
    
    Examples:
        user-uuid-12345 -> 0.85 (slightly faster)
        user-uuid-67890 -> 1.15 (slightly slower)
        Same ID always returns same factor
    """
    import hashlib
    
    # Hash the identifier to get a consistent numeric value
    hash_value = int(hashlib.md5(user_identifier.encode()).hexdigest(), 16)
    # Normalize to 0.0-1.0 range
    normalized = (hash_value % 10000) / 10000.0
    # Map to 0.7-1.3 range (±30% variance)
    return 0.7 + (normalized * 0.6)


def get_user_agent(user_group: str) -> str:
    """
    Get User-Agent string based on user group to simulate different API clients.
    
    Args:
        user_group: 'A' or 'B'
    
    Returns:
        User-Agent header string
    """
    if user_group == 'A':
        return "DynaClaimz-API-Client/2.1.0 (Group-A)"
    else:
        return "DynaClaimz-API-Client/2.1.0 (Group-B)"


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


def calculate_age_probability(item_age_minutes: float, 
                               target_age_minutes: float,
                               decay_rate: float = 0.3) -> float:
    """
    Calculate probability of selecting an item based on its age using a bell curve.
    
    Probability increases as items approach the target age, then decreases for very old items.
    This creates natural variance in processing times rather than hard cutoffs.
    
    Args:
        item_age_minutes: How old the item is in minutes
        target_age_minutes: The "ideal" age for processing (peak of the curve)
        decay_rate: How quickly probability decays from peak (smaller = wider curve)
    
    Returns:
        Probability between 0 and 1
    
    Examples:
        - 1 min old item, target=10min: ~0.15 (low chance, but possible)
        - 10 min old item, target=10min: ~1.0 (peak probability)
        - 30 min old item, target=10min: ~0.37 (declining, but still possible)
        - 60 min old item, target=10min: ~0.14 (low chance)
    """
    import math
    
    # Don't process items less than 1 minute old (prevent immediate processing)
    if item_age_minutes < 1:
        return 0.0
    
    # Gaussian/bell curve: probability peaks at target_age, decays on both sides
    # Using exponential decay instead of strict Gaussian for more realistic tail behavior
    deviation = abs(item_age_minutes - target_age_minutes)
    probability = math.exp(-(decay_rate * deviation) / target_age_minutes)
    
    return max(0.0, min(1.0, probability))


def select_by_age_probability(items: list,
                               target_age_minutes: float,
                               timestamp_field: str = 'createdAt',
                               max_selections: int = 5) -> list:
    """
    Select items probabilistically based on their age, favoring items near target age.
    
    Instead of hard filtering (e.g., "only 5-20 min old"), this uses probability:
    - Very recent items: low chance (but not zero)
    - Items near target age: high chance
    - Very old items: medium-low chance (they still exist but are less desirable)
    
    This creates natural variance in processing times and prevents clustering at boundaries.
    
    Args:
        items: List of items to select from
        target_age_minutes: Preferred age for processing (e.g., 10 = prefer 10-minute-old items)
        timestamp_field: Field containing ISO timestamp (default: 'createdAt')
        max_selections: Maximum items to return (default: 5)
    
    Returns:
        Randomly selected items weighted by age probability
    
    Example:
        # Select claims probabilistically, preferring those around 15 minutes old
        claims = select_by_age_probability(all_claims, target_age_minutes=15)
    """
    from datetime import datetime
    import random
    
    if not items:
        return []
    
    now = datetime.now()
    weighted_items = []
    
    for item in items:
        timestamp_str = item.get(timestamp_field)
        if not timestamp_str:
            continue
        
        try:
            # Parse ISO 8601 timestamp
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            timestamp = timestamp.replace(tzinfo=None)
            
            # Calculate age in minutes
            age_minutes = (now - timestamp).total_seconds() / 60
            
            # Calculate probability based on age
            probability = calculate_age_probability(age_minutes, target_age_minutes)
            
            # Store item with its probability weight
            weighted_items.append((item, probability))
        except (ValueError, AttributeError):
            continue
    
    if not weighted_items:
        return []
    
    # Sort by probability (descending) for easier weighted selection
    weighted_items.sort(key=lambda x: x[1], reverse=True)
    
    # Perform weighted random selection
    selected = []
    remaining_items = weighted_items.copy()
    
    for _ in range(min(max_selections, len(remaining_items))):
        if not remaining_items:
            break
        
        # Extract items and weights
        items_list = [item for item, _ in remaining_items]
        weights = [weight for _, weight in remaining_items]
        
        # Weighted random choice
        chosen = random.choices(items_list, weights=weights, k=1)[0]
        selected.append(chosen)
        
        # Remove selected item from remaining pool
        remaining_items = [(item, weight) for item, weight in remaining_items if item != chosen]
    
    return selected
