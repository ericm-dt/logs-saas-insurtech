"""
Locust load testing entry point for InsureTech SaaS API

This script simulates insurance agents performing typical workflow tasks:
1. Quote Management: Login → Create quotes → Convert to policies → Manage policies
2. Claims Management: Login → File claims → Review claims → Approve/deny claims

Features:
- User Segmentation: Organization-based A/B grouping with configurable percentage split
- User Rotation: Automatic re-login as different users after random task count (5-15 tasks)
- Realistic Delays: Random sleep statements (1-7 seconds) between workflow steps
- Decorator Pattern: @with_rotation decorator handles automatic user rotation
- Base Class Inheritance: BaseAgentBehavior provides shared authentication logic
- User-Agent Headers: All requests include group identifier (Group-A or Group-B)

All users are insurance professionals (agents) acting on behalf of customers.
The script loads existing users and organizations on startup.

Configuration:
- config.py: Adjust GROUP_A_PERCENTAGE and rotation thresholds
- behaviors/: Workflow implementations for different agent types
- utils/: Helper functions and decorators

Run with: locust --host=http://localhost:3000
"""

import logging
from locust import HttpUser, between, events
from behaviors import QuoteManagementBehavior, ClaimsManagementBehavior
from config import USERS, ORGANIZATIONS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@events.init.add_listener
def on_locust_init(environment, **kwargs):
    """
    Load existing users and organizations when Locust starts.
    This runs once before any users are spawned.
    Note: Organization and user endpoints are open (no auth required) for backstage operations.
    """
    logger.info("Loading seeded users and organizations...")
    
    # Use a requests session for initial setup
    import requests
    base_url = environment.host or "http://localhost:3000"
    
    try:
        # Fetch organizations (no authentication required - backstage endpoint)
        try:
            response = requests.get(
                f"{base_url}/api/v1/organizations",
                timeout=10
            )
            if response.status_code == 200:
                orgs = response.json().get("data", [])
                ORGANIZATIONS.extend(orgs)
                logger.info(f"Loaded {len(ORGANIZATIONS)} organizations")
            else:
                logger.warning(f"Failed to fetch organizations: {response.status_code}")
        except Exception as e:
            logger.error(f"Error fetching organizations: {e}")
        
        # Fetch all users (no authentication required - backstage endpoint)
        try:
            response = requests.get(
                f"{base_url}/api/v1/users",
                timeout=10
            )
            if response.status_code == 200:
                users_data = response.json().get("data", [])
                # Store users with default password (all seeded users have the same password)
                for user in users_data:
                    USERS.append({
                        "email": user["email"],
                        "password": "password123",  # Default password for all seeded users
                        "id": user["id"],
                        "role": user.get("role"),
                        "organizationId": user.get("organizationId")
                    })
                logger.info(f"Loaded {len(USERS)} users from database")
            else:
                logger.warning(f"Failed to fetch users: {response.status_code}")
        except Exception as e:
            logger.error(f"Error fetching users: {e}")
        
    except Exception as e:
        logger.error(f"Error during initialization: {e}")
        logger.info("Continuing with limited test data")


# User classes - define different user types with different behaviors and weights
# All users are insurance agents/professionals performing different tasks

class QuoteAgent(HttpUser):
    """
    Agent focused on quote and policy management - 50% of traffic.
    
    Simulates insurance agents who:
    - Create customer quotes
    - Calculate premiums
    - Convert quotes to policies
    - Manage policy status
    """
    tasks = [QuoteManagementBehavior]
    wait_time = between(1, 3)  # Wait 1-3 seconds between task executions
    weight = 50


class ClaimsAgent(HttpUser):
    """
    Agent focused on claims processing - 50% of traffic.
    
    Simulates insurance agents who:
    - File claims on behalf of customers
    - Review and process claims
    - Approve or deny claims
    - Track claim history
    """
    tasks = [ClaimsManagementBehavior]
    wait_time = between(2, 4)  # Wait 2-4 seconds between task executions
    weight = 50
