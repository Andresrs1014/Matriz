from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str | None = Field(default=None, max_length=200)
    password: str = Field(min_length=5, max_length=128)
    role: str = Field(default="usuario", max_length=50)
    work_area_id: int | None = None
    work_site_id: int | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None = None
    role: str
    area: str | None = None
    site_name: str | None = None
    is_active: bool


class UserListResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None = None
    role: str
    area: str | None = None
    site_name: str | None = None
    work_area_id: int | None = None
    work_site_id: int | None = None
    is_active: bool
    created_at: str


class UpdateRoleRequest(BaseModel):
    role: str = Field(
        description="Valores válidos: superadmin | admin | coordinador | usuario"
    )


class SuperadminUpdateUserRequest(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, max_length=200)
    work_area_id: int | None = None
    work_site_id: int | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, max_length=128)
    confirm_superadmin_password: str | None = Field(default=None, max_length=128)
