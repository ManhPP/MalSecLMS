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

settings = Settings()
