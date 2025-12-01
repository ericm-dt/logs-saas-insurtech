"""
Claims processing workflows.
"""

import random
import time
from datetime import datetime, timedelta
from locust import task
from behaviors.base import BaseAgentBehavior
from utils import with_rotation


class ClaimsManagementBehavior(BaseAgentBehavior):
    """
    Simulates an agent managing claims:
    - File claims on behalf of customers
    - Review and update claim status
    - Approve or deny claims
    - View claim history
    
    Inherits from BaseAgentBehavior which provides:
    - Automatic user rotation after 5-15 tasks (random threshold)
    - Organization-based Group A/B assignment
    - Shared login and authentication logic
    
    All tasks decorated with @with_rotation for automatic user variety.
    Tasks run sequentially per HttpUser instance - no concurrency issues.
    """
    
    @task(5)
    @with_rotation
    def file_claim(self):
        """File a new claim on an active policy"""
        if not self.token:
            return
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "User-Agent": self.user_agent
        }
        
        # Step 1: Browse policies to find one for claim
        with self.client.get(
            "/api/v1/policies?status=ACTIVE&limit=20",
            headers=headers,
            catch_response=True,
            name="1. Find Active Policy"
        ) as response:
            if response.status_code != 200:
                response.failure("Failed to get policies")
                return
            
            policies = response.json().get("data", [])
            if not policies:
                response.success()
                return
            
            policy = random.choice(policies)
            response.success()
        
        # Customer explains the incident
        time.sleep(random.uniform(2, 4))
        
        # Step 2: File a claim on the policy
        claim_descriptions = [
            "Vehicle collision at intersection",
            "Home water damage from burst pipe",
            "Windshield damage from road debris",
            "Roof damage from storm",
            "Theft of personal property"
        ]
        
        claim_data = {
            "policyId": policy['id'],
            "claimNumber": f"CLM-{datetime.now().strftime('%Y%m%d')}-{random.randint(10000, 99999)}",
            "incidentDate": (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            "claimAmount": random.randint(1000, 50000),
            "description": random.choice(claim_descriptions)
        }
        
        with self.client.post(
            "/api/v1/claims",
            json=claim_data,
            headers=headers,
            catch_response=True,
            name="2. File Claim"
        ) as response:
            if response.status_code != 201:
                response.failure(f"Failed to file claim: {response.status_code}")
                return
            
            claim_id = response.json().get("data", {}).get("id")
            response.success()
        
        # Agent reviews the filed claim
        time.sleep(random.uniform(1, 3))
        
        # Step 3: View the claim details
        self.client.get(
            f"/api/v1/claims/{claim_id}",
            headers=headers,
            name="3. View Claim Details"
        )
    
    @task(3)
    @with_rotation
    def process_claim(self):
        """Find a submitted claim and process it through to approval/denial"""
        if not self.token:
            return
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "User-Agent": self.user_agent
        }
        
        # Step 1: Find claims to process
        status_to_find = random.choice(['SUBMITTED', 'UNDER_REVIEW'])
        with self.client.get(
            f"/api/v1/claims?status={status_to_find}&limit=20",
            headers=headers,
            catch_response=True,
            name="1. Find Claim to Process"
        ) as response:
            if response.status_code != 200:
                response.failure("Failed to get claims")
                return
            
            claims = response.json().get("data", [])
            if not claims:
                response.success()
                return
            
            claim = random.choice(claims)
            claim_id = claim['id']
            response.success()
        
        # Agent investigates the claim
        time.sleep(random.uniform(2, 5))
        
        # Step 2: Update to under_review (if not already)
        if status_to_find == 'SUBMITTED':
            self.client.put(
                f"/api/v1/claims/{claim_id}/status",
                json={"status": "UNDER_REVIEW"},
                headers=headers,
                name="2. Mark Under Review"
            )
            
            # Agent reviews documentation and makes decision
            time.sleep(random.uniform(3, 7))
        
        # Step 3: Approve or deny the claim (80% approval rate)
        final_status = "APPROVED" if random.random() < 0.8 else "DENIED"
        self.client.put(
            f"/api/v1/claims/{claim_id}/status",
            json={"status": final_status},
            headers=headers,
            name=f"3. {final_status.title()} Claim"
        )
        
        # Agent finalizes decision
        time.sleep(random.uniform(1, 2))
        
        # Step 4: Check claim history
        self.client.get(
            f"/api/v1/claims/{claim_id}/history",
            headers=headers,
            name="4. View Claim History"
        )
    
    @task(2)
    @with_rotation
    def review_claims_workflow(self):
        """Review existing claims workflow"""
        if not self.token:
            return
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "User-Agent": self.user_agent
        }
        
        # Step 1: Browse claims by status
        status = random.choice(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DENIED'])
        with self.client.get(
            f"/api/v1/claims?status={status}&page=1&limit=20",
            headers=headers,
            catch_response=True,
            name="1. Browse Claims"
        ) as response:
            if response.status_code == 200:
                claims = response.json().get("data", [])
                if claims:
                    # Agent scans claims queue
                    time.sleep(random.uniform(1, 3))
                    
                    # Step 2: View specific claim
                    claim = random.choice(claims)
                    self.client.get(
                        f"/api/v1/claims/{claim['id']}",
                        headers=headers,
                        name="2. View Claim Details"
                    )
                    
                    # Agent reads claim information
                    time.sleep(random.uniform(2, 4))
                    
                    # Step 3: View claim history
                    self.client.get(
                        f"/api/v1/claims/{claim['id']}/history",
                        headers=headers,
                        name="3. View Claim History"
                    )
                response.success()
