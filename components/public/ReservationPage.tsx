import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Unit, ReservationSetting, Booking, User } from '../../data/mockData';
import { db, Timestamp } from '../../firebase/config';
import { doc, getDoc, collection, addDoc, query, where, getDocs, setDoc } from 'firebase/firestore';
import LoadingSpinner from '../LoadingSpinner';
import MintLeafLogo from '../icons/AppleLogo';
import SettingsIcon from '../icons/SettingsIcon';

interface ReservationPageProps {
    unitId: string;
    allUnits: Unit[];
    currentUser: User | null;
}

const toDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ProgressIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = ['Dátum', 'Részletek', 'Megerősítés'];
    return (
        <div className="flex items-center justify-center w-full max-w-xl mx-auto mb-8">
            {steps.map((label, index) => {
                const stepNumber = index + 1;
                const isCompleted = currentStep > stepNumber;
                const isActive = currentStep === stepNumber;
                return (
                    <React.Fragment key={stepNumber}>
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${
                                isCompleted ? 'bg-green-700 text-white' : isActive ? 'bg-green-200 text-green-800 border-2 border-green-700' : 'bg-gray-200 text-gray-500'
                            }`}>
                                {isCompleted ? '✓' : stepNumber}
                            </div>
                            <p className={`mt-2 text-sm font-semibold transition-colors ${isActive || isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>{label}</p>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`flex-1 h-1 mx-2 transition-colors ${isCompleted ? 'bg-green-700' : 'bg-gray-200'}`}></div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const ReservationPage: React.FC<ReservationPageProps> = ({ unitId, allUnits, currentUser }) => {
    const [step, setStep] = useState(1);
    const [unit, setUnit] = useState<Unit | null>(null);
    const [settings, setSettings] = useState<ReservationSetting | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [formData, setFormData] = useState({ name: '', headcount: '2', occasion: 'Vacsora', startTime: '', endTime: '', source: '', phone: '', email: '' });
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    
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
                const defaultSettings: ReservationSetting = { id: unitId, blackoutDates: [], bookableWindow: { from: '11:00', to: '23:00'}, kitchenOpen: '22:00', barClose: '24:00' };
                if (docSnap.exists()) {
                    setSettings({ ...defaultSettings, ...docSnap.data() });
                } else {
                    setSettings(defaultSettings);
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
    
    const resetFlow = () => {
        setSelectedDate(null);
        setFormData({ name: '', headcount: '2', occasion: 'Vacsora', startTime: '', endTime: '', source: '', phone: '', email: '' });
        setStep(1);
    };

    const handleDateSelect = (day: Date) => {
        setSelectedDate(day);
        setStep(2);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !formData.startTime) {
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
            let finalEndTime = Timestamp.fromMillis(startDateTime.getTime() + (2 * 60 * 60 * 1000)); // Default 2 hours if not provided
            if(formData.endTime) {
                const [endH, endM] = formData.endTime.split(':').map(Number);
                endDateTime.setHours(endH, endM);
                 if (endDateTime <= startDateTime) {
                    setError('A befejezési időpontnak a kezdés után kell lennie.'); setIsSubmitting(false); return;
                }
                finalEndTime = Timestamp.fromDate(endDateTime);
            }
            const newReservation = {
                unitId, name: formData.name, headcount: parseInt(formData.headcount),
                occasion: formData.occasion, source: formData.source,
                startTime: Timestamp.fromDate(startDateTime), endTime: finalEndTime,
                phone: formData.phone, email: formData.email,
                status: 'pending' as const, createdAt: Timestamp.now(),
            };
            await addDoc(collection(db, 'units', unitId, 'reservations'), newReservation);
            setStep(3);
        } catch (err) {
            console.error("Error submitting reservation:", err);
            setError("Hiba történt a foglalás elküldése során. Kérjük, próbálja meg később.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Unit Admin';

    if (error) return <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 text-center"><div className="bg-white p-8 rounded-lg shadow-md"><h2 className="text-xl font-bold text-red-600">Hiba</h2><p className="text-gray-700 mt-2">{error}</p></div></div>;
    if (loading || !unit) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><LoadingSpinner /></div>;
    
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 md:p-8">
            <header className="text-center mb-8">
                {unit.logoUrl ? <img src={unit.logoUrl} alt={`${unit.name} logo`} className="h-20 w-auto mx-auto mb-4 rounded-lg"/> : <MintLeafLogo className="h-20 w-20 mx-auto mb-4"/> }
                <h1 className="text-4xl font-bold text-gray-800">{unit.name}</h1>
                <p className="text-lg text-gray-600 mt-1">Asztalfoglalás</p>
            </header>
            
            {isAdmin && <button onClick={() => setIsSettingsOpen(true)} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow border"><SettingsIcon /></button>}
            
            <main className="w-full max-w-2xl">
                <ProgressIndicator currentStep={step} />
                <div className="relative overflow-hidden">
                    <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${(step - 1) * 100}%)` }}>
                        <div className="w-full flex-shrink-0"><Step1Date settings={settings} onDateSelect={handleDateSelect} /></div>
                        <div className="w-full flex-shrink-0"><Step2Details selectedDate={selectedDate} formData={formData} setFormData={setFormData} onBack={() => setStep(1)} onSubmit={handleSubmit} isSubmitting={isSubmitting} /></div>
                        <div className="w-full flex-shrink-0"><Step3Confirmation onReset={resetFlow} /></div>
                    </div>
                </div>
            </main>
        </div>
    );
};

const Step1Date: React.FC<{ settings: ReservationSetting | null, onDateSelect: (date: Date) => void }> = ({ settings, onDateSelect }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const days = [];
    const startDayOfWeek = (startOfMonth.getDay() + 6) % 7;
    for (let i = 0; i < startDayOfWeek; i++) { days.push(null); }
    for (let i = 1; i <= endOfMonth.getDate(); i++) { days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i)); }

    const blackoutSet = new Set(settings?.blackoutDates || []);
    const today = new Date(); today.setHours(0,0,0,0);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <h2 className="text-2xl font-semibold text-gray-700 mb-3 text-center">1. Válassz napot</h2>
            <div className="flex justify-between items-center mb-4">
                <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 rounded-full hover:bg-gray-100">&lt;</button>
                <h3 className="font-bold text-lg">{currentMonth.toLocaleDateString('hu-HU', { month: 'long', year: 'numeric' })}</h3>
                <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 rounded-full hover:bg-gray-100">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center font-semibold text-gray-500 text-sm mb-2">{['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map(d => <div key={d}>{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`}></div>;
                    const dateKey = toDateKey(day);
                    const isDisabled = blackoutSet.has(dateKey) || day < today;
                    return (
                        <div key={dateKey}><button type="button" onClick={() => onDateSelect(day)} disabled={isDisabled} className={`w-full p-1 h-12 flex items-center justify-center text-sm rounded-lg transition-colors ${isDisabled ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'hover:bg-green-100'}`} >{day.getDate()}</button></div>
                    );
                })}
            </div>
        </div>
    );
}

const Step2Details: React.FC<any> = ({ selectedDate, formData, setFormData, onBack, onSubmit, isSubmitting }) => {
    const occasionOptions = ['Brunch', 'Ebéd', 'Vacsora', 'Születésnap', 'Italozás', 'Egyéb'];
    const sourceOptions = ['Google', 'Facebook / Instagram', 'Ismerős ajánlása', 'Sétáltam az utcán', 'Egyéb'];
    if (!selectedDate) return null;
    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <h2 className="text-2xl font-semibold text-gray-700 mb-3">2. Add meg az adatokat</h2>
            <form onSubmit={onSubmit} className="space-y-4">
                <input type="text" readOnly value={selectedDate.toLocaleDateString('hu-HU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} className="w-full p-2 border rounded-lg bg-gray-100 text-center font-semibold"/>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium">Név</label><input type="text" name="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" required /></div>
                    <div><label className="block text-sm font-medium">Létszám (fő)</label><input type="number" name="headcount" value={formData.headcount} onChange={e => setFormData({...formData, headcount: e.target.value})} min="1" className="w-full mt-1 p-2 border rounded-lg" required /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium">Kezdés</label><input type="time" name="startTime" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" required /></div>
                    <div><label className="block text-sm font-medium">Befejezés (opc.)</label><input type="time" name="endTime" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" /></div>
                </div>
                <div><label className="block text-sm font-medium">Alkalom</label><select name="occasion" value={formData.occasion} onChange={e => setFormData({...formData, occasion: e.target.value})} className="w-full mt-1 p-2 border rounded-lg bg-white"><option disabled value="">Válassz...</option>{occasionOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                <div className="flex justify-between items-center pt-4">
                    <button type="button" onClick={onBack} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Vissza</button>
                    <button type="submit" disabled={isSubmitting} className="bg-green-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-800 disabled:bg-gray-400 text-lg">{isSubmitting ? 'Küldés...' : 'Tovább'}</button>
                </div>
            </form>
        </div>
    )
}

const Step3Confirmation: React.FC<{ onReset: () => void }> = ({ onReset }) => {
    return (
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center">
            <h2 className="text-2xl font-bold text-green-700">Foglalási kérés elküldve!</h2>
            <p className="text-gray-700 mt-4">Köszönjük! Hamarosan felvesszük Önnel a kapcsolatot a megadott elérhetőségeken a foglalás megerősítésével kapcsolatban.</p>
            <button onClick={onReset} className="mt-6 bg-green-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-800">Új foglalás</button>
        </div>
    );
}

// Settings modal needs to be created
const SettingsModal: React.FC<{ unitId: string, settings: ReservationSetting, onClose: () => void, onSave: () => void }> = ({ unitId, settings: initialSettings, onClose, onSave }) => {
    return (
        <div>Modal Placeholder</div>
    )
};

export default ReservationPage;