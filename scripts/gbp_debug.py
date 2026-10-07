#!/usr/bin/env python3
"""Quick debug -- paste your existing tokens to check what the API returns."""
import requests

CLIENT_ID = input("Client ID: ").strip()
CLIENT_SECRET = input("Client Secret: ").strip()
REFRESH_TOKEN = input("Refresh Token: ").strip()

token_resp = requests.post(
    "https://oauth2.googleapis.com/token",
    data={
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": REFRESH_TOKEN,
        "grant_type": "refresh_token",
    },
).json()
access_token = token_resp.get("access_token")
print(f"\nAccess token: {'OK' if access_token else 'FAILED'}")
if not access_token:
    print(token_resp)
    exit(1)

r = requests.get(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    headers={"Authorization": f"Bearer {access_token}"},
)
print(f"\nAccounts API ({r.status_code}):")
print(r.json())

data = r.json()
for acct in data.get("accounts", []):
    r2 = requests.get(
        f"https://mybusinessbusinessinformation.googleapis.com/v1/{acct['name']}/locations?readMask=name,title",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    print(f"\nLocations for {acct['name']} ({r2.status_code}):")
    print(r2.json())
