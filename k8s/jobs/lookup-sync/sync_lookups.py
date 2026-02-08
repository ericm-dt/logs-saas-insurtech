#!/usr/bin/env python3
"""
Dynatrace Lookup Data Sync Job

Exports users and organizations from PostgreSQL to Dynatrace Grail lookup tables.
Files are uploaded to Dynatrace Resource Store for use in DQL queries.
"""

import os
import sys
import json
import requests
import psycopg2
from urllib.parse import urlparse


# Configuration
DYNATRACE_URL = os.environ.get('DYNATRACE_URL', '').rstrip('/')
DYNATRACE_API_TOKEN = os.environ.get('DYNATRACE_API_TOKEN', '')
USER_DB_URL = os.environ.get('USER_DB_URL', '')

# Dynatrace lookup file paths
USERS_LOOKUP_PATH = '/lookups/dynaclaimz/users'
ORGS_LOOKUP_PATH = '/lookups/dynaclaimz/organizations'


def parse_db_url(url):
    """Parse PostgreSQL connection URL."""
    parsed = urlparse(url)
    return {
        'host': parsed.hostname,
        'port': parsed.port or 5432,
        'database': parsed.path[1:],
        'user': parsed.username,
        'password': parsed.password
    }


def get_db_connection():
    """Create database connection."""
    if not USER_DB_URL:
        raise ValueError("USER_DB_URL environment variable not set")
    
    conn_params = parse_db_url(USER_DB_URL)
    print(f"Connecting to database {conn_params['database']} at {conn_params['host']}:{conn_params['port']}")
    
    return psycopg2.connect(**conn_params)


def export_users_jsonl(conn):
    """Export users to JSONL format."""
    print("Exporting users...")
    
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            id,
            email,
            "firstName",
            "lastName",
            role,
            "organizationId",
            "createdAt"
        FROM users
        ORDER BY "createdAt" DESC
    """)
    
    lines = []
    row_count = 0
    for row in cursor:
        user_id, email, first_name, last_name, role, org_id, created_at = row
        record = {
            'id': user_id,
            'email': email,
            'firstName': first_name,
            'lastName': last_name,
            'role': role,
            'organizationId': org_id,
            'createdAt': created_at.isoformat()
        }
        lines.append(json.dumps(record))
        row_count += 1
    
    cursor.close()
    
    jsonl_content = '\n'.join(lines) + '\n'
    
    print(f"Exported {row_count} users ({len(jsonl_content)} bytes)")
    return jsonl_content


def export_organizations_jsonl(conn):
    """Export organizations to JSONL format."""
    print("Exporting organizations...")
    
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            id,
            name,
            "createdAt"
        FROM organizations
        ORDER BY "createdAt" DESC
    """)
    
    lines = []
    row_count = 0
    for row in cursor:
        org_id, name, created_at = row
        record = {
            'id': org_id,
            'name': name,
            'createdAt': created_at.isoformat()
        }
        lines.append(json.dumps(record))
        row_count += 1
    
    cursor.close()
    
    jsonl_content = '\n'.join(lines) + '\n'
    
    print(f"Exported {row_count} organizations ({len(jsonl_content)} bytes)")
    return jsonl_content


def upload_to_dynatrace(file_path, content):
    """
    Upload lookup data to Dynatrace Grail using Resource Store API.
    
    The API uses multipart/form-data with a request part (JSON metadata) 
    and a content part (the actual CSV data).
    """
    if not DYNATRACE_URL or not DYNATRACE_API_TOKEN:
        raise ValueError("DYNATRACE_URL and DYNATRACE_API_TOKEN must be set")
    
    # Resource Store API endpoint for lookup data upload
    url = f"{DYNATRACE_URL}/platform/storage/resource-store/v1/files/tabular/lookup:upload"
    
    headers = {
        'Authorization': f'Bearer {DYNATRACE_API_TOKEN}',
        'Accept': '*/*'
    }
    
    # Determine lookup field based on file path
    lookup_field = 'id'  # Primary key for both users and organizations
    
    # Request metadata (JSON)
    request_metadata = {
        'parsePattern': 'JSON:json',
        'lookupField': lookup_field,
        'filePath': file_path,
        'displayName': file_path.split('/')[-1].title(),
        'description': f'DynaClaimz {file_path.split("/")[-1]} lookup data',
        'overwrite': True  # Allow updates
    }
    
    print(f"Uploading to {file_path}...")
    print(f"URL: {url}")
    print(f"Content size: {len(content)} bytes")
    print(f"Lookup field: {lookup_field}")
    
    # Multipart form-data: request (JSON) + content (JSONL)
    # Tuple format: (filename, file_content, content_type)
    files = {
        'request': (None, json.dumps(request_metadata), 'application/json'),
        'content': ('data.jsonl', content.encode('utf-8'), 'application/jsonl; charset=utf-8')
    }
    
    try:
        response = requests.post(url, headers=headers, files=files, timeout=60)
        
        if response.status_code in [200, 201, 204]:
            print(f"✓ Successfully uploaded {file_path}")
            return True
        else:
            print(f"✗ Failed to upload {file_path}")
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"✗ Error uploading {file_path}: {e}")
        return False


def main():
    """Main execution function."""
    print("=" * 60)
    print("Dynatrace Lookup Data Sync Job")
    print("=" * 60)
    print()
    
    # Validate configuration
    if not DYNATRACE_URL:
        print("ERROR: DYNATRACE_URL environment variable not set")
        sys.exit(1)
    
    if not DYNATRACE_API_TOKEN:
        print("ERROR: DYNATRACE_API_TOKEN environment variable not set")
        sys.exit(1)
    
    if not USER_DB_URL:
        print("ERROR: USER_DB_URL environment variable not set")
        sys.exit(1)
    
    print(f"Dynatrace URL: {DYNATRACE_URL}")
    print(f"API Token: {'*' * (len(DYNATRACE_API_TOKEN) - 4)}{DYNATRACE_API_TOKEN[-4:]}")
    print()
    
    try:
        # Connect to database
        conn = get_db_connection()
        
        # Export users
        users_jsonl = export_users_jsonl(conn)
        
        # Export organizations
        orgs_jsonl = export_organizations_jsonl(conn)
        
        # Close database connection
        conn.close()
        print("Database connection closed")
        print()
        
        # Upload to Dynatrace
        print("Uploading to Dynatrace Grail...")
        print()
        
        users_success = upload_to_dynatrace(USERS_LOOKUP_PATH, users_jsonl)
        orgs_success = upload_to_dynatrace(ORGS_LOOKUP_PATH, orgs_jsonl)
        
        print()
        print("=" * 60)
        print("Summary")
        print("=" * 60)
        print(f"Users lookup:         {'✓ SUCCESS' if users_success else '✗ FAILED'}")
        print(f"Organizations lookup: {'✓ SUCCESS' if orgs_success else '✗ FAILED'}")
        print()
        
        if users_success and orgs_success:
            print("✓ All lookups synced successfully!")
            print()
            print("You can now use these lookups in DQL queries:")
            print(f"  load \"{USERS_LOOKUP_PATH}\"")
            print(f"  load \"{ORGS_LOOKUP_PATH}\"")
            print()
            print("Example DQL query:")
            print("  fetch logs")
            print(f"  | lookup [ load \"{USERS_LOOKUP_PATH}\" ],")
            print("      sourcefield: user.id, lookupField: id")
            sys.exit(0)
        else:
            print("✗ Some lookups failed to sync")
            sys.exit(1)
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
