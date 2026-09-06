from pydantic import BaseModel
class CategoryOut(BaseModel):
    category_id: int
    name: str
    is_active: bool

    class Config:
        orm_mode = True
