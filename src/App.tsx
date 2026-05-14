import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  Trash2,
  AlertCircle,
  GraduationCap
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO,
  isAfter,
  startOfToday
} from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';

import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Exam {
  id: string;
  subject: string;
  date: string;
  time: string;
  location: string;
  userId: string;
  color: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [newSubject, setNewSubject] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newTime, setNewTime] = useState('09:00');
  const [newLocation, setNewLocation] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
      setIsLoggingIn(false);
    });
    return unsubscribe;
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      setIsLoggingIn(false);
      console.error("Login error:", error);
    }
  };

  useEffect(() => {
    if (!user) {
      setExams([]);
      return;
    }

    const q = query(collection(db, 'exams'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const examsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Exam[];
      setExams(examsList);
      setSaveError(null);
    }, (error) => {
      console.error("Snapshot error:", error);
      setSaveError("Error al cargar los exámenes. Revisa tu conexión.");
      try {
        handleFirestoreError(error, OperationType.LIST, 'exams');
      } catch (err) {
        // Ignorar
      }
    });

    return unsubscribe;
  }, [user]);

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newSubject.trim() || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const examData = {
        subject: newSubject,
        date: newDate,
        time: newTime,
        location: newLocation,
        color: newColor,
        userId: user.uid,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'exams'), examData);
      setNewSubject('');
      setNewLocation('');
      setIsAdding(false);
    } catch (error: any) {
      console.error("Error adding exam:", error);
      setSaveError("No se pudo guardar el examen. Revisa los permisos o tu conexión.");
      try {
        handleFirestoreError(error, OperationType.CREATE, 'exams');
      } catch (err) {
        // Ignorar el error relanzado
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'exams', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'exams');
    }
  };

  // Calendar logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const upcomingExams = useMemo(() => {
    const today = startOfToday();
    return exams
      .filter(ex => !isAfter(today, parseISO(ex.date)))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [exams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.15),transparent)]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/40 rotate-12">
            <GraduationCap className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tight">Exam Calendar</h1>
          <p className="text-slate-400 mb-10 text-lg leading-relaxed">
            Organiza tus estudios y nunca olvides una fecha importante. Sincronización en tiempo real.
          </p>
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className={cn(
              "w-full bg-white text-slate-950 py-4 px-8 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95",
              isLoggingIn ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-100"
            )}
          >
            {isLoggingIn ? (
              <div className="w-5 h-5 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
            ) : (
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            )}
            {isLoggingIn ? 'Entrando...' : 'Entrar con Google'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-xl rotate-6 shadow-lg shadow-indigo-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Exam Calendar</h1>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em]">{user.email?.split('@')[0]}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            title="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Calendar */}
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-sm overflow-hidden relative">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: es })}
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  className="p-2 hover:bg-white/5 rounded-xl transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-white/5 rounded-xl transition-all"
                >
                  Hoy
                </button>
                <button 
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  className="p-2 hover:bg-white/5 rounded-xl transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                <div key={day} className="text-center text-[10px] font-mono text-slate-500 uppercase tracking-widest py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, idx) => {
                const dayExams = exams.filter(ex => isSameDay(parseISO(ex.date), day));
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isToday = isSameDay(day, new Date());

                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.01 }}
                    key={day.toString()}
                    className={cn(
                      "aspect-square rounded-2xl p-2 relative group transition-all border",
                      isCurrentMonth ? "bg-white/[0.02] border-white/5" : "opacity-30 border-transparent",
                      isToday && "bg-indigo-600/10 border-indigo-500/30"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium",
                      isToday ? "text-indigo-400 font-bold" : "text-slate-400"
                    )}>
                      {format(day, 'd')}
                    </span>
                    
                    <div className="mt-1 flex flex-col gap-1 overflow-hidden">
                      {dayExams.slice(0, 2).map(ex => (
                        <div 
                          key={ex.id}
                          style={{ backgroundColor: ex.color + '20', color: ex.color, borderColor: ex.color + '40' }}
                          className="text-[9px] truncate px-1.5 py-0.5 rounded-md border font-medium uppercase tracking-tighter"
                        >
                          {ex.subject}
                        </div>
                      ))}
                      {dayExams.length > 2 && (
                        <span className="text-[8px] text-slate-500 font-mono pl-1">
                          +{dayExams.length - 2} más
                        </span>
                      )}
                    </div>

                    {!isAdding && isCurrentMonth && (
                      <button 
                        onClick={() => {
                          setNewDate(format(day, 'yyyy-MM-dd'));
                          setIsAdding(true);
                        }}
                        className="absolute inset-0 flex items-center justify-center bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
                      >
                        <Plus className="text-white w-6 h-6" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: Upcoming & Add */}
        <div className="lg:col-span-4 space-y-8">
          {/* Action Button */}
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-bold flex items-center justify-center gap-3 hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-500/20 active:scale-95 group"
          >
            <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />
            Añadir Examen
          </button>

          {/* Upcoming Section */}
          <section className="bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-sm">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
              <CalendarIcon className="w-5 h-5 text-indigo-400" />
              Próximos Retos
            </h3>
            
            <div className="space-y-4">
              {upcomingExams.length > 0 ? upcomingExams.map((ex, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={ex.id}
                  className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 rounded-2xl p-5 transition-all relative overflow-hidden"
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1.5" 
                    style={{ backgroundColor: ex.color }} 
                  />
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-lg">{ex.subject}</h4>
                    <button 
                      onClick={() => handleDeleteExam(ex.id)}
                      className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-2 text-slate-400 text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-slate-500" />
                      {format(parseISO(ex.date), "EEEE d 'de' MMMM", { locale: es })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      {ex.time}
                    </div>
                    {ex.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-500" />
                        {ex.location}
                      </div>
                    )}
                  </div>
                </motion.div>
              )) : (
                <div className="text-center py-12 px-6 border-2 border-dashed border-white/5 rounded-3xl">
                  <div className="bg-white/5 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-6 h-6 text-slate-600" />
                  </div>
                  <p className="text-slate-500 text-sm italic">No hay exámenes programados.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-white/10 w-full max-w-xl rounded-[3rem] p-10 relative shadow-2xl"
            >
              <h2 className="text-3xl font-black mb-8">Nuevo Examen</h2>
              {saveError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-400 text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {saveError}
                </div>
              )}
              <form onSubmit={handleAddExam} className="space-y-6">
                <div>
                  <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2 block">Materia / Asignatura</label>
                  <input 
                    autoFocus
                    required
                    value={newSubject}
                    onChange={e => setNewSubject(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="Ej. Matemáticas II"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2 block">Fecha</label>
                    <input 
                      type="date"
                      required
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-white scheme-dark"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2 block">Hora</label>
                    <input 
                      type="time"
                      value={newTime}
                      onChange={e => setNewTime(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-white scheme-dark"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2 block">Lugar / Aula</label>
                  <input 
                    value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="Ej. Aula 402 o Biblioteca"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2 block">Color identificador</label>
                  <div className="flex gap-3">
                    {['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444'].map(color => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setNewColor(color)}
                        className={cn(
                          "w-10 h-10 rounded-full transition-all border-4",
                          newColor === color ? "border-white/40 scale-110 shadow-lg" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-4 px-6 rounded-2xl font-bold border border-white/5 hover:bg-white/5 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className={cn(
                      "flex-[2] bg-indigo-600 text-white py-4 px-6 rounded-2xl font-bold shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2",
                      isSaving ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-500"
                    )}
                  >
                    {isSaving && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                    {isSaving ? 'Guardando...' : 'Guardar Fecha'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
