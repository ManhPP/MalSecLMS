import os

class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:malsec_db_pass_2026@db/malsec_lms"
    )
    JWT_SECRET: str = os.getenv(
        "JWT_SECRET", 
        "super_secret_jwt_key_for_malsec_lms_2026_!!"
    )
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/app/uploads")
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
    ALLOWED_EXTENSIONS: set = set(
        os.getenv("ALLOWED_EXTENSIONS", "png,jpg,jpeg,txt,log,pcap,pdf,zip").split(",")
    )
    
    # Keycloak Mock/Real Configuration
    USE_KEYCLOAK: bool = os.getenv("USE_KEYCLOAK", "false").lower() == "true"
    KEYCLOAK_URL: str = os.getenv("KEYCLOAK_URL", "http://keycloak:8080")
    KEYCLOAK_REALM: str = os.getenv("KEYCLOAK_REALM", "malsec")
    KEYCLOAK_CLIENT_ID: str = os.getenv("KEYCLOAK_CLIENT_ID", "malsec-lms")

    # Proxmox VE API Configuration
    PVE_API_HOST: str = os.getenv("PVE_API_HOST", "10.0.80.10")
    PVE_API_USER: str = os.getenv("PVE_API_USER", "root@pam")
    PVE_TOKEN_NAME: str = os.getenv("PVE_TOKEN_NAME", "malsec-token")
    PVE_TOKEN_VALUE: str = os.getenv("PVE_TOKEN_VALUE", "a363ce9d-3a08-451e-b5c5-45122b94c563")


    # Guacamole Encrypted JSON & HMAC Configuration
    GUAC_BASE_URL: str = os.getenv("GUAC_BASE_URL", "/guacamole/")
    GUAC_HMAC_SECRET: str = os.getenv("GUAC_HMAC_SECRET", "MySuperSecretKeyForGuacHMAC2026!")
    GUAC_JSON_SECRET: str = os.getenv("GUAC_JSON_SECRET", "545361e2e0cdc7a516ad17d27b1ba77c")




settings = Settings()

