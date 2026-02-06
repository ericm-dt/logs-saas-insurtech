"""
Quote and policy management workflows.
"""

import random
import time
from datetime import datetime, timedelta
from locust import task
from behaviors.base import BaseAgentBehavior
from utils import with_rotation


class QuoteManagementBehavior(BaseAgentBehavior):
    """
    Simulates an agent managing quotes and policies:
    - Create quotes for customers
    - Convert quotes to policies
    - View and manage quotes/policies
    - Calculate premiums
    
    Inherits from BaseAgentBehavior which provides:
    - Automatic user rotation after 5-15 tasks (random threshold)
    - Organization-based Group A/B assignment
    - Shared login and authentication logic
    
    All tasks decorated with @with_rotation for automatic user variety.
    Tasks run sequentially (not concurrently) so no race conditions on self.token.
    """
    
    @task(5)
    @with_rotation
    def create_quote(self):
        """Create a new quote for a customer"""
        if not self.token:
            return
        
        policy_types = ["AUTO", "HOME", "LIFE", "HEALTH", "BUSINESS"]
        coverage_amounts = [25000, 50000, 100000, 250000, 500000, 1000000]
        
        selected_type = random.choice(policy_types)
        selected_coverage = random.choice(coverage_amounts)
        
        # Step 1: Calculate premium first (realistic agent workflow)
        headers = {
            "Authorization": f"Bearer {self.token}",
            "User-Agent": self.user_agent
        }
        
        with self.client.post(
            "/api/v1/quotes/calculate",
            json={
                "type": selected_type,
                "coverageAmount": selected_coverage
            },
            headers=headers,
            catch_response=True,
            name="1. Calculate Premium"
        ) as response:
            if response.status_code != 200:
                response.failure(f"Premium calculation failed: {response.status_code}")
                return
            response.success()
        
        # Agent discusses coverage options with customer, reviews their needs (3-6 seconds)
        time.sleep(random.uniform(3, 6))
        
        # Step 2: Create the quote
        quote_data = {
            "quoteNumber": f"QUO-{datetime.now().strftime('%Y%m%d')}-{random.randint(10000, 99999)}",
            "type": selected_type,
            "coverageAmount": selected_coverage,
            "expiresAt": (datetime.now() + timedelta(days=30)).isoformat()
        }
        
        with self.client.post(
            "/api/v1/quotes",
            json=quote_data,
            headers=headers,
            catch_response=True,
            name="2. Create Quote"
        ) as response:
            if response.status_code == 201:
                quote_id = response.json().get("data", {}).get("id")
                response.success()
            else:
                response.failure(f"Failed to create quote: {response.status_code}")
                return
        
        # Agent and customer review quote details together, discuss terms (4-8 seconds)
        time.sleep(random.uniform(4, 8))
        
        # Step 3: View the quote details
        self.client.get(
            f"/api/v1/quotes/{quote_id}",
            headers=headers,
            name="3. View Quote Details"
        )
    
    @task(3)
    @with_rotation
    def convert_quote_to_policy(self):
        """Find an active quote and convert it to a policy"""
        if not self.token:
            return
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "User-Agent": self.user_agent
        }
        
        # Step 1: Find active quotes
        with self.client.get(
            "/api/v1/quotes?status=ACTIVE&limit=20",
            headers=headers,
            catch_response=True,
            name="1. Find Active Quote"
        ) as response:
            if response.status_code != 200:
                response.failure("Failed to get quotes")
                return
            
            quotes = response.json().get("data", [])
            if not quotes:
                response.success()
                return
            
            quote = random.choice(quotes)
            quote_id = quote["id"]
            response.success()
        
        # Customer confirms they want to proceed, agent prepares conversion (3-7 seconds)
        time.sleep(random.uniform(3, 7))
        
        # Step 2: Convert to policy
        with self.client.post(
            f"/api/v1/quotes/{quote_id}/convert",
            headers=headers,
            catch_response=True,
            name="2. Convert to Policy"
        ) as response:
            if response.status_code in [200, 201]:  # Accept both 200 and 201
                policy_id = response.json().get("data", {}).get("policy", {}).get("id")
                response.success()
                
                # Agent reviews policy confirmation with customer, explains next steps (3-6 seconds)
                time.sleep(random.uniform(3, 6))
                
                # Step 3: View the new policy
                self.client.get(
                    f"/api/v1/policies/{policy_id}",
                    headers=headers,
                    name="3. View New Policy"
                )
            else:
                response.failure(f"Conversion failed: {response.status_code}")
    
    @task(3)
    @with_rotation
    def review_quotes_workflow(self):
        """Realistic workflow: Browse quotes -> View specific quote -> Check history"""
        if not self.token:
            return
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "User-Agent": self.user_agent
        }
        
        # Step 1: View all quotes with filters
        status_filter = random.choice(["ACTIVE", "CONVERTED", "EXPIRED", ""])
        type_filter = random.choice(["AUTO", "HOME", "LIFE", "HEALTH", "BUSINESS", ""])
        
        params = []
        if status_filter:
            params.append(f"status={status_filter}")
        if type_filter:
            params.append(f"type={type_filter}")
        params.append(f"page={random.randint(1, 2)}")
        params.append("limit=20")
        
        query = "&".join(params)
        with self.client.get(
            f"/api/v1/quotes?{query}",
            headers=headers,
            catch_response=True,
            name="1. Browse Quotes"
        ) as response:
            if response.status_code == 200:
                quotes = response.json().get("data", [])
                if quotes:
                    # Agent scans through the quote list, comparing options (3-7 seconds)
                    time.sleep(random.uniform(3, 7))
                    
                    # Step 2: View a specific quote
                    quote = random.choice(quotes)
                    self.client.get(
                        f"/api/v1/quotes/{quote['id']}",
                        headers=headers,
                        name="2. View Quote Details"
                    )
                    
                    # Agent thoroughly reviews all quote details, coverage amounts, terms (4-8 seconds)
                    time.sleep(random.uniform(4, 8))
                    
                    # Step 3: Check quote history
                    self.client.get(
                        f"/api/v1/quotes/{quote['id']}/history",
                        headers=headers,
                        name="3. View Quote History"
                    )
                response.success()
    
    @task(2)
    @with_rotation
    def update_policy_status(self):
        """Find a policy and update its status"""
        if not self.token:
            return
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "User-Agent": self.user_agent
        }
        
        # Step 1: Find policies to update
        status_filter = random.choice(["ACTIVE", "EXPIRED", ""])
        params = [f"page={random.randint(1, 2)}", "limit=20"]
        if status_filter:
            params.append(f"status={status_filter}")
        
        query = "&".join(params)
        with self.client.get(
            f"/api/v1/policies?{query}",
            headers=headers,
            catch_response=True,
            name="1. Find Policy to Update"
        ) as response:
            if response.status_code != 200:
                response.failure(f"Failed to get policies: {response.status_code}")
                return
            
            policies = response.json().get("data", [])
            response.success()  # Mark success even if empty
            if not policies:
                return
            
            # Agent reviews policy list looking for target policy (2-5 seconds)
            time.sleep(random.uniform(2, 5))
            
            policy = random.choice(policies)
            response.success()
        
        # Step 2: View specific policy
        self.client.get(
            f"/api/v1/policies/{policy['id']}",
            headers=headers,
            name="2. View Policy Details"
        )
        
        # Agent reads policy information and discusses with customer (5-9 seconds)
        time.sleep(random.uniform(5, 9))
        
        # Step 3: Update policy status
        new_status = random.choice(["ACTIVE", "CANCELLED"])
        status_reasons = {
            "CANCELLED": [
                "Customer request",
                "Non-payment of premium",
                "Policy no longer needed",
                "Switching to different provider"
            ],
            "ACTIVE": [
                "Reactivation after payment received",
                "Reinstatement approved"
            ]
        }
        self.client.put(
            f"/api/v1/policies/{policy['id']}",
            json={
                "status": new_status,
                "statusChangeReason": random.choice(status_reasons[new_status])
            },
            headers=headers,
            name="3. Update Policy Status"
        )
