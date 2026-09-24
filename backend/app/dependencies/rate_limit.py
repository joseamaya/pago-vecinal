import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

_attempts = defaultdict(deque)


def reset_rate_limits():
    _attempts.clear()


def rate_limit(max_requests: int, window_seconds: int, scope: str):
    async def _dependency(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        key = f"{scope}:{client_ip}"
        now = time.monotonic()
        window = _attempts[key]

        while window and now - window[0] > window_seconds:
            window.popleft()

        if len(window) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests, please try again later",
            )

        window.append(now)

    return _dependency
