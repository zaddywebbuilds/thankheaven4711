#!/usr/bin/env python3
"""
One-time script to get a GBP OAuth refresh token.
Run locally: python scripts/gbp_auth.py

Requires:
  pip install requests
"""

import urllib.parse
import requests

SCOPES = "https://www.googleapis.com/auth/business.manage"

CLIENT_ID = input("Paste your OAuth Client ID: ").strip()
CLIENT_SECRET = input("Paste your OAuth Client Secret: ").strip()

# Build the auth URL manually -- no library needed
params = {
    "client_id": CLIENT_ID,
    "redirect_uri": "urn:ietf:wg:oauth:2.0:oob",
    "response_type": "code",
    "scope": SCOPES,
    "access_type": "offline",
    "prompt": "consent",
}
auth_url = "https://accounts.google.com/o/oauth2/auth?" + urllib.parse.urlencode(params)

print("\n--- Open this URL in your browser ---")
print(auth_url)
print("\nSign in with johnogbonnae@gmail.com, approve access, then paste the code shown.")

code = input("\nPaste the code here: ").strip()

# Exchange code for tokens
token_resp = requests.post(
    "https://oauth2.googleapis.com/token",
    data={
        "code": code,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": "urn:ietf:wg:oauth:2.0:oob",
        "grant_type": "authorization_code",
    },
).json()

refresh_token = token_resp.get("refresh_token")
access_token = token_resp.get("access_token")

if not refresh_token:
    print(f"\nERROR -- no refresh_token in response: {token_resp}")
    exit(1)

print("\n--- Save these as GitHub Actions secrets ---")
print(f"GBP_CLIENT_ID:      {CLIENT_ID}")
print(f"GBP_CLIENT_SECRET:  {CLIENT_SECRET}")
print(f"GBP_REFRESH_TOKEN:  {refresh_token}")

# Fetch accounts and locations to get GBP_LOCATION_NAME
accounts_raw = requests.get(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    headers={"Authorization": f"Bearer {access_token}"},
)
print(f"\n[DEBUG] Accounts API status: {accounts_raw.status_code}")
accounts_resp = accounts_raw.json()
print(f"[DEBUG] Accounts response: {accounts_resp}")

print("\n--- Your GBP Locations ---")
for acct in accounts_resp.get("accounts", []):
    print(f"  Account: {acct['name']}")
    locs_raw = requests.get(
        f"https://mybusinessbusinessinformation.googleapis.com/v1/{acct['name']}/locations"
        "?readMask=name,title",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    print(f"  [DEBUG] Locations API status: {locs_raw.status_code}")
    locs_resp = locs_raw.json()
    print(f"  [DEBUG] Locations response: {locs_resp}")
    for loc in locs_resp.get("locations", []):
        print(f"  Title: {loc.get('title', '')}")
        print(f"  GBP_LOCATION_NAME = {loc['name']}")
        print()
