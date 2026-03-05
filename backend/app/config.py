from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Project Matrix API"
    env: str = "local"
    cors_origins: str = "http://localhost:5173"

    secret_key: str = "CHANGE_ME"
    access_token_expire_minutes: int = 480

    database_url: str = "sqlite:///./data/matrix.db"

    webhook_secret: str = "CHANGE_ME_WEBHOOK_SECRET"

    # Superadmin por defecto (cambiar en .env antes de iniciar)
    superadmin_email: str = "admin@matrix.com"
    superadmin_password: str = "Admin1234!"

    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
