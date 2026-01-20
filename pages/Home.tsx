
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LogIn, LogOut, Coffee, GraduationCap, MapPin, Clock, Camera, Check, X, RefreshCw, Fingerprint, FileText, Calendar as CalendarIcon, Image as ImageIcon, AlertCircle, ShieldCheck, Navigation, Smartphone } from 'lucide-react';
import Header from '../components/Header';
import { User } from '../types';
import { submitToGoogleSheets, SubmissionPayload } from '../services/api';

interface HomeProps { user: User; }

// School coordinates for SMPN 1 Padarincang
const SCHOOL_LAT = -6.114196248039071;
const SCHOOL_LNG = 106.2276108127061;
const ALLOWED_RADIUS_METERS = 50; 

const Home: React.FC<HomeProps> = ({ user }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Status Global Aplikasi
  const [status, setStatus] = useState<'IDLE' | 'PRESENT' | 'OUT'>('IDLE');
  
  // Status Local Device (Device Lock)
  const [deviceLock, setDeviceLock] = useState<{in: boolean, out: boolean}>({in: false, out: false});
  
  const [showTeachingModal, setShowTeachingModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('PAI');
  const [selectedClass, setSelectedClass] = useState('VII - A');

  const [leaveType, setLeaveType] = useState<'Izin' | 'Sakit' | 'Dinas'>('Izin');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveAttachment, setLeaveAttachment] = useState<string | null>(null);

  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceType, setAttendanceType] = useState<'IN' | 'OUT' | 'TEACHING' | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DAFTAR KELAS DIPERBAHARUI (A sampai G)
  const roomOptions = [
    'VII - A', 'VII - B', 'VII - C', 'VII - D', 'VII - E', 'VII - F', 'VII - G',
    'VIII - A', 'VIII - B', 'VIII - C', 'VIII - D', 'VIII - E', 'VIII - F', 'VIII - G',
    'IX - A', 'IX - B', 'IX - C', 'IX - D', 'IX - E', 'IX - F', 'IX - G'
  ];

  // Cek apakah user adalah Guru/Pengajar untuk menampilkan tombol mengajar
  const isTeacher = useMemo(() => {
    const title = (user.jobTitle || user.role).toLowerCase();
    return title.includes('guru') || title.includes('pengajar') || title.includes('kepala') || title.includes('pendidik');
  }, [user]);
  
  // Helper Helper Helper untuk kompresi gambar
  const compressImage = (base64Str: string, maxWidth = 480, maxHeight = 640, quality = 0.5) => {
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  const getDeviceLockKey = () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return `device_lock_${dateStr}`;
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const key = getDeviceLockKey();
    const savedLock = localStorage.getItem(key);
    if (savedLock) {
      try {
        const parsed = JSON.parse(savedLock);
        setDeviceLock(parsed);
        if (parsed.in && !parsed.out) setStatus('PRESENT');
        else if (parsed.out) setStatus('OUT');
      } catch (e) {
        console.error("Error parsing device lock", e);
      }
    }
    return () => clearInterval(timer);
  }, []);

  const updateDeviceLock = (type: 'IN' | 'OUT') => {
    const key = getDeviceLockKey();
    const currentLock = JSON.parse(localStorage.getItem(key) || '{"in": false, "out": false}');
    if (type === 'IN') currentLock.in = true;
    if (type === 'OUT') currentLock.out = true;
    localStorage.setItem(key, JSON.stringify(currentLock));
    setDeviceLock(currentLock);
  };

  const pulangSchedule = useMemo(() => {
    const day = currentTime.getDay(); // 0 = Minggu, 5 = Jumat
    let targetH = 14;
    let targetM = 45;
    if (day === 5) { targetH = 11; targetM = 0; } 
    else if (day === 4) { targetH = 14; targetM = 10; }
    else { targetH = 14; targetM = 45; }
    return { h: targetH, m: targetM };
  }, [currentTime]);

  const isAfterPulangTime = useMemo(() => {
    const currentTotalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const targetTotalMinutes = pulangSchedule.h * 60 + pulangSchedule.m;
    return currentTotalMinutes >= targetTotalMinutes;
  }, [currentTime, pulangSchedule]);

  const pulangTimeLabel = useMemo(() => {
    return `${pulangSchedule.h.toString().padStart(2, '0')}:${pulangSchedule.m.toString().padStart(2, '0')}`;
  }, [pulangSchedule]);

  const isPulangDisabled = status !== 'PRESENT' || !isAfterPulangTime || deviceLock.out;
  const isMasukDisabled = status !== 'IDLE' || deviceLock.in;

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const formatTime = (date: Date) => date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (date: Date) => date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const clearErrors = () => setErrors({});

  const handleOpenTeaching = () => {
    const now = new Date();
    const start = now.toTimeString().slice(0, 5);
    const endObj = new Date(now.getTime() + 60 * 60 * 1000);
    setStartTime(start);
    setEndTime(endObj.toTimeString().slice(0, 5));
    setAttendanceType('TEACHING');
    setPhoto(null);
    clearErrors();
    setShowTeachingModal(true);
    startCamera();
  };

  const openAttendanceModal = (type: 'IN' | 'OUT') => {
    setAttendanceType(type);
    setShowAttendanceModal(true);
    setPhoto(null);
    clearErrors();
    getLocation();
    startCamera();
  };

  const closeAttendanceModal = () => {
    setShowAttendanceModal(false);
    stopCamera();
    setAttendanceType(null);
    setPhoto(null);
    setDistance(null);
    setLocation(null);
    clearErrors();
    setIsSubmitting(false);
  };

  const closeTeachingModal = () => {
    setShowTeachingModal(false);
    stopCamera();
    setAttendanceType(null);
    setPhoto(null);
    clearErrors();
    setIsSubmitting(false);
  };

  const closeLeaveModal = () => {
    setShowLeaveModal(false);
    clearErrors();
    setIsSubmitting(false);
  };

  const getLocation = () => {
    setGpsLoading(true);
    setErrors(prev => { const next = {...prev}; delete next.location; return next; });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setLocation(coords);
          const dist = calculateDistance(coords.lat, coords.lng, SCHOOL_LAT, SCHOOL_LNG);
          setDistance(dist);
          if (dist > ALLOWED_RADIUS_METERS) {
            setErrors(prev => ({...prev, location: `Jarak Anda (${Math.round(dist)}m) di luar radius sekolah.`}));
          }
          setGpsLoading(false);
        },
        (error) => { setGpsLoading(false); setErrors(prev => ({...prev, location: "GPS tidak aktif."})); },
        { enableHighAccuracy: true }
      );
    }
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', aspectRatio: { ideal: 3/4 }, width: { ideal: 480 }, height: { ideal: 640 } }, 
        audio: false 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setIsCameraActive(false);
      setErrors(prev => ({...prev, photo: "Kamera error."}));
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = 480;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const vWidth = video.videoWidth;
        const vHeight = video.videoHeight;
        const targetAspect = 3 / 4;
        let sWidth, sHeight, sx, sy;
        if (vWidth / vHeight > targetAspect) {
          sHeight = vHeight; sWidth = vHeight * targetAspect; sx = (vWidth - sWidth) / 2; sy = 0;
        } else {
          sWidth = vWidth; sHeight = vWidth / targetAspect; sx = 0; sy = (vHeight - sHeight) / 2;
        }
        
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, sWidth, sHeight, -480, 0, 480, 640);
        ctx.restore();

        const rawBase64 = canvas.toDataURL('image/jpeg', 0.7);
        const compressed = await compressImage(rawBase64);
        
        setPhoto(compressed);
        setErrors(prev => { const next = {...prev}; delete next.photo; return next; });
        stopCamera();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { setErrors(prev => ({...prev, attachment: "File max 10MB."})); return; }
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        // Kompresi jika itu gambar
        if (file.type.startsWith('image/')) {
            const compressed = await compressImage(rawBase64);
            setLeaveAttachment(compressed);
        } else {
            setLeaveAttachment(rawBase64);
        }
        setErrors(prev => { const next = {...prev}; delete next.attachment; return next; });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitAttendance = async () => {
    const newErrors: Record<string, string> = {};
    if (!photo) newErrors.photo = "Wajib foto selfie.";
    if (!location) newErrors.location = "Wajib GPS aktif.";
    if (distance !== null && distance > ALLOWED_RADIUS_METERS) newErrors.location = `Terlalu jauh (${Math.round(distance)}m).`;
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    
    setIsSubmitting(true);
    const payload: SubmissionPayload = {
      action: 'ATTENDANCE',
      user: { name: user.name, nip: user.nip, role: user.role },
      data: { type: attendanceType, timestamp: new Date().toISOString(), location: location ? `${location.lat}, ${location.lng}` : '', distance, photoBase64: photo }
    };
    const success = await submitToGoogleSheets(payload);
    setIsSubmitting(false);
    if (success) {
      if (attendanceType === 'IN') setStatus('PRESENT'); else setStatus('OUT');
      if (attendanceType) updateDeviceLock(attendanceType as 'IN' | 'OUT');
      alert(`Berhasil mengirim laporan presensi!`);
      closeAttendanceModal();
    } else alert("Gagal mengirim data. Periksa koneksi.");
  };

  const handleSubmitTeaching = async () => {
    const newErrors: Record<string, string> = {};
    if (!startTime || !endTime) newErrors.startTime = "Waktu mengajar wajib isi.";
    if (startTime >= endTime) newErrors.endTime = "Jam selesai tidak valid.";
    if (!photo) newErrors.photo = "Wajib lampirkan foto bukti mengajar.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    
    setIsSubmitting(true);
    const payload: SubmissionPayload = {
      action: 'TEACHING',
      user: { name: user.name, nip: user.nip, role: user.role },
      data: { subject: selectedSubject, className: selectedClass, startTime, endTime, timestamp: new Date().toISOString(), photoBase64: photo }
    };
    const success = await submitToGoogleSheets(payload);
    setIsSubmitting(false);
    if (success) { alert(`Jurnal Mengajar Disimpan!`); closeTeachingModal(); } else alert("Gagal kirim.");
  };

  const handleSubmitLeave = async () => {
    const newErrors: Record<string, string> = {};
    if (!leaveStartDate || !leaveEndDate) newErrors.leaveStartDate = "Pilih rentang tanggal.";
    if (leaveReason.trim().length < 10) newErrors.leaveReason = "Alasan minimal 10 karakter.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    
    setIsSubmitting(true);
    const payload: SubmissionPayload = {
      action: 'LEAVE',
      user: { name: user.name, nip: user.nip, role: user.role },
      data: { leaveType, startDate: leaveStartDate, endDate: leaveEndDate, reason: leaveReason, timestamp: new Date().toISOString(), attachmentBase64: leaveAttachment }
    };
    const success = await submitToGoogleSheets(payload);
    setIsSubmitting(false);
    if (success) { alert(`Pengajuan Berhasil Dikirim!`); closeLeaveModal(); } else alert("Gagal.");
  };

  const ErrorMsg = ({ name }: { name: string }) => errors[name] ? (
    <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1"><AlertCircle size={10} /> {errors[name]}</p>
  ) : null;

  return (
    <div className="flex-1 pb-24 overflow-y-auto">
      <Header title="Dashboard" />
      
      {/* Kartu Ucapan dengan Foto Profil */}
      <div className="px-6 mb-6">
        <div className="p-6 rounded-2xl glass overflow-hidden relative border-indigo-500/20">
          <div className="flex items-center gap-4 relative z-10">
            <div className="flex-1 min-w-0">
                <h2 className="text-slate-400 text-sm font-medium">Halo, selamat pagi!</h2>
                <p className="text-xl font-bold text-white mt-1 truncate">{user.name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                    <div className="flex items-center gap-2 text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                        {/* CHANGE: Display jobTitle instead of system role */}
                        <span className="text-[10px] font-semibold uppercase">{user.jobTitle || user.role}</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full border border-white/5">
                        {user.nip}
                    </div>
                </div>
            </div>
            <div className="shrink-0">
                <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/20">
                    <img 
                      src={user.avatar} 
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover border-2 border-slate-950 bg-slate-800"
                      onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&size=128`; }}
                    />
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 mb-10 text-center">
        <div className="inline-block px-8 py-6 bg-slate-900/40 rounded-3xl border border-white/5">
            <div className="text-4xl font-mono font-bold tracking-tighter text-indigo-400 mb-1">{formatTime(currentTime)}</div>
            <div className="text-slate-400 text-sm font-medium">{formatDate(currentTime)}</div>
        </div>
      </div>

      {(deviceLock.in || deviceLock.out) && (
        <div className="px-6 mb-4">
             <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                 <div className="p-2 bg-red-500 rounded-lg text-white"><Smartphone size={16} /></div>
                 <div className="flex-1">
                     <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Perangkat Terkunci</p>
                     <p className="text-[10px] text-slate-400 leading-tight">HP ini sudah digunakan untuk absen hari ini.</p>
                 </div>
             </div>
        </div>
      )}

      <div className="px-6 grid grid-cols-2 gap-4">
        <button onClick={() => openAttendanceModal('IN')} disabled={isMasukDisabled} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 transition-all disabled:opacity-50 disabled:grayscale group">
            <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20 group-active:scale-95 transition-transform"><LogIn className="text-white" size={24} /></div>
            <span className="text-white font-bold text-xs">{deviceLock.in ? 'Sudah Absen In' : 'Absen Masuk'}</span>
        </button>
        <button onClick={() => openAttendanceModal('OUT')} disabled={isPulangDisabled} className="flex flex-col items-center justify-center gap-2 p-5 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/20 transition-all disabled:opacity-50 disabled:grayscale group relative overflow-hidden">
            <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20 group-active:scale-95 transition-transform"><LogOut className="text-white" size={24} /></div>
            <span className="text-white font-bold text-xs">{deviceLock.out ? 'Sudah Pulang' : 'Absen Pulang'}</span>
            {status === 'PRESENT' && !isAfterPulangTime && !deviceLock.out && (
              <span className="text-[9px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">Pukul {pulangTimeLabel}</span>
            )}
        </button>
        {/* HIDE TEACHING BUTTON IF NOT TEACHER */}
        {isTeacher ? (
          <button onClick={handleOpenTeaching} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-amber-600/10 border border-amber-500/20 hover:bg-amber-600/20 transition-all group">
              <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20 group-active:scale-95 transition-transform"><GraduationCap className="text-white" size={24} /></div>
              <span className="text-white font-bold text-xs text-center leading-tight">Absen Mengajar</span>
          </button>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-slate-900/40 border border-white/5 opacity-50 grayscale cursor-not-allowed">
              <div className="p-3 bg-slate-800 rounded-2xl"><GraduationCap className="text-slate-500" size={24} /></div>
              <span className="text-slate-500 font-bold text-xs text-center leading-tight">Khusus Guru</span>
          </div>
        )}
        <button onClick={() => { clearErrors(); setShowLeaveModal(true); }} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 transition-all group">
            <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20 group-active:scale-95 transition-transform"><Coffee className="text-white" size={24} /></div>
            <span className="text-white font-bold text-xs">Ijin / Sakit</span>
        </button>
      </div>

      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md" onClick={closeAttendanceModal} />
          <div className="relative w-full max-w-md bg-slate-900 rounded-[2.5rem] p-6 border border-white/10 shadow-2xl my-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white tracking-tight">Absen {attendanceType === 'IN' ? 'Masuk' : 'Pulang'}</h3>
              <button onClick={closeAttendanceModal} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-all"><X size={20}/></button>
            </div>
            
            <div className="space-y-4">
              
              {/* SECTION: IDENTITAS PEGAWAI */}
              <div className="relative mt-2">
                <span className="absolute -top-3 left-4 bg-[#0f172a] px-2 text-[10px] font-bold text-indigo-400 tracking-widest uppercase z-10">
                    Identitas Pegawai
                </span>
                <div className="bg-[#1e293b] rounded-2xl p-3 border border-indigo-500/20 flex items-center gap-3 relative overflow-hidden shadow-lg">
                    {/* Icon Shield */}
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                        <ShieldCheck className="text-indigo-400" size={20} />
                    </div>
                    {/* Text Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-sm truncate leading-tight mb-0.5">{user.name}</h3>
                        <p className="text-slate-400 text-xs font-mono tracking-wide">NIP: {user.nip}</p>
                    </div>
                    {/* Badge Jarak */}
                    {distance !== null && (
                        <div className={`px-2 py-1.5 rounded-xl flex flex-col items-center justify-center min-w-[60px] border ${distance <= ALLOWED_RADIUS_METERS ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Jarak</span>
                            <span className={`text-xs font-black ${distance <= ALLOWED_RADIUS_METERS ? 'text-emerald-500' : 'text-red-500'}`}>{Math.round(distance)}m</span>
                        </div>
                    )}
                </div>
              </div>

              {/* SECTION: LIVE GPS */}
              <div className="bg-[#1e293b] rounded-2xl p-3 border border-emerald-500/10 flex items-center gap-3 shadow-lg relative overflow-hidden group">
                 {/* Icon GPS */}
                 <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <Navigation className={`text-emerald-500 ${gpsLoading ? 'animate-pulse' : ''}`} size={20} />
                 </div>
                 {/* Text Info */}
                 <div className="flex-1">
                    <h3 className="text-slate-500 font-bold text-[10px] uppercase tracking-wider mb-0.5">Live GPS Location</h3>
                    <p className="text-white font-mono text-sm font-medium">
                        {gpsLoading ? 'Melacak...' : location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Menunggu GPS...'}
                    </p>
                    <ErrorMsg name="location" />
                 </div>
                 {/* Refresh Button */}
                 <button onClick={getLocation} className="p-2 text-indigo-400 hover:text-white transition-colors active:scale-90">
                    <RefreshCw size={18} className={gpsLoading ? 'animate-spin' : ''}/>
                 </button>
              </div>

              {/* SECTION: CAMERA */}
              <div className={`relative aspect-[3/4] w-full max-w-[320px] mx-auto bg-slate-950 rounded-[2rem] overflow-hidden border-4 shadow-2xl mt-4 ${errors.photo ? 'border-red-500/50' : 'border-slate-800'}`}>
                {photo ? (
                  <>
                    <img src={photo} alt="Selfie" className="w-full h-full object-cover" />
                    <button onClick={() => { setPhoto(null); startCamera(); }} className="absolute bottom-6 left-1/2 -translate-x-1/2 p-4 bg-white/10 backdrop-blur-md text-white rounded-full border border-white/20 shadow-lg active:scale-95 transition-all hover:bg-white/20">
                        <RefreshCw size={24} />
                    </button>
                    {/* Badge Success */}
                    <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg z-20">
                      <Check size={12} strokeWidth={3} /> FOTO OKE
                    </div>
                  </>
                ) : (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    {/* Badge Mode Potrait */}
                    <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 border border-white/10 shadow-lg z-20">
                      <Camera size={12} className="text-indigo-400" /> MODE POTRAIT
                    </div>
                    {isCameraActive && (
                      <button onClick={capturePhoto} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white p-1 border-4 border-slate-900 shadow-2xl flex items-center justify-center active:scale-90 transition-transform hover:scale-105">
                        <div className="w-full h-full bg-slate-200 rounded-full border border-slate-300" />
                      </button>
                    )}
                  </>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="text-center"><ErrorMsg name="photo" /></div>
              
              {/* SUBMIT BUTTON */}
              <button 
                onClick={handleSubmitAttendance} 
                disabled={isSubmitting || (distance !== null && distance > ALLOWED_RADIUS_METERS)} 
                className={`w-full py-5 font-bold rounded-2xl shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 text-sm tracking-wide ${distance !== null && distance > ALLOWED_RADIUS_METERS ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/30'}`}
              >
                {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : (
                    <>
                    {distance !== null && distance > ALLOWED_RADIUS_METERS ? (
                        <>Di Luar Radius Sekolah</>
                    ) : (
                        <>
                        <Check size={18} strokeWidth={3} />
                        KIRIM LAPORAN PRESENSI
                        </>
                    )}
                    </>
                )}
              </button>

            </div>
          </div>
        </div>
      )}

      {showTeachingModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 overflow-y-auto">
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md" onClick={closeTeachingModal} />
            <div className="relative w-full max-w-md bg-slate-900 rounded-[2.5rem] p-6 border border-white/10 shadow-2xl my-auto animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><GraduationCap className="text-amber-500" /> Sesi Mengajar</h3>
                    <button onClick={closeTeachingModal} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">IDENTITAS GURU</label>
                            <p className="text-xs font-bold text-white leading-tight truncate">{user.name}</p>
                        </div>
                        <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">NIP (VERIFIED)</label>
                            <p className="text-xs font-bold text-indigo-400 font-mono tracking-wide truncate">{user.nip}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-indigo-400 uppercase mb-2 flex items-center gap-1.5">
                                <Clock size={14} /> JAM MULAI
                            </label>
                            <div className="relative">
                                <input 
                                  type="time" 
                                  value={startTime} 
                                  onChange={(e) => setStartTime(e.target.value)} 
                                  className="w-full p-4 bg-slate-800/60 border border-slate-700 rounded-2xl text-white text-lg font-bold outline-none focus:border-indigo-500 transition-all text-center"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-indigo-400 uppercase mb-2 flex items-center gap-1.5">
                                <Clock size={14} /> JAM SELESAI
                            </label>
                             <div className="relative">
                                <input 
                                  type="time" 
                                  value={endTime} 
                                  onChange={(e) => setEndTime(e.target.value)} 
                                  className="w-full p-4 bg-slate-800/60 border border-slate-700 rounded-2xl text-white text-lg font-bold outline-none focus:border-indigo-500 transition-all text-center"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="text-[10px] font-bold text-indigo-400 uppercase mb-2 flex items-center gap-1.5">
                             <MapPin size={14} /> RUANG / KELAS
                          </label>
                          <div className="relative">
                             <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full p-4 bg-slate-800/60 border border-slate-700 rounded-2xl text-white text-sm font-bold outline-none appearance-none focus:border-indigo-500 transition-all">
                                  {roomOptions.map(room => <option key={room} value={room}>{room}</option>)}
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                              </div>
                          </div>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-indigo-400 uppercase mb-2 flex items-center gap-1.5">
                             <FileText size={14} /> MATA PELAJARAN
                          </label>
                          <div className="relative">
                              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full p-4 bg-slate-800/60 border border-slate-700 rounded-2xl text-white text-sm font-bold outline-none appearance-none focus:border-indigo-500 transition-all">
                                  {['PAI', 'PKN', 'B. INDONESIA', 'B. INGGRIS', 'IPA', 'IPS', 'PJOK', 'SBD', 'TIK', 'MATEMATIKA', 'KASERANGAN', 'BTQ', 'PRAKARYA', 'BP/BK'].map(m => <option key={m}>{m}</option>)}
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                              </div>
                          </div>
                      </div>
                    </div>
                    
                    <div className={`relative aspect-[3/4] w-full max-w-[200px] mx-auto bg-slate-950 rounded-2xl overflow-hidden border-2 shadow-xl ${errors.photo ? 'border-red-500' : 'border-amber-500/30'}`}>
                        {photo ? (
                          <>
                            <img src={photo} alt="Teaching" className="w-full h-full object-cover" />
                            <button onClick={() => { setPhoto(null); startCamera(); }} className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <div className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-full flex items-center gap-2 font-bold text-xs hover:bg-white/30 transition-all">
                                    <RefreshCw size={14} /> FOTO ULANG
                                </div>
                            </button>
                          </>
                        ) : (
                          <>
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                               {isCameraActive ? (
                                  <button onClick={capturePhoto} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 px-4 py-2 rounded-full font-bold text-xs shadow-lg transition-all active:scale-95">
                                     <Camera size={14} /> BUKTI NGAJAR
                                  </button>
                               ) : (
                                  <button onClick={startCamera} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-full font-bold text-xs shadow-lg transition-all">
                                     <Camera size={14} /> AKTIFKAN KAMERA
                                  </button>
                               )}
                            </div>
                          </>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                    <ErrorMsg name="photo" />
                    <button onClick={handleSubmitTeaching} disabled={isSubmitting} className="w-full py-5 bg-amber-500 text-slate-950 font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        {isSubmitting ? <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-950 rounded-full animate-spin mx-auto" /> : 'Konfirmasi Sesi Mengajar'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 overflow-y-auto">
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md" onClick={closeLeaveModal} />
            <div className="relative w-full max-w-md bg-slate-900 rounded-[2rem] p-6 border border-white/10 shadow-2xl my-auto animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3"><div className="p-2 bg-blue-500 rounded-lg"><Coffee size={20} className="text-white"/></div> Pengajuan Izin</h3>
                    <button onClick={closeLeaveModal} className="p-2 bg-slate-800 rounded-full text-slate-400"><X size={20}/></button>
                </div>
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">IDENTITAS GURU</label>
                            <p className="text-xs font-bold text-white leading-tight truncate">{user.name}</p>
                        </div>
                        <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">NIP (VERIFIED)</label>
                            <p className="text-xs font-bold text-indigo-400 font-mono tracking-wide truncate">{user.nip}</p>
                        </div>
                    </div>
                    
                    <div className="flex bg-slate-800/50 p-1 rounded-xl">
                        {(['Izin', 'Sakit', 'Dinas'] as const).map((type) => (
                            <button key={type} onClick={() => setLeaveType(type)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${leaveType === type ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{type}</button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <input type="date" value={leaveStartDate} onChange={(e) => setLeaveStartDate(e.target.value)} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs outline-none" />
                        <input type="date" value={leaveEndDate} onChange={(e) => setLeaveEndDate(e.target.value)} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs outline-none" />
                    </div>
                    <textarea value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="Tuliskan detail alasan..." className="w-full p-4 bg-slate-800/50 border border-white/10 rounded-xl text-white text-xs h-28 resize-none outline-none" />
                    <ErrorMsg name="leaveReason" />

                    {/* FITUR UPLOAD GAMBAR */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider px-1">Lampiran (Optional)</label>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/5 transition-all group ${errors.attachment ? 'border-red-500' : 'border-white/10'}`}
                        >
                            {leaveAttachment ? (
                                <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                                    <img src={leaveAttachment} alt="Attachment" className="w-full h-full object-cover" />
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setLeaveAttachment(null); }}
                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="p-3 bg-slate-800 rounded-full text-slate-500 group-hover:text-indigo-400 transition-colors">
                                        <ImageIcon size={24} />
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium">Klik untuk pilih foto dari galeri</span>
                                </>
                            )}
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleFileUpload}
                            />
                        </div>
                        <ErrorMsg name="attachment" />
                    </div>

                    <button onClick={handleSubmitLeave} disabled={isSubmitting} className="w-full py-5 bg-indigo-600 text-white font-bold rounded-2xl active:scale-[0.98] transition-all">
                        {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Kirim Pengajuan'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Home;
