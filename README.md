# OmniHide 🛡️
Advanced Multimodal Steganography & Secure Communication Portal.

---------------------------------------------------------------------------------------

## 🎨 FRONTEND (React.js + Vite)
This folder contains everything related to the User Interface, animations, and client-side logic.

* **`src/App.jsx`**: The master file. It handles the Glassmorphism UI, authentication, tab switching, WebSocket chat integration, and renders the Recharts-based Admin Dashboard.
* **`src/index.css`**: Contains Tailwind CSS imports and all custom keyframe animations (like the floating orbs and matrix grid background).
* **`package.json`**: Lists all the frontend dependencies (React, Tailwind, Recharts, etc.) required to run the UI.
* **`vite.config.js`**: The configuration file for the Vite bundler to keep the local frontend server fast and optimized.

---------------------------------------------------------------------------------------

## ⚙️ BACKEND (FastAPI + Python)
This folder is the brain of the project. It handles cryptography, file processing, database operations, and WebSocket tunneling.

* **`main.py`**: The core FastAPI server. It contains all API routes (login, tracking, admin controls) and the WebSocket connection manager for real-time chat.
* **`models.py`**: Contains the SQLAlchemy database schema. It defines the `User` table and tracks analytics data (like encrypted/decrypted file counts).
* **`database.py`**: Sets up the SQLite database connection and engine configurations.
* **`crypto_engine.py`**: Handles the AES-256 military-grade encryption and uses PBKDF2HMAC to convert user passwords into strong cryptographic keys.
* **`image_stego.py`**: The engine that uses the LSB (Least Significant Bit) technique to hide encrypted data inside image pixels.
* **`audio_stego.py`**: The engine that modifies audio wave frames to embed hidden payloads without ruining the sound quality.
* **`video_stego.py`**: The engine that extracts video frames, injects data into specific frames using OpenCV, and stitches them back together.
* **`local_storage/`**: The physical directory where the server temporarily saves `cover_files`, generated `encrypted_files`, and live `chat_files`.

-------------------------------------------------------------------------------------

## 🚀 How to Run Locally

### Frontend
```bash
cd frontend
npm install
npm run dev

**### Backend**
# 1. Enter the backend folder
cd backend

# 2. Install required Python dependencies
pip install -r requirements.txt

# 3. Start the FastAPI server
# It will run at http://127.0.0.1:8000
uvicorn main:app --reload
