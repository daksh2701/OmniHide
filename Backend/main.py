from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
import os
import uuid
import shutil
import random
import smtplib
from email.mime.text import MIMEText

# Custom files and engines
import models
import schemas
import security
from database import engine, get_db
from stego_core import crypto_engine, image_stego, audio_stego, video_stego

# EMAIL SETUP (Enter your details)
MY_GMAIL = "dakshjain270104@gmail.com"  
MY_APP_PASSWORD = "walq lyds zewm wkbp" 

OTP_VAULT = {} 

models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="OmniHide API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage Folders Setup
COVER_DIR = "local_storage/cover_files"
ENCRYPTED_DIR = "local_storage/encrypted_files"
CHAT_DIR = "local_storage/chat_files"

os.makedirs(COVER_DIR, exist_ok=True)
os.makedirs(ENCRYPTED_DIR, exist_ok=True)
os.makedirs(CHAT_DIR, exist_ok=True)

app.mount("/media", StaticFiles(directory="local_storage"), name="media")


@app.get("/")
def read_root():
    return {"message": "Welcome to OmniHide Engine! Server is running LOCALLY."}

# AUTHENTICATION SYSTEM

@app.post("/request-otp/")
def request_otp(email: str = Form(...)):
    otp = str(random.randint(1000, 9999))
    OTP_VAULT[email] = otp 
    try:
        msg = MIMEText(f"OmniHide Security Alert!\n\nYour 4-Digit OTP is : {otp}\n\nDon't share this OTP with anyone!\n\nThis OTP will expire in 5 minutes.")
        msg['Subject'] = 'OmniHide Secret OTP 🔐'
        msg['From'] = MY_GMAIL
        msg['To'] = email

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(MY_GMAIL, MY_APP_PASSWORD)
            server.sendmail(MY_GMAIL, email, msg.as_string())
            
        return {"status": "Success", "message": f"OTP successfully sent!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Email not sent! Please check the email address!")

