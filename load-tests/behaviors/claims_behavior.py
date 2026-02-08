"""
Claims processing workflows.
"""

import random
import time
from datetime import datetime, timedelta
from locust import task
from behaviors.base import BaseAgentBehavior
from utils import with_rotation
from utils.helpers import select_by_age_probability
from config import TARGET_CLAIM_AGE_MINUTES


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
    
    @task(4)
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
                response.failure(f"Failed to get policies: {response.status_code}")
                return
            
            policies = response.json().get("data", [])
            response.success()  # Mark success even if empty
            if not policies:
                return
            
            policy = random.choice(policies)
            response.success()
        
        # Agent discusses which policy applies, customer explains incident details, agent takes notes (5-10 seconds)
        # Apply user's speed factor for realistic variance
        time.sleep(random.uniform(5, 10) * self.user_speed_factor)
        
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
        
        # Agent reviews the filed claim confirmation and provides claim number to customer (2-4 seconds)
        time.sleep(random.uniform(2, 4) * self.user_speed_factor)
        
        # Step 3: View the claim details
        self.client.get(
            f"/api/v1/claims/{claim_id}",
            headers=headers,
            name="3. View Claim Details"
        )
    
    @task(4)
    @with_rotation
    def process_claim(self):
        """Probabilistically select a claim to process based on age (favors ~18 min old claims)"""
        if not self.token:
            return
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "User-Agent": self.user_agent
        }
        
        # Step 1: Fetch claims and select probabilistically by age
        status_to_find = random.choice(['SUBMITTED', 'UNDER_REVIEW'])
        with self.client.get(
            f"/api/v1/claims?status={status_to_find}&limit=50",
            headers=headers,
            catch_response=True,
            name="1. Find Claim to Process"
        ) as response:
            if response.status_code != 200:
                response.failure(f"Failed to get claims: {response.status_code}")
                return
            
            all_claims = response.json().get("data", [])
            # Probabilistically select claims, favoring those around target age
            # Recent claims have low chance, claims near 18 min have peak probability
            # Apply user-specific speed factor: fast agents prefer younger claims, slow agents prefer older
            claims = select_by_age_probability(
                all_claims,
                target_age_minutes=TARGET_CLAIM_AGE_MINUTES * self.user_speed_factor,
                max_selections=1
            )
            
            response.success()
            if not claims:
                # Agent notes no suitable claims available right now
                return
            
            claim = claims[0]
            claim_id = claim['id']
            claim_status = claim.get('status')
            response.success()
        
        # Skip if claim is already in final state (prevents workflow violations)
        if claim_status in ['APPROVED', 'DENIED', 'PAID']:
            # Agent notes claim is already processed
            return
        
        # Agent opens and reads claim details thoroughly (5-10 seconds)
        time.sleep(random.uniform(5, 10) * self.user_speed_factor)
        
        # Step 2: Update to under_review (if not already)
        if claim_status == 'SUBMITTED':
            with self.client.put(
                f"/api/v1/claims/{claim_id}/status",
                json={"status": "UNDER_REVIEW"},
                headers=headers,
                catch_response=True,
                name="2. Mark Under Review"
            ) as response:
                if response.status_code == 200:
                    response.success()
                elif response.status_code == 400:
                    # Another agent already updated this - not a real failure
                    response.success()
                else:
                    response.failure(f"Unexpected status code: {response.status_code}")
            
            # Agent reviews documentation, checks policy terms, analyzes photos/evidence (8-15 seconds)
            time.sleep(random.uniform(8, 15) * self.user_speed_factor)
        
        # Step 3: Approve or deny the claim
        # Denial rate varies by claim amount (higher amounts = more scrutiny)
        claim_amount = float(claim.get('claimAmount', 5000))
        
        # Base denial rate: 15%, increases for higher amounts
        # Under $5k: 10% denial, $5k-$20k: 15%, $20k-$50k: 25%, Over $50k: 35%
        if claim_amount < 5000:
            denial_rate = 0.10
        elif claim_amount < 20000:
            denial_rate = 0.15
        elif claim_amount < 50000:
            denial_rate = 0.25
        else:
            denial_rate = 0.35
        
        if random.random() > denial_rate:
            # Approve claim with approved amount
            approved_amount = round(claim_amount * random.uniform(0.8, 1.0), 2)
            with self.client.put(
                f"/api/v1/claims/{claim_id}/status",
                json={
                    "status": "APPROVED",
                    "approvedAmount": approved_amount
                },
                headers=headers,
                catch_response=True,
                name="3. Approved Claim"
            ) as response:
                if response.status_code == 200:
                    response.success()
                elif response.status_code == 400:
                    # Another agent already processed this claim - not a real failure
                    response.success()
                else:
                    response.failure(f"Unexpected status code: {response.status_code}")
        else:
            # Deny claim with realistic reason
            # Weighted denial reasons - more common reasons appear more frequently
            # Static strings for aggregation in reporting
            denial_scenarios = [
                # Common reasons (60% of denials)
                ("Insufficient documentation provided", 0.20),
                ("Missing required evidence or photos", 0.15),
                ("Policy coverage limits exceeded", 0.15),
                ("Lack of supporting receipts or repair estimates", 0.10),
                
                # Moderate reasons (30% of denials)
                ("Incident not covered under policy terms", 0.12),
                ("Pre-existing damage identified in assessment", 0.08),
                ("Claim filed outside policy reporting window", 0.07),
                ("Unable to verify incident details provided", 0.03),
                
                # Rare reasons (10% of denials)
                ("Duplicate claim submission detected", 0.04),
                ("Policy was not active at time of incident", 0.03),
                ("Fraudulent claim indicators identified", 0.02),
                ("Third-party liability determined at fault", 0.01)
            ]
            
            # Select reason using weighted probabilities
            reasons, weights = zip(*denial_scenarios)
            selected_reason = random.choices(reasons, weights=weights)[0]
            
            with self.client.put(
                f"/api/v1/claims/{claim_id}/status",
                json={
                    "status": "DENIED",
                    "denialReason": selected_reason
                },
                headers=headers,
                catch_response=True,
                name="3. Denied Claim"
            ) as response:
                if response.status_code == 200:
                    response.success()
                elif response.status_code == 400:
                    # Another agent already processed this claim - not a real failure
                    response.success()
                else:
                    response.failure(f"Unexpected status code: {response.status_code}")
        
        # Agent writes notes and prepares communication to customer (2-4 seconds)
        time.sleep(random.uniform(2, 4) * self.user_speed_factor)
        
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
                    # Agent scans claims queue, reviewing amounts and dates (3-6 seconds)
                    time.sleep(random.uniform(3, 6) * self.user_speed_factor)
                    
                    # Step 2: View specific claim
                    claim = random.choice(claims)
                    self.client.get(
                        f"/api/v1/claims/{claim['id']}",
                        headers=headers,
                        name="2. View Claim Details"
                    )
                    
                    # Agent reads full claim details and attached documentation (4-8 seconds)
                    time.sleep(random.uniform(4, 8) * self.user_speed_factor)
                    
                    # Step 3: View claim history
                    self.client.get(
                        f"/api/v1/claims/{claim['id']}/history",
                        headers=headers,
                        name="3. View Claim History"
                    )
                response.success()
