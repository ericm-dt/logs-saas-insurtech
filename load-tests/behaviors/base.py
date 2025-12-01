"""
Base behavior class providing shared authentication and user rotation logic.
"""

import random
import logging
from locust import TaskSet
from config import USERS, MIN_TASKS_BEFORE_ROTATION, MAX_TASKS_BEFORE_ROTATION
from utils import get_user_group, get_user_agent

logger = logging.getLogger(__name__)


class BaseAgentBehavior(TaskSet):
    """
    Base class for all agent behaviors with shared functionality.
    Handles authentication, user rotation, and common setup.
    
    All child classes inherit:
    - on_start(): Initializes task counter and rotation threshold
    - login(): Authenticates as random user with Group A/B assignment
    
    Child classes should define @task decorated methods for specific workflows.
    """
    
    def on_start(self):
        """Initialize task counter and rotation threshold, then login"""
        self.task_count = 0
        # Set random rotation threshold for variety
        if MAX_TASKS_BEFORE_ROTATION > 0:
            self.rotation_threshold = random.randint(MIN_TASKS_BEFORE_ROTATION, MAX_TASKS_BEFORE_ROTATION)
        else:
            self.rotation_threshold = 0
        self.login()
    
    def login(self):
        """Authenticate as a random user for variety across organizations"""
        if not USERS:
            credentials = {
                "email": "agent@test.com",
                "password": "password123"
            }
            self.organization_id = "default-org"
        else:
            # Pick a random user for this entire session (user variety across concurrent HttpUser instances)
            user = random.choice(USERS)
            credentials = {
                "email": user["email"],
                "password": user["password"]
            }
            self.organization_id = user.get("organizationId", "unknown-org")
        
        # Determine user group (A or B) based on organization ID - consistent across all tasks
        # All users in the same organization will be in the same group
        self.user_group = get_user_group(self.organization_id)
        self.user_agent = get_user_agent(self.user_group)
        
        logger.info(f"User {credentials['email']} (org: {self.organization_id}) assigned to Group {self.user_group}")
        
        with self.client.post(
            "/api/v1/auth/login",
            json=credentials,
            headers={"User-Agent": self.user_agent},
            catch_response=True,
            name="Login"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("data", {}).get("token")
                # Update organization_id from response if available
                user_data = data.get("data", {}).get("user", {})
                if user_data.get("organizationId"):
                    self.organization_id = user_data.get("organizationId")
                    # Recalculate group in case organization_id changed
                    self.user_group = get_user_group(self.organization_id)
                    self.user_agent = get_user_agent(self.user_group)
                response.success()
            else:
                response.failure(f"Login failed: {response.status_code}")
                self.token = None
