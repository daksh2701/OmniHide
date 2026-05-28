import bcrypt

def get_password_hash(password: str) -> str:
    # Convert the plain text password to bytes and generate the hash
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    
    # Convert the hashed password back to a string for database storage
    return hashed_password.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Convert both the plain and hashed passwords to bytes for comparison
    password_byte_enc = plain_password.encode('utf-8')
    hashed_password_byte_enc = hashed_password.encode('utf-8')
    
    return bcrypt.checkpw(password_byte_enc, hashed_password_byte_enc)