@app.post("/signup-with-otp/")
def signup_with_otp(username: str = Form(...), email: str = Form(...), password: str = Form(...), otp: str = Form(...), db: Session = Depends(get_db)):
    if OTP_VAULT.get(email) != otp:
        raise HTTPException(status_code=400, detail="Wrong OTP!")
        
    existing_user = db.query(models.User).filter(models.User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already in use!")
        
    hashed_pw = security.get_password_hash(password)
    new_user = models.User(username=username, email=email, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    
    del OTP_VAULT[email] 
    return {"message": "Account created successfully!", "username": username}

@app.delete("/delete-user/")
def delete_user(email: str = Form(...), db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="This email does not exist!")
    db.delete(db_user)
    db.commit()
    return {"message": f"Agent {db_user.username} Deleted!"}

@app.post("/login/")
def login(email: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if not db_user or not security.verify_password(password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Wrong Email or Password!")
    return {"message": "Login successful!", "username": db_user.username}

@app.post("/reset-password/")
def reset_password(email: str = Form(...), otp: str = Form(...), new_password: str = Form(...), db: Session = Depends(get_db)):
    if OTP_VAULT.get(email) != otp:
        raise HTTPException(status_code=400, detail="Wrong OTP!")
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="This email is not registered!")
    db_user.hashed_password = security.get_password_hash(new_password)
    db.commit()
    del OTP_VAULT[email]
    return {"message": "Password successfully reset!"}

#  ADMIN PANEL ROUTES

@app.post("/admin-login/")
def admin_login(email: str = Form(...), password: str = Form(...)):
    if email == "admin@omnihide.com" and password == "Admin@123":
        return {"message": "Welcome Commander!", "username": "SuperAdmin", "is_admin": True}
    raise HTTPException(status_code=400, detail="Invalid Admin Credentials!")

@app.get("/admin/users/")
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return [
        {
            "username": u.username, 
            "email": u.email,
            "enc_count": u.files_encrypted,
            "dec_count": u.files_decrypted
        } for u in users
    ]

@app.get("/admin/stats/")
def get_server_insights(db: Session = Depends(get_db)):
    stats = {
        "images_encrypted": 0, "audios_encrypted": 0, "videos_encrypted": 0, "total_encrypted": 0,
        "images_decrypted": 0, "audios_decrypted": 0, "videos_decrypted": 0, "total_decrypted": 0,
        "chat_media": 0
    }
    
    if os.path.exists(ENCRYPTED_DIR):
        files = os.listdir(ENCRYPTED_DIR)
        stats["total_encrypted"] = len(files)
        for f in files:
            ext = f.split('.')[-1].lower()
            if ext in ['png', 'jpg', 'jpeg']: stats["images_encrypted"] += 1
            elif ext in ['wav', 'mp3']: stats["audios_encrypted"] += 1
            elif ext in ['mp4', 'avi', 'mkv']: stats["videos_encrypted"] += 1

    if os.path.exists(CHAT_DIR):
        stats["chat_media"] = len(os.listdir(CHAT_DIR))
        
    users = db.query(models.User).all()
    stats["total_decrypted"] = sum((u.files_decrypted or 0) for u in users)
    stats["images_decrypted"] = sum((u.images_decrypted or 0) for u in users)
    stats["audios_decrypted"] = sum((u.audios_decrypted or 0) for u in users)
    stats["videos_decrypted"] = sum((u.videos_decrypted or 0) for u in users)
    
    return stats


class ActivityTracker(BaseModel):
    username: str
    action: str
    media_type: str = "image"

@app.post("/track-activity/")
def track_user_activity(req: ActivityTracker, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if user:
        if req.action == "encrypt": 
            user.files_encrypted = (user.files_encrypted or 0) + 1
        elif req.action == "decrypt": 
            user.files_decrypted = (user.files_decrypted or 0) + 1
            if req.media_type == "image": 
                user.images_decrypted = (user.images_decrypted or 0) + 1
            elif req.media_type == "audio": 
                user.audios_decrypted = (user.audios_decrypted or 0) + 1
            elif req.media_type == "video": 
                user.videos_decrypted = (user.videos_decrypted or 0) + 1
        db.commit()
    return {"status": "tracked"}


class BroadcastRequest(BaseModel):
    message: str

@app.post("/admin/broadcast/")
async def admin_broadcast(req: BroadcastRequest):
    await manager.broadcast(f"[SYSTEM]🔴 ADMIN ALERT: {req.message}")
    return {"message": "Broadcast sent to all agents!"}


@app.delete("/admin/purge/")
def purge_server_data(db: Session = Depends(get_db)):
    try:
        total_deleted = 0
        folders_to_clear = [CHAT_DIR, ENCRYPTED_DIR, COVER_DIR]
        for folder in folders_to_clear:
            if os.path.exists(folder):
                for filename in os.listdir(folder):
                    file_path = os.path.join(folder, filename)
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                        total_deleted += 1
                        
        #  THE FIX: Saare Database stats ko 0 kar do
        users = db.query(models.User).all()
        for user in users:
            user.files_encrypted = 0
            user.files_decrypted = 0
            user.images_decrypted = 0
            user.audios_decrypted = 0
            user.videos_decrypted = 0
        db.commit()
        
        return {"message": f"Server & Database Purged! {total_deleted} files deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to purge: {str(e)}")


#  MULTIMEDIA STEGANOGRAPHY ROUTES 

@app.post("/hide-in-image/")
async def hide_in_image(secret_message: str = Form(...), password: str = Form(...), file: UploadFile = File(...)):
    try:
        encrypted_text = crypto_engine.encrypt_text(secret_message, password)
        cover_path = os.path.join(COVER_DIR, f"temp_{uuid.uuid4()}_{file.filename}")
        with open(cover_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        stego_output_path = os.path.join(ENCRYPTED_DIR, f"stego_{uuid.uuid4()}.png")
        image_stego.encode_image(cover_path, encrypted_text, stego_output_path)
        return {"status": "Success", "stego_image_path": stego_output_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract-from-image/")
async def extract_from_image(password: str = Form(...), file: UploadFile = File(...)):
    try:
        temp_path = os.path.join(COVER_DIR, f"extract_temp_{uuid.uuid4()}_{file.filename}")
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        encrypted_text = image_stego.decode_image(temp_path)
        decrypted_message = crypto_engine.decrypt_text(encrypted_text, password)
        return {"status": "Success", "your_secret_message": decrypted_message}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Extraction Failed! {str(e)}")

@app.post("/hide-in-audio/")
async def hide_in_audio(secret_message: str = Form(...), password: str = Form(...), file: UploadFile = File(...)):
    if not file.filename.endswith('.wav'):
        raise HTTPException(status_code=400, detail="Audio file .wav format me honi chahiye!")
    encrypted_text = crypto_engine.encrypt_text(secret_message, password)
    cover_path = os.path.join(COVER_DIR, f"temp_{uuid.uuid4()}_{file.filename}")
    with open(cover_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    stego_path = os.path.join(ENCRYPTED_DIR, f"stego_{uuid.uuid4()}.wav")
    audio_stego.encode_audio(cover_path, encrypted_text, stego_path)
    return {"status": "Success", "stego_audio_path": stego_path}

@app.post("/extract-from-audio/")
async def extract_from_audio(password: str = Form(...), file: UploadFile = File(...)):
    temp_path = os.path.join(COVER_DIR, f"extract_temp_{uuid.uuid4()}_{file.filename}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    try:
        encrypted_text = audio_stego.decode_audio(temp_path)
        decrypted_message = crypto_engine.decrypt_text(encrypted_text, password)
        return {"status": "Success", "your_secret_message": decrypted_message}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/hide-in-video/")
async def hide_in_video(secret_message: str = Form(...), password: str = Form(...), file: UploadFile = File(...)):
    encrypted_text = crypto_engine.encrypt_text(secret_message, password)
    cover_path = os.path.join(COVER_DIR, f"temp_{uuid.uuid4()}_{file.filename}")
    with open(cover_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    stego_path = os.path.join(ENCRYPTED_DIR, f"stego_{uuid.uuid4()}.mp4")
    video_stego.encode_video(cover_path, encrypted_text, stego_path)
    return {"status": "Success", "stego_video_path": stego_path}

@app.post("/extract-from-video/")
async def extract_from_video(password: str = Form(...), file: UploadFile = File(...)):
    temp_path = os.path.join(COVER_DIR, f"extract_temp_{uuid.uuid4()}_{file.filename}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    try:
        encrypted_text = video_stego.decode_video(temp_path)
        decrypted_message = crypto_engine.decrypt_text(encrypted_text, password)
        return {"status": "Success", "your_secret_message": decrypted_message}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

#  1-TO-1 PRIVATE CHAT ENGINE 

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, username: str):
        if username in self.active_connections: return False 
        await websocket.accept()
        self.active_connections[username] = websocket
        return True

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]

    async def send_personal_message(self, message: str, receiver_username: str):
        if receiver_username in self.active_connections:
            await self.active_connections[receiver_username].send_text(message)
            return True
        return False

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)
    
    def get_active_users(self):
        return list(self.active_connections.keys())

manager = ConnectionManager()

@app.get("/admin/online-users/")
def get_online_users():
    return {"online_users": manager.get_active_users()}

@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    is_connected = await manager.connect(websocket, username)
    if not is_connected:
        await websocket.accept()
        await websocket.send_text("[SYSTEM] Error: This name is already in use!")
        await websocket.close()
        return

    await websocket.send_text(f"[SYSTEM] Welcome {username}, secure connection established.")
    try:
        while True:
            data = await websocket.receive_text()
            parts = data.split("|", 2)
            if len(parts) == 3:
                target_user = parts[0]
                media_type = parts[1]
                content = parts[2]
                
                receiver_msg = f"[PRIVATE]{username}|{media_type}|{content}"
                success = await manager.send_personal_message(receiver_msg, target_user)
                sender_msg = f"[SENT]{target_user}|{media_type}|{content}"
                await websocket.send_text(sender_msg)
                
                if not success:
                    await websocket.send_text(f"[SYSTEM] Error: '{target_user}' is currently offline or the username is incorrect.")
    except WebSocketDisconnect:
        manager.disconnect(username)        

@app.post("/upload-chat-media/")
async def upload_chat_media(file: UploadFile = File(...)):
    try:
        os.makedirs(CHAT_DIR, exist_ok=True)
        file_location = os.path.join(CHAT_DIR, file.filename)
        
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)

        file_type = "file"
        filename_lower = file.filename.lower()
        if filename_lower.endswith(('.png', '.jpg', '.jpeg')): file_type = "image"
        elif filename_lower.endswith(('.mp4', '.mkv')): file_type = "video"
        elif filename_lower.endswith(('.wav', '.mp3')): file_type = "audio"

        return {"filename": file.filename, "type": file_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Local file upload failed!")

# Chat HTML Snippet
@app.get("/chat/")
async def chat_ui():
    return HTMLResponse("<h1>Testing Chat Route...</h1>")