from pydantic import BaseModel, Field

# Data received from the frontend during signup
class UserCreate(BaseModel):
    username: str
    email: str
    # Field() is used here to ensure the password does not exceed 72 characters.
    # Added min_length=4 as well for good security practice.
    password: str = Field(
        ..., 
        min_length=4, 
        max_length=72, 
        description="Password must be between 4 and 72 characters long."
    )

# Data received from the frontend during login
class UserLogin(BaseModel):
    username: str
    password: str