import logging
import os

from fastapi import HTTPException, Request, status

from cache import redis_client

logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
        return value if value > 0 else default
    except ValueError:
        return default


MAX_FAILED_ATTEMPTS_PER_USERNAME = _env_int("AUTH_MAX_FAILED_ATTEMPTS_PER_USERNAME", 5)
MAX_FAILED_ATTEMPTS_PER_IP = _env_int("AUTH_MAX_FAILED_ATTEMPTS_PER_IP", 20)
FAILED_WINDOW_SECONDS = _env_int("AUTH_FAILED_WINDOW_SECONDS", 300)
BASE_LOCK_SECONDS = _env_int("AUTH_BASE_LOCK_SECONDS", 300)
MAX_LOCK_SECONDS = _env_int("AUTH_MAX_LOCK_SECONDS", 86400)
LOCK_LEVEL_TTL_SECONDS = _env_int("AUTH_LOCK_LEVEL_TTL_SECONDS", 86400)


class LoginSecurityManager:
    def normalize_username(self, username: str) -> str:
        normalized = (username or "").strip().lower()
        return normalized or "unknown"

    def get_client_ip(self, request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
        return request.client.host if request.client else "unknown"

    def ensure_not_locked(self, username: str, ip_address: str) -> None:
        account_lock_key = self._account_lock_key(username)
        account_ttl = self._safe_ttl(account_lock_key)
        if account_ttl > 0:
            self._raise_lockout(account_ttl)

        ip_lock_key = self._ip_lock_key(ip_address)
        ip_ttl = self._safe_ttl(ip_lock_key)
        if ip_ttl > 0:
            self._raise_lockout(ip_ttl)

    def register_failed_attempt(self, username: str, ip_address: str) -> None:
        account_failed = self._incr_with_window(self._account_failed_key(username))
        ip_failed = self._incr_with_window(self._ip_failed_key(ip_address))

        if account_failed >= MAX_FAILED_ATTEMPTS_PER_USERNAME:
            self._apply_account_lock(username)
            retry_after = self._safe_ttl(self._account_lock_key(username))
            self._raise_lockout(retry_after)

        if ip_failed >= MAX_FAILED_ATTEMPTS_PER_IP:
            self._apply_ip_lock(ip_address)
            retry_after = self._safe_ttl(self._ip_lock_key(ip_address))
            self._raise_lockout(retry_after)

    def register_success(self, username: str) -> None:
        self._safe_delete(self._account_failed_key(username))
        self._safe_delete(self._account_lock_key(username))
        self._safe_delete(self._account_lock_level_key(username))

    def _apply_account_lock(self, username: str) -> None:
        level_key = self._account_lock_level_key(username)
        level = self._safe_incr(level_key)
        self._safe_set_expire(level_key, LOCK_LEVEL_TTL_SECONDS)

        multiplier = 2 ** max(level - 1, 0)
        lock_seconds = min(BASE_LOCK_SECONDS * multiplier, MAX_LOCK_SECONDS)

        lock_key = self._account_lock_key(username)
        self._safe_setex(lock_key, lock_seconds, "1")
        self._safe_delete(self._account_failed_key(username))

    def _apply_ip_lock(self, ip_address: str) -> None:
        lock_key = self._ip_lock_key(ip_address)
        self._safe_setex(lock_key, BASE_LOCK_SECONDS, "1")
        self._safe_delete(self._ip_failed_key(ip_address))

    def _raise_lockout(self, retry_after: int) -> None:
        if retry_after <= 0:
            retry_after = BASE_LOCK_SECONDS
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Bạn đã thử đăng nhập quá nhiều lần. "
                f"Vui lòng thử lại sau {retry_after} giây."
            ),
            headers={"Retry-After": str(retry_after)},
        )

    def _incr_with_window(self, key: str) -> int:
        value = self._safe_incr(key)
        self._safe_set_expire(key, FAILED_WINDOW_SECONDS)
        return value

    def _account_failed_key(self, username: str) -> str:
        return f"auth:login:failed:account:{username}"

    def _ip_failed_key(self, ip_address: str) -> str:
        return f"auth:login:failed:ip:{ip_address}"

    def _account_lock_key(self, username: str) -> str:
        return f"auth:login:lock:account:{username}"

    def _ip_lock_key(self, ip_address: str) -> str:
        return f"auth:login:lock:ip:{ip_address}"

    def _account_lock_level_key(self, username: str) -> str:
        return f"auth:login:lock-level:account:{username}"

    def _safe_incr(self, key: str) -> int:
        try:
            return int(redis_client.incr(key))
        except Exception as exc:
            logger.warning("Redis INCR failed for key=%s: %s", key, exc)
            return 0

    def _safe_set_expire(self, key: str, seconds: int) -> None:
        try:
            ttl = redis_client.ttl(key)
            if ttl <= 0:
                redis_client.expire(key, seconds)
        except Exception as exc:
            logger.warning("Redis EXPIRE failed for key=%s: %s", key, exc)

    def _safe_setex(self, key: str, seconds: int, value: str) -> None:
        try:
            redis_client.setex(key, seconds, value)
        except Exception as exc:
            logger.warning("Redis SETEX failed for key=%s: %s", key, exc)

    def _safe_ttl(self, key: str) -> int:
        try:
            ttl = redis_client.ttl(key)
            return int(ttl) if ttl and ttl > 0 else 0
        except Exception as exc:
            logger.warning("Redis TTL failed for key=%s: %s", key, exc)
            return 0

    def _safe_delete(self, key: str) -> None:
        try:
            redis_client.delete(key)
        except Exception as exc:
            logger.warning("Redis DEL failed for key=%s: %s", key, exc)


login_security_manager = LoginSecurityManager()
