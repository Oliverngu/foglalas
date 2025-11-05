import React, { useState, useMemo } from 'react';
import { Request, User } from '../../../core/models/data';
import { db, Timestamp, serverTimestamp } from '../../../core/firebase/config';
import { collection, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import CalendarIcon from '../icons/CalendarIcon';
import LoadingSpinner from '../LoadingSpinner';
import CheckIcon from '../icons/CheckIcon';
import XIcon from '../icons/XIcon';
import TrashIcon from '../icons/TrashIcon';

interface KerelemekAppProps {
  requests: Request[];
  loading: boolean;
  error: string | null;
  currentUser: User;
  canManage: boolean;
}

interface RequestFormProps {
  user: User;
  onSubmit: (dateBlocks: { startDate: Date; endDate: Date }[], note: string) => void;
  onCancel: () => void;
  allRequests: Request[];
}


const RequestForm: React.FC<RequestFormProps> = ({ user, onSubmit, onCancel, allRequests }) => {
  const [note, setNote] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [error, setError] = useState('');

  const toKey = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const requestsByDate = useMemo(() => {
    const map = new Map<string, Request[]>();
    if (allRequests) {
        allRequests.forEach(request => {
            if (request.startDate && request.endDate) {
                const start = request.startDate.toDate();
                const end = request.endDate.toDate();
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const key = toKey(new Date(d));
                    if (key) {
                        if (!map.has(key)) {
                            map.set(key, []);
                        }
                        map.get(key)!.push(request);
                    }
                }
            }
        });
    }
    return map;
  }, [allRequests]);


  const handleDateClick = (day: Date) => {
    setError('');
    const dayKey = toKey(day);
    const index = selectedDates.findIndex(d => toKey(d) === dayKey);
    if (index > -1) {
      setSelectedDates(prev => prev.filter((_, i) => i !== index));
    } else {
      setSelectedDates(prev => [...prev, day].sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDates.length === 0) {
      setError('Kérlek, válassz ki legalább egy napot a naptárból.');
      return;
    }

    // Group consecutive dates into blocks
    const dateBlocks: { startDate: Date; endDate: Date }[] = [];
    if (selectedDates.length > 0) {
      let currentBlock = { startDate: selectedDates[0], endDate: selectedDates[0] };
      for (let i = 1; i < selectedDates.length; i++) {
        const prevDate = currentBlock.endDate;
        const currentDate = selectedDates[i];
        const nextDay = new Date(prevDate);
        nextDay.setDate(nextDay.getDate() + 1);
        if (nextDay.getTime() === currentDate.getTime()) {
          currentBlock.endDate = currentDate;
        } else {
          dateBlocks.push(currentBlock);
          currentBlock = { startDate: currentDate, endDate: currentDate };
        }
      }
      dateBlocks.push(currentBlock);
    }
    onSubmit(dateBlocks, note);
  };

  const renderCalendar = () => {
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const days = [];
    const startDayOfWeek = (startOfMonth.getDay() + 6) % 7;
    for (let i = 0; i < startDayOfWeek; i++) {
      const day = new Date(startOfMonth);
      day.setDate(day.getDate() - (startDayOfWeek - i));
      days.push({ date: day, isCurrentMonth: false });
    }
    for (let i = 1; i <= endOfMonth.getDate(); i++) {
      const day = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      days.push({ date: day, isCurrentMonth: true });
    }
    const totalDays = days.length;
    const remainingCells = (totalDays > 35 ? 42 : 35) - totalDays;
    for (let i = 1; i <= remainingCells; i++) {
      const day = new Date(endOfMonth);
      day.setDate(day.getDate() + i);
      days.push({ date: day, isCurrentMonth: false });
    }
    const todayKey = toKey(new Date());
    const selectedKeys = selectedDates.map(toKey);

    return (
      <div>
        <div className="flex justify-between items-center mb-2">
           <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 rounded-full hover:bg-gray-100">&lt;</button>
          <h3 className="font-bold text-lg">{currentMonth.toLocaleDateString('hu-HU', { month: 'long', year: 'numeric' })}</h3>
          <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 rounded-full hover:bg-gray-100">&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center font-semibold text-gray-500 text-sm mb-2">
          {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(({ date, isCurrentMonth }, i) => {
            const dateKey = toKey(date);
            const isSelected = selectedKeys.includes(dateKey);
            const isToday = dateKey === todayKey;
            const dayRequests = requestsByDate.get(dateKey) || [];

            return (
              <div
                key={i}
                onClick={() => isCurrentMonth && handleDateClick(date)}
                className={`
                  relative p-1 h-12 flex items-center justify-center text-sm rounded-lg
                  ${isCurrentMonth ? 'cursor-pointer text-gray-700' : 'text-gray-300'}
                  ${isToday && !isSelected && 'border-2 border-green-500'}
                  ${isSelected ? 'bg-green-700 text-white font-bold' : (isCurrentMonth ? 'hover:bg-gray-100' : '')}
                `}
              >
                {date.getDate()}
                 {dayRequests.length > 0 && !isSelected && isCurrentMonth && (
                    <div title={`${dayRequests.length} kérelem ezen a napon`} className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 mt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">Szabadnap kérelem</h2>
            <div>
                <label htmlFor="userName" className="block text-sm font-medium text-gray-700">Név</label>
                <input type="text" id="userName" value={user.fullName} readOnly className="mt-1 w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
                <label htmlFor="note" className="block text-sm font-medium text-gray-700">Megjegyzés (opcionális)</label>
                <textarea id="note" value={note} onChange={e => setNote(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"></textarea>
                <p className="text-xs text-gray-500 mt-1">A megjegyzést csak az adminisztrátorok látják.</p>
            </div>
            <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">Napok kiválasztása</label>
                 {renderCalendar()}
            </div>
            {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick