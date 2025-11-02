import React, { useState, useEffect } from 'react';
import { ReservationSetting } from '../../data/mockData';
import { db } from '../../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import LoadingSpinner from '../LoadingSpinner';

interface ReservationSettingsAppProps {
    unitId: string;
}

const ReservationSettingsApp: React.FC<ReservationSettingsAppProps> = ({ unitId }) => {
    const [settings, setSettings] = useState<ReservationSetting | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            const docRef = doc(db, 'reservation_settings', unitId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setSettings(docSnap.data() as ReservationSetting);
            } else {
                setSettings({ id: unitId, blackoutDates: [] });
            }
            setLoading(false);
        };
        fetchSettings();
    }, [unitId]);

    const toDateKey = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleDateClick = (day: Date) => {
        if (!settings) return;
        const dateKey = toDateKey(day);
        const newBlackoutDates = settings.blackoutDates.includes(dateKey)
            ? settings.blackoutDates.filter(d => d !== dateKey)
            : [...settings.blackoutDates, dateKey];
        
        setSettings({ ...settings, blackoutDates: newBlackoutDates });
    };

    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'reservation_settings', unitId), settings);
            alert('Beállítások mentve!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Hiba a mentés során.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderCalendar = () => {
        const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        const days = [];
        const startDayOfWeek = (startOfMonth.getDay() + 6) % 7;

        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null);
        }
        for (let i = 1; i <= endOfMonth.getDate(); i++) {
            days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
        }

        const blackoutSet = new Set(settings?.blackoutDates || []);

        return (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 rounded-full hover:bg-gray-100">&lt;</button>
                    <h3 className="font-bold text-lg">{currentMonth.toLocaleDateString('hu-HU', { month: 'long', year: 'numeric' })}</h3>
                    <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 rounded-full hover:bg-gray-100">&gt;</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center font-semibold text-gray-500 text-sm mb-2">
                    {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, i) => {
                        if (!day) return <div key={`empty-${i}`}></div>;
                        const dateKey = toDateKey(day);
                        const isBlackout = blackoutSet.has(dateKey);
                        return (
                            <div
                                key={dateKey}
                                onClick={() => handleDateClick(day)}
                                className={`relative p-1 h-12 flex items-center justify-center text-sm rounded-lg cursor-pointer
                                    ${isBlackout ? 'bg-red-500 text-white font-bold' : 'bg-gray-100 hover:bg-gray-200'}
                                `}
                            >
                                {day.getDate()}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">Blackout Napok Kezelése</h2>
            <p className="text-gray-600 mt-1 mb-4">Kattints a napokra a foglalás letiltásához vagy engedélyezéséhez. A piros napokon a vendégek nem tudnak foglalni.</p>
            {renderCalendar()}
            <button
                onClick={handleSave}
                disabled={isSaving}
                className="mt-6 w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
                {isSaving ? 'Mentés...' : 'Mentés'}
            </button>
        </div>
    );
};

export default ReservationSettingsApp;
