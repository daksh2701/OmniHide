import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# Secret salt used to add an extra layer of security to password hashing
SALT = b'omnihide_super_secret_salt_2026'

def get_key_from_password(password: str) -> bytes:
    """Converts the user's plain password (e.g., '1234') into a strong AES key."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=SALT,
        iterations=100000, # 100,000 iterations for key derivation to prevent brute-force attacks
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    return key

def encrypt_text(secret_message: str, password: str) -> str:
    """Encrypts the message using the provided password."""
    key = get_key_from_password(password)
    fernet = Fernet(key)
    encrypted_bytes = fernet.encrypt(secret_message.encode('utf-8'))
    return encrypted_bytes.decode('utf-8')

def decrypt_text(encrypted_message: str, password: str) -> str:
    """Decrypts the message back to its original form using the correct password."""
    key = get_key_from_password(password)
    fernet = Fernet(key)
    # Fernet will automatically raise an InvalidToken error if the password is incorrect
    decrypted_bytes = fernet.decrypt(encrypted_message.encode('utf-8'))
    return decrypted_bytes.decode('utf-8')