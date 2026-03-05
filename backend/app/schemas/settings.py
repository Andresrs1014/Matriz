from pydantic import BaseModel, Field


# ── Categorías ─────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name:        str       = Field(max_length=100)
    description: str | None = Field(default=None, max_length=300)
    is_default:  bool      = Field(default=False)


class CategoryUpdate(BaseModel):
    name:        str | None  = Field(default=None, max_length=100)
    description: str | None  = Field(default=None, max_length=300)
    is_active:   bool | None = None
    is_default:  bool | None = None


class CategoryRead(BaseModel):
    id:          int
    name:        str
    description: str | None
    is_active:   bool
    is_default:  bool
    question_count: int = 0


# ── Preguntas ──────────────────────────────────────────────────────────────

class QuestionCreate(BaseModel):
    category_id: int | None = None
    axis:        str        = Field(description="impact | effort")
    text:        str        = Field(max_length=500)
    weight:      float      = Field(default=1.0, ge=0.1, le=3.0)
    order:       int        = Field(default=0)


class QuestionUpdate(BaseModel):
    text:      str | None   = Field(default=None, max_length=500)
    weight:    float | None = Field(default=None, ge=0.1, le=3.0)
    order:     int | None   = None
    is_active: bool | None  = None
    axis:      str | None   = None


class QuestionRead(BaseModel):
    id:          int
    category_id: int | None
    axis:        str
    text:        str
    weight:      float
    order:       int
    is_active:   bool
