import React, { useState, useEffect, useMemo } from 'react';
import { Unit, ReservationSetting, Booking } from '../../data/mockData';
import { db, Timestamp } from '../../firebase/config';
import { doc, getDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import LoadingSpinner from '../LoadingSpinner';
import MintLeafLogo from '../icons/AppleLogo';

interface ReservationPageProps {
    unitId: string;
    allUnits: Unit[];
}

const ReservationPage: React.FC<ReservationPageProps> = ({ unitId, allUnits }) => {
    const [unit, setUnit] = useState<Unit | null>(null);
    const [settings, setSettings] = useState<ReservationSetting | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    
    const [formData, setFormData] = useState({
        name: '',
        headcount: '2',
        occasion: 'Vacsora',
        startTime: '',
        endTime: '',
        source: '',
        phone: '',
        email: ''
    });
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    useEffect(() => {
        const currentUnit = allUnits.find(u => u.id === unitId);
        if (currentUnit) {
            setUnit(currentUnit);
            document.title = `Foglalás - ${currentUnit.name}`;
        } else if (allUnits.length > 0) {
            setError('A megadott egység nem található.');
        }
    }, [unitId, allUnits]);

    useEffect(() => {
        if (!unit) return;
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, 'reservation_settings', unitId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(docSnap.data() as ReservationSetting);
                } else {
                    setSettings({ id: unitId, blackoutDates: [] }); // Default if no settings exist
                }
            } catch (err) {
                console.error("Error fetching reservation settings:", err);
                setError('Hiba a foglalási beállítások betöltésekor.');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [unit, unitId]);
    
    const toDateKey = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    const handleDateSelect = (day: Date) => {
        setSelectedDate(day);
        setFormData(prev => ({ ...prev, startTime: '', endTime: '' }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !formData.startTime || !formData.endTime) {
            setError("Kérjük, válasszon dátumot és időpontot.");
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const startDateTime = new Date(selectedDate);
            const [startH, startM] = formData.startTime.split(':').map(Number);
            startDateTime.setHours(startH, startM);

            const endDateTime = new Date(selectedDate);
            const [endH, endM] = formData.endTime.split(':').map(Number);
            endDateTime.setHours(endH, endM);
            
            if (endDateTime <= startDateTime) {
                setError('A befejezési időpontnak a kezdés után kell lennie.');
                setIsSubmitting(false);
                return;
            }

            const newReservation = {
                unitId,
                name: formData.name,
                headcount: parseInt(formData.headcount),
                occasion: formData.occasion,
                source: formData.source,
                startTime: Timestamp.fromDate(startDateTime),
                endTime: Timestamp.fromDate(endDateTime),
                phone: formData.phone,
                email: formData.email,
                status: 'pending' as const,
                createdAt: Timestamp.now(),
            };
            
            await addDoc(collection(db, 'units', unitId, 'reservations'), newReservation);
            setSubmitSuccess(true);

        } catch (err) {
            console.error("Error submitting reservation:", err);
            setError("Hiba történt a foglalás elküldése során. Kérjük, próbálja meg később.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (error) {
         return <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 text-center"><div className="bg-white p-8 rounded-lg shadow-md"><h2 className="text-xl font-bold text-red-600">Hiba</h2><p className="text-gray-700 mt-2">{error}</p></div></div>;
    }
    
    if (loading || !unit) {
        return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><LoadingSpinner /></div>;
    }
    
    if (submitSuccess) {
        return (
             <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 text-center">
                <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
                    <h2 className="text-2xl font-bold text-green-700">Foglalás elküldve!</h2>
                    <p className="text-gray-700 mt-4">Köszönjük a foglalását. Hamarosan felvesszük Önnel a kapcsolatot a megadott elérhetőségeken a foglalás megerősítésével kapcsolatban.</p>
                </div>
            </div>
        );
    }
    
    const occasionOptions = ['Brunch', 'Ebéd', 'Vacsora', 'Születésnap', 'Italozás', 'Egyéb'];
    const sourceOptions = ['Google', 'Facebook / Instagram', 'Ismerős ajánlása', 'Sétáltam az utcán', 'Egyéb'];

    // Calendar rendering logic
    const renderCalendar = () => {
        const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        const days = [];
        const startDayOfWeek = (startOfMonth.getDay() + 6) % 7;
        for (let i = 0; i < startDayOfWeek; i++) { days.push(null); }
        for (let i = 1; i <= endOfMonth.getDate(); i++) { days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i)); }

        const blackoutSet = new Set(settings?.blackoutDates || []);
        const today = new Date();
        today.setHours(0,0,0,0);
        
        return (
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
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
                        const isDisabled = blackoutSet.has(dateKey) || day < today;
                        const isSelected = selectedDate && toDateKey(selectedDate) === dateKey;
                        return (
                            <div key={dateKey}>
                                <button
                                    type="button"
                                    onClick={() => handleDateSelect(day)}
                                    disabled={isDisabled}
                                    className={`w-full p-1 h-12 flex items-center justify-center text-sm rounded-lg transition-colors
                                        ${isDisabled ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'hover:bg-green-100'}
                                        ${isSelected ? 'bg-green-700 text-white font-bold' : ''}
                                    `}
                                >
                                    {day.getDate()}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 md:p-8">
            <header className="text-center mb-8">
                {unit.logoUrl ? <img src={unit.logoUrl} alt={`${unit.name} logo`} className="h-20 w-auto mx-auto mb-4 rounded-lg"/> : <MintLeafLogo className="h-20 w-20 mx-auto mb-4"/> }
                <h1 className="text-4xl font-bold text-gray-800">{unit.name}</h1>
                <p className="text-lg text-gray-600 mt-1">Asztalfoglalás</p>
            </header>
            
            <main className="w-full max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-700 mb-3">1. Válassz napot</h2>
                        {renderCalendar()}
                    </div>

                    {selectedDate && (
                         <div>
                            <h2 className="text-2xl font-semibold text-gray-700 mb-3">2. Add meg az adatokat</h2>
                             <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-medium">Név</label><input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full mt-1 p-2 border rounded-lg" required /></div>
                                    <div><label className="block text-sm font-medium">Létszám (fő)</label><input type="number" name="headcount" value={formData.headcount} onChange={handleChange} min="1" className="w-full mt-1 p-2 border rounded-lg" required /></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-medium">Telefonszám</label><input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full mt-1 p-2 border rounded-lg" /></div>
                                    <div><label className="block text-sm font-medium">Email</label><input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full mt-1 p-2 border rounded-lg" required /></div>
                                </div>
                                <div><label className="block text-sm font-medium">Alkalom</label><select name="occasion" value={formData.occasion} onChange={handleChange} className="w-full mt-1 p-2 border rounded-lg bg-white"><option disabled value="">Válassz...</option>{occasionOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-medium">Kezdés</label><input type="time" name="startTime" value={formData.startTime} onChange={handleChange} className="w-full mt-1 p-2 border rounded-lg" required /></div>
                                    <div><label className="block text-sm font-medium">Befejezés</label><input type="time" name="endTime" value={formData.endTime} onChange={handleChange} className="w-full mt-1 p-2 border rounded-lg" required /></div>
                                </div>
                                <div><label className="block text-sm font-medium">Hol hallottál rólunk?</label><select name="source" value={formData.source} onChange={handleChange} className="w-full mt-1 p-2 border rounded-lg bg-white"><option value="">Válassz...</option>{sourceOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                                {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
                                <button type="submit" disabled={isSubmitting} className="w-full bg-green-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-800 disabled:bg-gray-400 text-lg">
                                    {isSubmitting ? 'Foglalás küldése...' : 'Foglalás elküldése'}
                                </button>
                             </div>
                        </div>
                    )}
                </form>
            </main>
        </div>
    );
};

export default ReservationPage;
