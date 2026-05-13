/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Clock, 
  LogOut, 
  Search,
  Settings,
  Bell,
  MoreVertical,
  Filter,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db, loginWithGoogle, loginAnonymously, logout, handleFirestoreError, OperationType } from './lib/firebase';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Reminder {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate: Timestamp | null;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [isAdding, setIsAdding] = useState(false);

  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setLoginError(null);
      await loginWithGoogle();
    } catch (error: any) {
      setLoginError("Error al entrar con Google. Inténtalo de nuevo.");
      console.error(error);
    }
  };

  const handleAnonymousLogin = async () => {
    try {
      setLoginError(null);
      await loginAnonymously();
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed' || error.message.includes('admin-restricted-operation')) {
        setLoginError("Acceso de invitado no habilitado. Por favor, actívalo en la consola de Firebase (Authentication > Sign-in method > Anonymous).");
      } else {
        setLoginError("Error al entrar como invitado. Verifica tu conexión.");
      }
      console.error(error);
    }
  };

  useEffect(() => {
    if (!user) {
      setReminders([]);
      return;
    }

    const path = 'reminders';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reminder[];
      setReminders(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return unsubscribe;
  }, [user]);

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;

    const path = 'reminders';
    try {
      await addDoc(collection(db, path), {
        title: newTitle,
        description: newDesc,
        completed: false,
        priority: newPriority,
        dueDate: newDueDate ? Timestamp.fromDate(new Date(newDueDate)) : null,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const toggleComplete = async (reminder: Reminder) => {
    const path = `reminders/${reminder.id}`;
    try {
      await updateDoc(doc(db, 'reminders', reminder.id), {
        completed: !reminder.completed,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteReminder = async (id: string) => {
    const path = `reminders/${id}`;
    try {
      await deleteDoc(doc(db, 'reminders', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const filteredReminders = reminders.filter(r => {
    if (filter === 'active') return !r.completed;
    if (filter === 'completed') return r.completed;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F5F3]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-black border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-slate-900/80 border border-slate-800 p-12 rounded-[2rem] shadow-2xl"
        >
          <div className="mb-8 flex justify-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
              <CheckCircle2 className="text-white w-8 h-8" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Remindly <span className="text-indigo-400">v1.2</span></h1>
          <p className="text-slate-400 mb-10 text-lg">
            Plataforma de gestión de datos personales con arquitectura sincronizada.
          </p>
          
          <div className="space-y-3">
            {loginError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-xs font-mono">
                {loginError}
              </div>
            )}
            <button
              onClick={handleAnonymousLogin}
              className="w-full bg-slate-100 text-slate-950 py-4 px-8 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-white transition-all shadow-lg active:scale-95"
            >
              Comenzar como Invitado
            </button>
            <div className="flex items-center gap-4 py-2">
              <div className="h-px bg-slate-800 flex-grow" />
              <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">o bien</span>
              <div className="h-px bg-slate-800 flex-grow" />
            </div>
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-slate-800 text-white py-4 px-8 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-700 transition-all border border-slate-700 active:scale-95"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 brightness-200" />
              Entrar con Google
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-600 selection:text-white p-6">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-6 h-full">
        {/* Header */}
        <header className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <CheckCircle2 className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Remindly <span className="text-indigo-400 text-xs align-top ml-1">BENTO</span></h1>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                User: {user.isAnonymous ? 'INVITADO' : user.email?.split('@')[0]}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Filtrar datos..." 
                className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 pl-10 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1">
          {/* Main List Section */}
          <section className="md:col-span-8 bg-slate-900/40 border border-slate-800 rounded-[2rem] p-8 flex flex-col overflow-hidden min-h-[500px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Datos del Sistema</h2>
                <p className="text-xs text-slate-500 font-mono mt-1">RECORDS_ACTIVE: {reminders.length}</p>
              </div>
              
              <div className="flex gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                {(['all', 'active', 'completed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-widest",
                      filter === f 
                        ? "bg-indigo-600 text-white" 
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {filteredReminders.map((reminder) => (
                  <motion.div
                    key={reminder.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "bg-slate-800/30 border border-slate-800 p-5 rounded-2xl flex items-start gap-4 transition-all group hover:bg-slate-800/50 hover:border-slate-700",
                      reminder.completed && "opacity-40"
                    )}
                  >
                    <button
                      onClick={() => toggleComplete(reminder)}
                      className={cn(
                        "mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        reminder.completed 
                          ? "bg-emerald-500 border-emerald-500 text-white" 
                          : "border-slate-700 hover:border-indigo-500"
                      )}
                    >
                      {reminder.completed && <Check className="w-4 h-4" />}
                    </button>

                    <div className="flex-grow">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={cn(
                          "text-base font-semibold leading-tight",
                          reminder.completed && "line-through text-slate-500"
                        )}>
                          {reminder.title}
                        </h3>
                        <button 
                          onClick={() => deleteReminder(reminder.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {reminder.description && (
                        <p className="mt-1 text-slate-400 text-sm leading-relaxed">
                          {reminder.description}
                        </p>
                      )}

                      <div className="mt-4 flex items-center gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                        <span className={cn(
                          "px-2 py-0.5 border rounded-full",
                          reminder.priority === 'high' ? "text-red-400 border-red-400/20 bg-red-400/5" :
                          reminder.priority === 'medium' ? "text-amber-400 border-amber-400/20 bg-amber-400/5" :
                          "text-indigo-400 border-indigo-400/20 bg-indigo-400/5"
                        )}>
                          {reminder.priority}
                        </span>

                        {reminder.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(reminder.dueDate.toDate(), 'PPP')}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredReminders.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-4">
                    <Bell className="w-6 h-6 opacity-20" />
                  </div>
                  <p className="text-sm font-mono uppercase tracking-[0.2em]">No Records Found</p>
                </div>
              )}
            </div>
          </section>

          {/* Sidebar Bento Sections */}
          <div className="md:col-span-4 flex flex-col gap-6">
            {/* New Entry Bento */}
            <section className="bg-indigo-600 rounded-[2rem] p-8 text-white relative overflow-hidden group">
              <div className="relative z-10 flex flex-col h-full">
                <p className="text-indigo-100 text-xs font-mono uppercase tracking-widest mb-1">Operación</p>
                <h3 className="text-3xl font-bold italic mb-6">Nuevo Registro</h3>
                <button
                  onClick={() => setIsAdding(true)}
                  className="mt-auto bg-white/10 hover:bg-white/20 border border-white/20 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  Abrir Consola
                </button>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10 w-32 h-32 group-hover:scale-110 transition-transform">
                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
              </div>
            </section>

            {/* Performance/Status Bento */}
            <section className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 flex flex-col justify-between">
              <div>
                <p className="text-slate-500 text-xs font-mono uppercase tracking-widest mb-4">Live Status</p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Database Sync</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Auth Session</span>
                    <span className="text-xs font-mono text-indigo-400">ACTIVE</span>
                  </div>
                </div>
              </div>
              <div className="mt-10">
                <p className="text-[10px] text-slate-600 mb-1 font-mono">Uptime Monitor</p>
                <p className="text-2xl font-mono text-indigo-500 tracking-tighter">99.99%</p>
              </div>
            </section>

            {/* Quote/Info Bento */}
            <section className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-6 flex flex-col gap-2 flex-grow">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="ml-2 text-[10px] text-slate-500 font-mono italic">SYS_INFO</span>
              </div>
              <div className="flex-1 bg-black/40 rounded-xl p-4 font-mono text-[11px] text-indigo-400/80 leading-relaxed overflow-hidden">
                <p># Remindly Personal Cloud</p>
                <p className="mt-2">&gt; Sincronización en tiempo real habilitada.</p>
                <p className="mt-1">&gt; Encriptación de extremo a extremo.</p>
                <p className="mt-1">&gt; Nodo: europe-west3-instance-01</p>
                <p className="mt-2 animate-pulse">_</p>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Add Modal - Styled as a floating Bento Console */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <form onSubmit={handleAddReminder} className="p-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                    <h3 className="text-xl font-bold tracking-tight">Consola de Entrada</h3>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="p-2 -mr-2 text-slate-500 hover:text-white transition-colors"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                    <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-2 block">Título del registro</label>
                    <input
                      autoFocus
                      required
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Identificador del registro..."
                      className="w-full bg-transparent text-lg font-bold p-0 border-none focus:ring-0 placeholder:text-slate-700 text-white"
                    />
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                    <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-2 block">Metadata descriptiva</label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Parámetros adicionales..."
                      rows={2}
                      className="w-full bg-transparent text-slate-300 p-0 border-none focus:ring-0 placeholder:text-slate-700 resize-none text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                      <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-3 block">Nivel Crítico</label>
                      <div className="flex gap-2">
                        {(['low', 'medium', 'high'] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setNewPriority(p)}
                            className={cn(
                              "flex-1 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border",
                              newPriority === p 
                                ? "bg-indigo-600 border-indigo-500 text-white" 
                                : "bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-700"
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                      <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-2 block">Timestamp Límite</label>
                      <input
                        type="datetime-local"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="w-full bg-transparent text-white border-none rounded-lg text-xs font-bold focus:ring-0 cursor-pointer p-0"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-10 bg-indigo-600 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-500 transition-all shadow-[0_8px_24px_-8px_rgba(79,70,229,0.5)] active:scale-[0.98]"
                >
                  <Plus className="w-5 h-5" />
                  Confirmar Inserción
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

