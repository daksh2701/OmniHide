import { useState, useRef, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// 🟢 LOCAL SERVER LINKS
const API_BASE = "http://127.0.0.1:8000"
const WS_BASE = "ws://127.0.0.1:8000/ws"

// === BACKGROUND ANIMATION COMPONENT ===
const AnimatedBackground = () => (
  <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#05080f]">
    {/* Moving Grid */}
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] animate-grid-pan"></div>
    {/* Floating Orbs */}
    <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[120px] animate-orb-1"></div>
    <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[150px] animate-orb-2"></div>
  </div>
);

export default function App() {
  // === INTRO ANIMATION STATE ===
  const [showIntro, setShowIntro] = useState(true)

  // === AUTHENTICATION STATES ===
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  
  // === ADMIN STATES ===
  const [isAdmin, setIsAdmin] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('') // 🟢 Naya state search bar ke liye
  const [sysStats, setSysStats] = useState({ 
    images_encrypted: 0, audios_encrypted: 0, videos_encrypted: 0, total_encrypted: 0, 
    images_decrypted: 0, audios_decrypted: 0, videos_decrypted: 0, total_decrypted: 0, 
    chat_media: 0 
  })

  // === SYSTEM STATES ===
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState('')
  const [activeTab, setActiveTab] = useState('encrypt')

  // === CHAT STATES ===
  const [targetUser, setTargetUser] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [messages, setMessages] = useState([])
  const [selectedChatFile, setSelectedChatFile] = useState(null)
  
  // === STEGANOGRAPHY STATES ===
  const [mediaType, setMediaType] = useState('image') 
  const [stegoFile, setStegoFile] = useState(null)
  const [stegoMessage, setStegoMessage] = useState('')
  const [stegoPassword, setStegoPassword] = useState('')
  const [stegoResult, setStegoResult] = useState(null)
  const [stegoLoading, setStegoLoading] = useState(false)

  const ws = useRef(null)
  const messagesEndRef = useRef(null)

  // Intro Animation Timer
  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  // Auto-scroll chat
  useEffect(() => { 
    if(activeTab === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, activeTab])


  // 1. AUTHENTICATION LOGIC
 
  const switchMode = (mode) => {
    setAuthMode(mode); setOtpSent(false); setStatusMsg(''); setOtp(''); setPassword('');
  }

  const requestOtp = async (e) => {
    e.preventDefault()
    if(!email) return alert("Enter your Email address first!")
    setStatusMsg("Sending OTP... ⏳")
    let formData = new FormData()
    formData.append("email", email)
    try {
      let res = await fetch(API_BASE + "/request-otp/", { method: "POST", body: formData })
      let data = await res.json()
      if(res.ok) {
        setOtpSent(true); setStatusMsg("✅ OTP sent successfully!")
      } else {
        let errorText = Array.isArray(data.detail) ? "Invalid email format!" : data.detail;
        setStatusMsg("❌ Error: " + errorText)
      }
    } catch (err) { setStatusMsg("❌ Failed to connect to server!") }
  }

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    if ((authMode === 'signup' || authMode === 'forgot') && !otpSent) return requestOtp(e);

    setStatusMsg("Processing... ⏳")
    let formData = new FormData()
    let endpoint = ""
    
    if (authMode === 'login') {
      formData.append("email", email); formData.append("password", password); endpoint = "/login/"
    } else if (authMode === 'admin') {
      formData.append("email", email); formData.append("password", password); endpoint = "/admin-login/"
    } else if (authMode === 'signup') {
      formData.append("username", username); formData.append("email", email);
      formData.append("password", password); formData.append("otp", otp); endpoint = "/signup-with-otp/"
    } else if (authMode === 'forgot') {
      formData.append("email", email); formData.append("new_password", password);
      formData.append("otp", otp); endpoint = "/reset-password/"
    }

    try {
      let res = await fetch(API_BASE + endpoint, { method: "POST", body: formData })
      let data = await res.json()
      if(res.ok) {
        setStatusMsg("🎉 " + data.message)
        if (authMode === 'forgot') {
          setTimeout(() => switchMode('login'), 2000)
        } else if (authMode === 'admin') {
          setIsAdmin(true); setCurrentUser("SuperAdmin");
          setTimeout(() => { setIsLoggedIn(true); fetchAdminData(); }, 1000)
        } else {
          setCurrentUser(data.username);
          setTimeout(() => { setIsLoggedIn(true); connectWebSocket(data.username); }, 1000)
        }
      } else {
        let errorText = Array.isArray(data.detail) ? "Please fill all required fields correctly!" : data.detail;
        setStatusMsg("❌ Error: " + errorText)
      }
    } catch (err) { setStatusMsg("❌ Server error!") }
  }

  
  // ADMIN & SYSTEM LOGIC
  const fetchAdminData = async () => {
    try {
      let usersRes = await fetch(API_BASE + "/admin/users/")
      let onlineRes = await fetch(API_BASE + "/admin/online-users/")
      let statsRes = await fetch(API_BASE + "/admin/stats/") 
      if(usersRes.ok && onlineRes.ok && statsRes.ok) {
        setAllUsers(await usersRes.json()); setOnlineUsers((await onlineRes.json()).online_users); setSysStats(await statsRes.json());
      }
    } catch (e) { console.log("Admin fetch error", e) }
  }

  const deleteUser = async (emailToDelete) => {
    if(!window.confirm("Are you sure you want to terminate this agent?")) return;
    let formData = new FormData(); formData.append("email", emailToDelete);
    try {
      let res = await fetch(API_BASE + "/delete-user/", { method: "DELETE", body: formData })
      if(res.ok) { alert("Agent terminated successfully!"); fetchAdminData(); }
    } catch(e) { alert("Failed to delete agent.") }
  }
  
  const sendBroadcast = async () => {
    if(!broadcastMsg.trim()) return alert("Message cannot be empty!")
    try {
      let res = await fetch(API_BASE + "/admin/broadcast/", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: broadcastMsg })
      })
      if(res.ok) { alert("🚨 Broadcast sent successfully!"); setBroadcastMsg(''); }
    } catch(e) { alert("Failed to send broadcast.") }
  }

  const purgeServer = async () => {
    if(!window.confirm("WARNING: Are you sure you want to delete ALL media and encrypted files from the server? This cannot be undone!")) return;
    try {
      let res = await fetch(API_BASE + "/admin/purge/", { method: "DELETE" })
      let data = await res.json()
      if(res.ok) { alert(data.message); fetchAdminData(); }
    } catch(e) { alert("Failed to purge server.") }
  }

  // CHAT ENGINE

  const connectWebSocket = (user) => {
    if (ws.current) ws.current.close()
    ws.current = new WebSocket(WS_BASE + "/" + user)
    ws.current.onmessage = (event) => {
      setMessages(prev => [...prev, event.data])
      if (event.data.includes("ADMIN ALERT")) {
        setTimeout(() => { setMessages(prev => prev.filter(msg => msg !== event.data)); }, 120000);
      }
    }
    ws.current.onclose = () => setMessages(prev => [...prev, "[SYSTEM]🔴 Connection closed. You are offline."])
  }

  const sendMessage = () => {
    if (!targetUser) return alert("Enter the recipient's username first!")
    if (!messageInput.trim()) return
    ws.current.send(targetUser + "|text|" + messageInput)
    setMessageInput('')
  }

  const sendChatFile = async () => {
    if (!targetUser) return alert("Enter the recipient's username first!")
    if (!selectedChatFile) return alert("Select a media file first!")
    let formData = new FormData(); formData.append("file", selectedChatFile);
    setStatusMsg("Uploading... ⏳")
    try {
      let res = await fetch(API_BASE + "/upload-chat-media/", { method: "POST", body: formData })
      let data = await res.json()
      if(res.ok) {
        ws.current.send(targetUser + "|" + data.type + "|" + data.filename)
        setSelectedChatFile(null); setStatusMsg(""); document.getElementById('chatFileInput').value = '';
      }
    } catch (err) { setStatusMsg("❌ File upload failed!") }
  }

  const logout = () => {
    if(ws.current) ws.current.close()
    setIsLoggedIn(false); setIsAdmin(false); setMessages([]); setCurrentUser(''); setActiveTab('encrypt'); switchMode('login');
  }

  // STEGANOGRAPHY ENGINE
  
  const handleEncrypt = async (e) => {
    e.preventDefault()
    if(!stegoFile) return alert("Please select a cover file!")
    setStegoLoading(true); setStegoResult(null);
    let formData = new FormData()
    formData.append("secret_message", stegoMessage); formData.append("password", stegoPassword); formData.append("file", stegoFile);
    try {
      let res = await fetch(API_BASE + "/hide-in-" + mediaType + "/", { method: "POST", body: formData })
      let data = await res.json()
      if(res.ok) {
        let fileName = data["stego_" + mediaType + "_path"].split("\\").pop().split("/").pop()
        setStegoResult({ type: 'success', msg: 'Operation Successful! Your file is ready.', link: API_BASE + "/media/encrypted_files/" + fileName })
        fetch(API_BASE + "/track-activity/", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: currentUser, action: "encrypt", media_type: mediaType })
        }).catch(err => console.log("Tracking failed", err))
      } else { setStegoResult({ type: 'error', msg: data.detail }) }
    } catch(err) { setStegoResult({ type: 'error', msg: "Encryption failed! Server error." }) }
    setStegoLoading(false)
  }

  const handleDecrypt = async (e) => {
    e.preventDefault()
    if(!stegoFile) return alert("Please select an encrypted file!")
    setStegoLoading(true); setStegoResult(null);
    let formData = new FormData()
    formData.append("password", stegoPassword); formData.append("file", stegoFile);
    try {
      let res = await fetch(API_BASE + "/extract-from-" + mediaType + "/", { method: "POST", body: formData })
      let data = await res.json()
      if(res.ok) {
        setStegoResult({ type: 'success', msg: "Extracted Secret: " + data.your_secret_message })
        fetch(API_BASE + "/track-activity/", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: currentUser, action: "decrypt", media_type: mediaType })
        }).catch(err => console.log("Tracking failed", err))
      } else { setStegoResult({ type: 'error', msg: "Extraction failed! Incorrect password or invalid file." }) }
    } catch(err) { setStegoResult({ type: 'error', msg: "Decryption failed! Server error." }) }
    setStegoLoading(false)
  }

  // Helpers for Right Panel info
  const getFileSize = (file) => {
    if(!file) return "0 KB";
    let kb = file.size / 1024;
    if(kb > 1024) return (kb / 1024).toFixed(2) + " MB";
    return kb.toFixed(2) + " KB";
  }

  const getMessageBytes = (msg) => {
    return new Blob([msg]).size;
  }

  
  // RENDER 0: HIGH-TECH INTRO
 
  if (showIntro) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#05080f] overflow-hidden font-sans relative">
        <AnimatedBackground />
        <div className="relative text-center z-10 backdrop-blur-sm p-12 rounded-3xl border border-white/5 bg-black/20 shadow-2xl">
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-purple-400 to-indigo-500 animate-pulse">
            OmniHide
          </h1>
          <div className="mt-8 h-1 w-64 bg-white/5 mx-auto rounded-full overflow-hidden shadow-inner">
             <div className="h-full bg-gradient-to-r from-teal-400 to-purple-500 animate-load-progress"></div>
          </div>
          <p className="mt-6 text-teal-200/70 font-mono font-semibold tracking-[0.3em] uppercase text-sm animate-pulse">
            Initializing Core Systems...
          </p>
        </div>
      </div>
    )
  }

  // RENDER 1: AUTHENTICATION

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-[#05080f] font-sans relative">
        <AnimatedBackground />
        <div className="relative p-8 w-full max-w-md rounded-2xl shadow-2xl bg-[#0b1118]/80 backdrop-blur-xl border border-white/10 overflow-hidden z-10">
          <div className="relative z-10 text-center">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-2 drop-shadow-lg">OmniHide</h1>
            <p className="text-gray-400 mb-6 font-medium text-sm">
              {authMode === 'login' && "Secure Agent Login"}
              {authMode === 'admin' && <span className="text-red-400 font-bold">Command Center Access</span>}
              {authMode === 'signup' && "Register Secret Identity"}
              {authMode === 'forgot' && "Reset Security Key"}
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
              {(authMode === 'login' || authMode === 'admin') && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Email</label>
                    <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required 
                      className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg p-3 text-gray-200 outline-none focus:border-purple-500 transition-colors backdrop-blur-md" placeholder="agent@omnihide.com"/>
                  </div>
                  <div>
                    <div className="flex justify-between mt-1">
                      <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Password</label>
                      {authMode === 'login' && <button type="button" onClick={() => switchMode('forgot')} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">Forgot Password?</button>}
                    </div>
                    <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required 
                      className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg p-3 text-gray-200 outline-none focus:border-purple-500 transition-colors backdrop-blur-md" placeholder="••••••••"/>
                  </div>
                  <button type="submit" className={`w-full mt-6 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:-translate-y-0.5 active:scale-95 bg-gradient-to-r ${authMode === 'admin' ? 'from-red-600 to-orange-600' : 'from-purple-500 to-indigo-600'}`}>
                    {authMode === 'admin' ? 'Access Command Center' : 'Login Securely'}
                  </button>
                  
                  {authMode === 'login' && (
                    <div className="text-center mt-6">
                      <p className="text-sm text-gray-400">
                        New Agent? <button type="button" onClick={() => switchMode('signup')} className="text-purple-400 hover:text-purple-300 font-bold ml-1 drop-shadow-md">Sign up</button>
                      </p>
                      <button type="button" onClick={() => switchMode('admin')} className="text-red-400/80 hover:text-red-400 text-xs font-bold mt-6 block mx-auto tracking-widest uppercase px-4 py-2 rounded-lg hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/30 backdrop-blur-sm">
                        🛡️ Admin Override
                      </button>
                    </div>
                  )}

                  {authMode === 'admin' && (
                    <button type="button" onClick={() => switchMode('login')} className="w-full text-center mt-6 text-sm text-gray-400 hover:text-gray-200 transition-colors">Back to Agent Login</button>
                  )}
                </>
              )}

              {(authMode === 'signup' || authMode === 'forgot') && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Email</label>
                    <div className="flex gap-2 mt-1">
                      <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required 
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-gray-200 outline-none focus:border-purple-500 transition-colors backdrop-blur-md" placeholder="agent@secret.com"/>
                      <button type="button" onClick={requestOtp} className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 rounded-lg text-xs transition-colors shadow-md">Get OTP</button>
                    </div>
                  </div>
                  {otpSent && (
                    <div className="space-y-4 mt-4 animate-fade-in">
                      <input type="text" value={otp} onChange={(e)=>setOtp(e.target.value)} required maxLength="4"
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white text-center tracking-widest text-xl outline-none focus:border-purple-500 transition-colors backdrop-blur-md" placeholder="Enter OTP"/>
                      {authMode === 'signup' && (
                        <input type="text" value={username} onChange={(e)=>setUsername(e.target.value)} required 
                          className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-gray-200 outline-none focus:border-purple-500 transition-colors backdrop-blur-md" placeholder="Choose Username"/>
                      )}
                      <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required 
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-gray-200 outline-none focus:border-purple-500 transition-colors backdrop-blur-md" placeholder="New Password"/>
                      <button type="submit" className="w-full mt-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:-translate-y-0.5 active:scale-95">
                        Verify & Proceed
                      </button>
                    </div>
                  )}
                  <button type="button" onClick={() => switchMode('login')} className="w-full text-center mt-6 text-sm text-gray-400 hover:text-gray-200 transition-colors">Back to Login</button>
                </>
              )}
            </form>
            {statusMsg && <p className={`mt-4 text-sm font-semibold ${authMode === 'admin' ? 'text-red-400' : 'text-teal-300'}`}>{statusMsg}</p>}
          </div>
        </div>
      </div>
    )
  }


  // RENDER 2: ADMIN DASHBOARD 

  if (isLoggedIn && isAdmin) {
    return (
      <div className="min-h-screen bg-[#05080f] p-6 text-gray-200 font-sans relative overflow-x-hidden">
        <AnimatedBackground />
        <div className="max-w-6xl mx-auto space-y-6 relative z-10">
          <div className="flex justify-between items-center bg-[#0b1118]/80 backdrop-blur-xl border border-red-500/20 p-6 rounded-2xl shadow-2xl">
            <div>
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-500 tracking-wider drop-shadow-md">COMMAND CENTER</h1>
              <p className="text-gray-400 text-sm mt-1">SuperAdmin Dashboard</p>
            </div>
            <div className="flex gap-4">
              <button onClick={fetchAdminData} className="bg-black/40 border border-white/10 hover:border-purple-500/50 text-gray-300 px-4 py-2 rounded-lg font-bold transition-all backdrop-blur-md">↻ Refresh</button>
              <button onClick={logout} className="bg-red-500/10 hover:bg-red-500 border border-red-500/50 text-red-400 hover:text-white px-6 py-2 rounded-lg font-bold transition-all backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.2)]">Lock Console</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Active Agents */}
            <div className="bg-[#0b1118]/80 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-xl flex flex-col">
              <h2 className="text-lg font-bold text-teal-400 mb-4 flex items-center gap-2 drop-shadow-md">
                <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></span> Active Agents ({onlineUsers.length})
              </h2>
              <div className="space-y-2 overflow-y-auto max-h-[300px] custom-scrollbar pr-2 flex-grow">
                {onlineUsers.length === 0 ? <p className="text-gray-500 text-sm italic">No active sessions.</p> : 
                  onlineUsers.map((u, i) => <div key={i} className="bg-black/40 border border-white/5 p-3 rounded-lg text-teal-200 font-mono text-sm tracking-wide">⚡ {u}</div>)
                }
              </div>
            </div>

            {/*  AGENT ROSTER (WITH SEARCH BAR) */}
            <div className="bg-[#0b1118]/80 backdrop-blur-xl border border-white/5 p-6 rounded-2xl md:col-span-1 shadow-xl flex flex-col">
              <h2 className="text-lg font-bold text-indigo-400 mb-4 drop-shadow-md">Agent Roster ({allUsers.length})</h2>
              
              {/* Search Input Bar */}
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500">🔍</span>
                </div>
                <input 
                  type="text" 
                  placeholder="Find by username/email..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500 transition-colors backdrop-blur-md"
                />
              </div>

              <div className="overflow-y-auto max-h-[250px] pr-2 space-y-3 custom-scrollbar flex-grow">
                {allUsers
                  .filter(user => 
                    user.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    user.email.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((user, idx) => (
                  <div key={idx} className="bg-black/40 border border-white/5 p-4 rounded-xl flex flex-col gap-3 transition hover:bg-white/5">
                    <div className="flex justify-between items-start">
                      <div className="overflow-hidden">
                        <p className="font-bold text-gray-200 text-sm truncate">👤 {user.username}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-1 truncate">{user.email}</p>
                      </div>
                      <button onClick={() => deleteUser(user.email)} className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-2 py-1 rounded text-[10px] font-bold transition-colors border border-transparent hover:border-red-500/50 shrink-0 ml-2">Revoke</button>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-white/5">
                      <div className="flex-1 bg-black/40 rounded px-2 py-1 text-[10px] text-gray-400 text-center">Enc: <span className="font-bold text-teal-400 ml-1">{user.enc_count || 0}</span></div>
                      <div className="flex-1 bg-black/40 rounded px-2 py-1 text-[10px] text-gray-400 text-center">Dec: <span className="font-bold text-purple-400 ml-1">{user.dec_count || 0}</span></div>
                    </div>
                  </div>
                ))}
                
                {allUsers.filter(user => 
                  user.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  user.email.toLowerCase().includes(searchQuery.toLowerCase())
                ).length === 0 && (
                  <p className="text-gray-500 text-sm italic text-center mt-4">No agents found.</p>
                )}
              </div>
            </div>

            {/* System Insights */}
            <div className="bg-[#0b1118]/80 backdrop-blur-xl border border-purple-500/20 p-6 rounded-2xl flex flex-col gap-4 shadow-[0_0_30px_rgba(168,85,247,0.05)]">
              <h2 className="text-lg font-bold text-purple-400 drop-shadow-md">📊 System Insights</h2>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex-grow flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-400 text-sm font-medium">Activity Overview</span>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500">Total Encrypted: <span className="text-teal-400 font-bold text-xs">{sysStats.total_encrypted || 0}</span></p>
                    <p className="text-[10px] text-gray-500">Total Decrypted: <span className="text-purple-400 font-bold text-xs">{sysStats.total_decrypted || 0}</span></p>
                  </div>
                </div>
                
                {/* Chart Container */}
                <div className="flex-grow w-full min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={[
                        { name: 'IMG', Encrypted: sysStats.images_encrypted || 0, Decrypted: sysStats.images_decrypted || 0 },
                        { name: 'AUD', Encrypted: sysStats.audios_encrypted || 0, Decrypted: sysStats.audios_decrypted || 0 },
                        { name: 'VID', Encrypted: sysStats.videos_encrypted || 0, Decrypted: sysStats.videos_decrypted || 0 }
                      ]} 
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#0b1118', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                      <Bar dataKey="Encrypted" fill="#2dd4bf" radius={[4, 4, 0, 0]} barSize={24} />
                      <Bar dataKey="Decrypted" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex justify-center gap-6 mt-3 border-t border-white/5 pt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.5)]"></div>
                    <span className="text-xs text-gray-400">Encrypted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                    <span className="text-xs text-gray-400">Decrypted</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#0b1118]/80 backdrop-blur-xl border border-orange-500/20 p-6 rounded-2xl shadow-xl">
              <h2 className="text-lg font-bold text-orange-400 mb-4 drop-shadow-md">📢 Global Broadcast</h2>
              <div className="flex gap-2">
                <input type="text" value={broadcastMsg} onChange={(e)=>setBroadcastMsg(e.target.value)} className="flex-grow bg-black/40 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-orange-500/50 backdrop-blur-md" placeholder="Type warning message..."/>
                <button onClick={sendBroadcast} className="bg-orange-500/20 hover:bg-orange-500 text-orange-400 hover:text-white font-bold px-6 rounded-lg transition-colors border border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]">Send</button>
              </div>
            </div>
            <div className="bg-[#0b1118]/80 backdrop-blur-xl border border-red-500/20 p-6 rounded-2xl flex flex-col justify-center items-center text-center shadow-xl">
              <h2 className="text-lg font-bold text-red-400 mb-2 drop-shadow-md">🧹 Storage Manager</h2>
              <p className="text-xs text-gray-400 mb-4">Securely wipe all local media arrays and reset database counters.</p>
              <button onClick={purgeServer} className="bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white px-8 py-3 rounded-lg font-bold transition-all w-full border border-red-500/30 tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.15)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]">INITIATE PURGE</button>
            </div>
          </div>
        </div>
      </div>
    )
  }


  // RENDER 3: USER DASHBOARD
  return (
    <div className="flex h-screen bg-transparent text-gray-200 font-sans overflow-hidden relative">
      <AnimatedBackground />

      {/* --- LEFT SIDEBAR NAVIGATION --- */}
      <aside className="w-64 bg-[#0b1118]/70 backdrop-blur-2xl border-r border-white/5 flex flex-col justify-between hidden md:flex shrink-0 z-10 shadow-2xl">
        <div>
          <div className="p-6 pb-8 border-b border-white/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center font-black text-white shadow-lg">O</div>
            <h1 className="text-xl font-bold tracking-wide text-white drop-shadow-md">OmniHide</h1>
          </div>
          
          <nav className="p-4 space-y-2 mt-4">
            {[
              { id: 'encrypt', label: 'Encode Data', icon: '🔒' },
              { id: 'decrypt', label: 'Decode Data', icon: '🔓' },
              { id: 'chat', label: 'Secure Comms', icon: '💬' }
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => { setActiveTab(tab.id); setStegoFile(null); setStegoResult(null); setStegoMessage(''); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${activeTab === tab.id ? 'bg-gradient-to-r from-purple-500/80 to-indigo-500/80 border border-white/10 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 bg-black/40 rounded-xl mb-4 border border-white/5">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_8px_rgba(45,212,191,0.8)]"></div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Current Agent</p>
              <p className="text-sm font-bold text-gray-200">{currentUser}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors font-medium border border-transparent hover:border-red-500/30">Log out</button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto relative custom-scrollbar z-10">
        
        {/* Mobile Header */}
        <div className="md:hidden flex justify-between items-center p-4 bg-[#0b1118]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
          <h1 className="font-bold text-white">OmniHide</h1>
          <div className="flex gap-2">
            <button onClick={()=>setActiveTab('encrypt')} className={`px-3 py-1 rounded text-xs ${activeTab==='encrypt'?'bg-purple-500/80 border border-white/20':'bg-black/50 border border-white/5'}`}>Enc</button>
            <button onClick={()=>setActiveTab('decrypt')} className={`px-3 py-1 rounded text-xs ${activeTab==='decrypt'?'bg-purple-500/80 border border-white/20':'bg-black/50 border border-white/5'}`}>Dec</button>
            <button onClick={()=>setActiveTab('chat')} className={`px-3 py-1 rounded text-xs ${activeTab==='chat'?'bg-purple-500/80 border border-white/20':'bg-black/50 border border-white/5'}`}>Chat</button>
          </div>
        </div>

        {/* --- TAB: ENCRYPT & DECRYPT UI --- */}
        {(activeTab === 'encrypt' || activeTab === 'decrypt') && (
          <div className="p-6 md:p-10 max-w-4xl mx-auto w-full animate-fade-in">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2 drop-shadow-md">{activeTab === 'encrypt' ? 'Encode Data' : 'Decode Data'}</h1>
              <p className="text-gray-400 text-sm font-medium">{activeTab === 'encrypt' ? 'Hide secret messages or files inside standard media types securely.' : 'Extract hidden data from modified media files using your security key.'}</p>
            </div>

            <form onSubmit={activeTab === 'encrypt' ? handleEncrypt : handleDecrypt} className="space-y-6">
              
              <div className="bg-[#0b1118]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2"><span className="bg-purple-500/20 text-purple-400 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(168,85,247,0.3)]">1</span> Format Protocol</h3>
                <div className="flex gap-3">
                  {['image', 'audio', 'video'].map(type => (
                    <button key={type} type="button" onClick={() => setMediaType(type)} className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${mediaType === type ? 'bg-gradient-to-r from-purple-500/90 to-indigo-500/90 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-white/20' : 'bg-black/40 border border-white/5 text-gray-400 hover:bg-white/10'}`}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#0b1118]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2"><span className="bg-purple-500/20 text-purple-400 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(168,85,247,0.3)]">2</span> {activeTab === 'encrypt' ? 'Select Cover ' + mediaType : 'Select Encrypted ' + mediaType}</h3>
                <div className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-sm ${stegoFile ? 'border-teal-500/50 bg-teal-500/10 shadow-[0_0_30px_rgba(45,212,191,0.1)inset]' : 'border-white/10 hover:border-purple-500/50 bg-black/20 hover:bg-white/5'}`}>
                  <input type="file" required accept={mediaType + "/*"} onChange={(e)=>setStegoFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-2 shadow-lg ${stegoFile ? 'bg-teal-500/20 border border-teal-500/30' : 'bg-white/5 border border-white/10'}`}>📁</div>
                  {stegoFile ? (
                    <div>
                      <p className="text-teal-300 font-bold tracking-wide">{stegoFile.name}</p>
                      <p className="text-xs text-teal-500/80 mt-1">{getFileSize(stegoFile)}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-300 font-medium tracking-wide">Drag & drop or click to browse</p>
                      <p className="text-xs text-gray-500 mt-2">Supports standard {mediaType} formats up to 50MB</p>
                    </div>
                  )}
                </div>
              </div>

              {activeTab === 'encrypt' && (
                <div className="bg-[#0b1118]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl animate-fade-in">
                  <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2"><span className="bg-purple-500/20 text-purple-400 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(168,85,247,0.3)]">3</span> Classified Data</h3>
                  <textarea required value={stegoMessage} onChange={(e)=>setStegoMessage(e.target.value)} rows="3" className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-gray-200 outline-none focus:border-purple-500/80 focus:bg-black/60 transition-all custom-scrollbar backdrop-blur-md shadow-inner" placeholder="Enter the secret message you wish to hide..."/>
                </div>
              )}

              <div className="bg-[#0b1118]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2"><span className="bg-purple-500/20 text-purple-400 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(168,85,247,0.3)]">{activeTab === 'encrypt' ? '4' : '3'}</span> Security Key</h3>
                <div className="flex flex-col md:flex-row gap-4">
                  <input type="password" required value={stegoPassword} onChange={(e)=>setStegoPassword(e.target.value)} className="flex-grow bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-gray-200 outline-none focus:border-purple-500/80 focus:bg-black/60 transition-all backdrop-blur-md shadow-inner" placeholder="Enter strong encryption password..."/>
                  <button type="submit" disabled={stegoLoading} className="bg-gradient-to-r from-purple-500/90 to-indigo-500/90 hover:from-purple-400 hover:to-indigo-400 border border-white/20 text-white font-bold py-4 px-8 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap">
                    {stegoLoading ? "Processing..." : (activeTab === 'encrypt' ? "Encode & Generate" : "Decrypt & Reveal")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* --- TAB: CHAT UI --- */}
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col p-4 md:p-8 animate-fade-in max-w-5xl mx-auto w-full">
            <div className="mb-6 text-center md:text-left">
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2 drop-shadow-md">Secure Communications</h1>
              <p className="text-gray-400 text-sm font-medium">End-to-end socket connection for real-time agent comms.</p>
            </div>
            
            <div className="flex-1 bg-[#0b1118]/70 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col min-h-[500px]">
              <div className="bg-white/5 p-5 border-b border-white/10 flex items-center gap-4 backdrop-blur-md">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(99,102,241,0.2)]">📡</div>
                <input type="text" value={targetUser} onChange={(e)=>setTargetUser(e.target.value)} className="flex-grow bg-transparent border-none text-white text-lg outline-none font-bold placeholder-gray-500 tracking-wide" placeholder="Enter target Agent ID..." />
              </div>

              <div className="flex-grow p-6 overflow-y-auto space-y-5 custom-scrollbar bg-black/20">
                {messages.length === 0 && <div className="h-full flex items-center justify-center text-gray-500 italic text-sm font-medium tracking-wide">Socket open. Waiting for transmissions...</div>}
                
                {messages.map((msg, idx) => {
                  if (msg.includes("ADMIN ALERT")) {
                    return (
                      <div key={idx} className="flex justify-center my-6 animate-fade-in">
                        <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-2xl max-w-[85%] text-center backdrop-blur-md shadow-[0_0_30px_rgba(239,68,68,0.15)]">
                          <span className="block text-red-500 font-black mb-2 tracking-[0.2em] text-lg drop-shadow-md">⚠️ SYSTEM OVERRIDE ⚠️</span>
                          <span className="text-red-200 text-sm font-medium tracking-wide">{msg.replace("[SYSTEM]🔴 ADMIN ALERT: ", "")}</span>
                        </div>
                      </div>
                    )
                  }
                  if (msg.startsWith("🟢") || msg.startsWith("🔴") || msg.startsWith("[SYSTEM]")) {
                    return <div key={idx} className="text-center text-sm font-bold text-teal-400/90 my-4 animate-fade-in tracking-wider drop-shadow-sm">{msg.replace("[SYSTEM]", "")}</div>
                  }
                  let isMine = msg.startsWith("[SENT]");
                  let cleanMsg = msg.replace("[PRIVATE]", "").replace("[SENT]", "");
                  let [user, type, content] = cleanMsg.split("|");
                  
                  return (
                    <div key={idx} className={`flex flex-col max-w-[80%] md:max-w-[70%] animate-fade-in ${isMine ? "ml-auto items-end" : "mr-auto items-start"}`}>
                      <span className="text-[10px] text-gray-500 mb-1 ml-1 font-bold tracking-wider">{isMine ? "To: " + user : "From: " + user}</span>
                      <div className={`p-4 rounded-2xl text-sm shadow-xl backdrop-blur-sm border ${isMine ? "bg-indigo-600/90 border-indigo-500/50 text-white rounded-tr-sm shadow-[0_5px_20px_rgba(79,70,229,0.3)]" : "bg-black/60 text-gray-200 border-white/10 rounded-tl-sm"}`}>
                        {type === 'text' && <p className="leading-relaxed">{content}</p>}
                        {type === 'image' && <img src={API_BASE + "/media/chat_files/" + content} alt="media" className="max-w-[200px] md:max-w-xs rounded-xl border border-white/10 shadow-md"/>}
                        {type === 'video' && <video src={API_BASE + "/media/chat_files/" + content} controls className="max-w-[200px] md:max-w-xs rounded-xl border border-white/10 shadow-md"></video>}
                        {type === 'audio' && <audio src={API_BASE + "/media/chat_files/" + content} controls className="w-48 md:w-64 outline-none"></audio>}
                        {type === 'file' && <a href={API_BASE + "/media/chat_files/" + content} target="_blank" rel="noreferrer" className="text-teal-300 hover:text-teal-200 transition-colors underline font-bold flex items-center gap-2 tracking-wide">📎 Download Payload</a>}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="bg-white/5 p-5 border-t border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    <button className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 hover:bg-white/10 text-gray-300 flex items-center justify-center transition-all shadow-inner text-xl">📎</button>
                    <input type="file" onChange={(e) => setSelectedChatFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                  </div>
                  {selectedChatFile && (
                     <button onClick={sendChatFile} className="bg-teal-500/20 border border-teal-500/40 text-teal-400 text-xs px-5 py-3 rounded-xl font-bold hover:bg-teal-500 hover:text-white transition-all shadow-[0_0_15px_rgba(45,212,191,0.2)]">Upload</button>
                  )}
                  <input type="text" value={messageInput} onChange={(e)=>setMessageInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} className="flex-grow bg-black/40 border border-white/10 rounded-xl p-4 text-gray-100 text-sm outline-none focus:border-indigo-500/70 focus:bg-black/60 transition-all shadow-inner placeholder-gray-500" placeholder="Type secure transmission..." />
                  <button onClick={sendMessage} className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 border border-white/20 text-white w-14 h-14 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-transform active:scale-90 text-lg">➤</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- RIGHT SIDEBAR: OPERATION INFO, DATA INFO & TIPS --- */}
      {(activeTab === 'encrypt' || activeTab === 'decrypt') && (
        <aside className="w-[340px] bg-[#0b1118]/70 backdrop-blur-2xl border-l border-white/5 p-6 hidden lg:flex flex-col gap-5 shrink-0 overflow-y-auto custom-scrollbar z-10 shadow-2xl">
          
          <div className="bg-gradient-to-r from-purple-500/90 to-indigo-500/90 border border-white/20 p-4 rounded-xl text-white font-bold flex items-center gap-3 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
            <span className="text-xl drop-shadow-md">📊</span> <span className="tracking-wide drop-shadow-md">Operation Info</span>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-xl p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 flex items-center gap-2 drop-shadow-md">🖼️ Media Info</h3>
            {stegoFile ? (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0 shadow-inner">📄</div>
                  <div className="overflow-hidden pt-1">
                    <p className="text-sm font-bold text-gray-200 truncate tracking-wide">{stegoFile.name}</p>
                    <p className="text-xs text-teal-400 font-mono mt-1">{getFileSize(stegoFile)}</p>
                  </div>
                </div>
                <div className="bg-white/5 p-3 rounded-lg mt-2 space-y-1 border border-white/5">
                  <p className="text-[11px] text-gray-400 flex justify-between"><span>Format:</span> <span className="text-gray-200 font-mono">{stegoFile.type || 'Unknown'}</span></p>
                  <p className="text-[11px] text-gray-400 flex justify-between"><span>Target Engine:</span> <span className="text-purple-400 font-mono font-bold capitalize">{mediaType}</span></p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">📂 No media selected</p>
                <p className="text-xs text-gray-500 mb-2">Select media to see:</p>
                <ul className="text-[11px] text-gray-500 space-y-1.5 ml-4 list-disc marker:text-teal-500">
                  <li>File size and dimensions</li>
                  <li>Format type</li>
                  <li>Estimated capacity</li>
                </ul>
              </div>
            )}
          </div>

          <div className="bg-black/40 border border-white/10 rounded-xl p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 flex items-center gap-2 drop-shadow-md">💾 Data Info</h3>
            {(stegoMessage.length > 0 && activeTab === 'encrypt') ? (
              <div className="space-y-3 animate-fade-in">
                 <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 shadow-inner">📝</div>
                    <div className="pt-1">
                      <p className="text-sm font-bold text-gray-200 tracking-wide">Secret Payload</p>
                      <p className="text-xs text-purple-400 font-mono mt-1">{getMessageBytes(stegoMessage)} Bytes</p>
                    </div>
                 </div>
                 <div className="bg-white/5 p-3 rounded-lg mt-2 space-y-1.5 border border-white/5">
                   <p className="text-[11px] text-gray-400 flex justify-between"><span>Type:</span> <span className="text-gray-200 font-mono">Plain Text</span></p>
                   <p className="text-[11px] text-gray-400 flex justify-between"><span>Encryption:</span> <span className="text-green-400 font-bold tracking-wide">AES Ready</span></p>
                   <p className="text-[11px] text-gray-400 flex justify-between"><span>Feasibility:</span> <span className="text-teal-400 font-bold tracking-wide">Optimal</span></p>
                 </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">📄 No data selected</p>
                <p className="text-xs text-gray-500 mb-2">Data metrics will show:</p>
                <ul className="text-[11px] text-gray-500 space-y-1.5 ml-4 list-disc marker:text-purple-500">
                  <li>Size in bytes</li>
                  <li>Payload type (Text)</li>
                  <li>Encryption status</li>
                  <li>Feasibility check</li>
                </ul>
              </div>
            )}
          </div>

          <div className="bg-black/40 border border-white/10 rounded-xl p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 flex items-center gap-2 drop-shadow-md">⚡ Status</h3>
            {stegoResult ? (
               <div className={`p-4 rounded-xl border backdrop-blur-lg animate-fade-in shadow-inner ${stegoResult.type === 'success' ? 'bg-teal-500/10 border-teal-500/40 text-teal-300' : 'bg-red-500/10 border-red-500/40 text-red-400'}`}>
                 <p className="text-sm font-bold break-words tracking-wide">{stegoResult.msg}</p>
                 {stegoResult.link && (
                   <a href={stegoResult.link} target="_blank" rel="noreferrer" className="inline-block mt-4 bg-teal-500 text-gray-900 text-xs font-black tracking-wider px-5 py-2.5 rounded-lg hover:bg-teal-400 transition-colors shadow-[0_0_15px_rgba(45,212,191,0.4)]">DOWNLOAD RESULT</a>
                 )}
               </div>
            ) : (
              <div className="bg-teal-500/10 border border-teal-500/20 p-4 rounded-xl shadow-inner">
                <p className="text-sm font-bold text-teal-400 mb-1 flex items-center gap-2 drop-shadow-md">🚀 Ready to {activeTab === 'encrypt' ? 'encode' : 'decode'}</p>
                <p className="text-[11px] text-gray-400 font-medium leading-relaxed">Configure settings above and click <br/>'{activeTab === 'encrypt' ? 'Encode & Generate' : 'Decrypt & Reveal'}'</p>
              </div>
            )}
          </div>

          <div className="bg-black/40 border border-white/10 rounded-xl p-5 shadow-lg backdrop-blur-md mt-auto">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 flex items-center gap-2 drop-shadow-md">💡 Pro Tips</h3>
            <div className="space-y-3">
              <p className="text-[11px] text-gray-400"><strong className="text-gray-200 tracking-wide">PNG Format:</strong> Best for lossless image quality.</p>
              <p className="text-[11px] text-gray-400"><strong className="text-gray-200 tracking-wide">Large Images:</strong> More capacity for data.</p>
              <p className="text-[11px] text-gray-400"><strong className="text-gray-200 tracking-wide">Passwords:</strong> Use 8+ characters.</p>
              <p className="text-[11px] text-gray-400"><strong className="text-gray-200 tracking-wide">Testing:</strong> Always test extraction first.</p>
            </div>
          </div>

        </aside>
      )}

      {/* === CUSTOM STYLES & ANIMATIONS === */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        
        /* Grid Animation */
        @keyframes grid-pan {
          0% { transform: translateY(0); }
          100% { transform: translateY(50px); }
        }
        .animate-grid-pan { animation: grid-pan 3s linear infinite; }

        /* Floating Orbs Animation */
        @keyframes orb-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(100px, 100px) scale(1.2); }
        }
        @keyframes orb-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-100px, -100px) scale(1.1); }
        }
        .animate-orb-1 { animation: orb-1 20s ease-in-out infinite; }
        .animate-orb-2 { animation: orb-2 25s ease-in-out infinite alternate-reverse; }
        
        /* Fade In */
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  )
}