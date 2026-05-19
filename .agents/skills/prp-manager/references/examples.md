# PRP Examples

## Example 1: Initialize PRPs

### User Request
```
User: "Initialize PRPs for this project"
```

### Claude Response
```
✅ PRPs Initialized for Averii Backend

Stack Detected:
- Language: Python 3.11
- Framework: FastAPI
- Package Manager: uv
- Linting: ruff
- Type Checking: mypy
- Testing: pytest

Created:
- PRPs/templates/prp_base.md

Ready to generate PRPs!
```

---

## Example 2: Generate a PRP

### User Request
```
User: "Create a PRP for adding OAuth authentication with Google"
```

### Generated PRP

```markdown
# PRP: Google OAuth Authentication

> **Version:** 1.0
> **Created:** 2024-01-15
> **Status:** Ready

## Goal
Add Google OAuth 2.0 authentication to allow users to sign in with their Google account.

## Why
- Users prefer social login (reduces friction)
- Faster signup (no password to remember)
- Trustworthy (Google verifies identity)

## Success Criteria
- [ ] Users can click "Sign in with Google"
- [ ] User is redirected to Google consent screen
- [ ] After approval, user is created/updated in database
- [ ] JWT token returned for session
- [ ] Existing email users can link Google account

## All Needed Context

### Documentation & References
- url: https://developers.google.com/identity/protocols/oauth2
  why: OAuth 2.0 flow documentation
  
- file: app/routers/auth.py
  why: Current authentication patterns

- file: app/core/security.py
  why: JWT token creation logic

### Current Codebase Structure
```
app/
├── main.py
├── core/
│   ├── security.py      # JWT, password hashing
│   ├── database.py      # MongoDB connection
│   └── config.py         # Settings
├── routers/
│   ├── auth.py           # Login/register endpoints
│   └── ...
├── models/
│   └── user.py           # UserModel
└── services/
    └── auth_service.py    # Authentication logic
```

### Known Gotchas
- Google OAuth requires redirect_uri to be registered in Google Cloud Console
- Access tokens expire in 1 hour - need refresh token flow
- Must verify Google's ID token signature

## Implementation Blueprint

### Tasks
1. Add google-auth library to dependencies
2. Add Google OAuth config to settings
3. Create GoogleOAuthService
4. Add /auth/google endpoint
5. Handle callback and create session
6. Add tests

### Validation
```bash
ruff check app/auth/ --fix
mypy app/auth/
pytest app/tests/test_auth.py -v
```

---

## Example 3: Execute a PRP

### User Request
```
User: "Execute PRP PRPs/001--google-oauth.md"
```

### Claude Response
```
✅ PRP Execution Complete

Tasks: 6/6 completed
Validation: All passing
Status: SUCCESS
```

### Steps Taken
1. Added `google-auth` and `google-auth-oauthlib` to pyproject.toml
2. Created GoogleOAuthService in app/services/google_oauth.py
3. Added Google OAuth config to app/core/config.py
4. Created /auth/google/login endpoint
5. Created /auth/google/callback endpoint
6. Added unit and integration tests

### Validation Results
```
✅ ruff check app/auth/google_oauth.py --fix - No issues
✅ mypy app/auth/google_oauth.py - No issues
✅ pytest app/tests/test_google_oauth.py - 5/5 passed
```