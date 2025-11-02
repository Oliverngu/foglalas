import React, { useState, useEffect, useMemo, FC } from 'react';
import { ReservationSetting, ThemeSettings, GuestFormSettings } from '../../data/mockData';
import { db } from '../../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import LoadingSpinner from '../LoadingSpinner';
import ArrowUpIcon from '../icons/ArrowUpIcon';
import ArrowDownIcon from '../icons/ArrowDownIcon';
import TrashIcon from '../icons/TrashIcon';

interface ReservationSettingsModalProps {
    unitId: string;
    onClose: () => void;
}

const DEFAULT_THEME: ThemeSettings = {
    primary: '#16a34a', surface: '#ffffff', background: '#f9fafb', textPrimary: '#1f2937', 
    textSecondary: '#4b5563', accent: '#10b981', success: '#22c55e', danger: '#ef4444',
    radius: 'lg', elevation: 'mid', typographyScale: 'M'
};

const DEFAULT_GUEST_FORM: GuestFormSettings = {
    occasionOptions: ['Brunch', 'Ebéd', 'Vacsora', 'Születésnap', 'Italozás', 'Egyéb'],
    heardFromOptions: ['Google', 'Facebook / Instagram', 'Ismerős ajánlása', 'Sétáltam az utcán', 'Egyéb'],
};

type SettingsTab = 'általános' | 'űrlap' | 'téma';

const ReservationSettingsModal: FC<ReservationSettingsModalProps> = ({ unitId, onClose }) => {
    const [settings, setSettings] = useState<ReservationSetting | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<SettingsTab>('általános');
    
    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            const docRef = doc(db, 'reservation_settings', unitId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSettings({
                    id: unitId,
                    blackoutDates: data.blackoutDates || [],
                    dailyCapacity: data.dailyCapacity ?? null,
                    bookableWindow: data.bookableWindow || { from: '11:00', to: '23:00' },
                    kitchenOpen: data.kitchenOpen ?? null,
                    barClose: data.barClose ?? null,
                    guestForm: { ...DEFAULT_GUEST_FORM, ...data.guestForm },
                    theme: { ...DEFAULT_THEME, ...data.theme },
                } as ReservationSetting);
            } else {
                setSettings({
                    id: unitId,
                    blackoutDates: [],
                    dailyCapacity: null,
                    bookableWindow: { from: '11:00', to: '23:00' },
                    kitchenOpen: null,
                    barClose: null,
                    guestForm: DEFAULT_GUEST_FORM,
                    theme: DEFAULT_THEME,
                });
            }
            setLoading(false);
        };
        fetchSettings();
    }, [unitId]);

    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'reservation_settings', unitId), settings, { merge: true });
            alert('Beállítások mentve!');
            onClose();
        } catch (error) {
            console.error("Error saving settings:", error);
            alert('Hiba a mentés során.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderContent = () => {
        if (loading || !settings) return <div className="h-full relative"><LoadingSpinner /></div>;
        switch (activeTab) {
            case 'általános': return <GeneralSettingsTab settings={settings} setSettings={setSettings} />;
            case 'űrlap': return <FormOptionsTab settings={settings} setSettings={setSettings} />;
            case 'téma': return <ThemeStyleTab settings={settings} setSettings={setSettings} />;
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Foglalási beállítások</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 text-gray-500">&times;</button>
                </div>
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex gap-4 px-6">
                        <button onClick={() => setActiveTab('általános')} className={`py-3 px-1 border-b-2 font-semibold ${activeTab === 'általános' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Általános</button>
                        <button onClick={() => setActiveTab('űrlap')} className={`py-3 px-1 border-b-2 font-semibold ${activeTab === 'űrlap' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Űrlap opciók</button>
                        <button onClick={() => setActiveTab('téma')} className={`py-3 px-1 border-b-2 font-semibold ${activeTab === 'téma' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Téma és stílus</button>
                    </nav>
                </div>
                <div className="flex-1 p-6 overflow-y-auto bg-gray-50">{renderContent()}</div>
                <div className="p-4 bg-white border-t flex justify-end gap-3 rounded-b-2xl">
                    <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg font-semibold">Mégse</button>
                    <button type="button" onClick={handleSave} disabled={isSaving} className="bg-green-700 text-white px-4 py-2 rounded-lg font-semibold disabled:bg-gray-400">{isSaving ? 'Mentés...' : 'Mentés'}</button>
                </div>
            </div>
        </div>
    );
};

const GeneralSettingsTab: FC<{ settings: ReservationSetting, setSettings: React.Dispatch<React.SetStateAction<ReservationSetting | null>> }> = ({ settings, setSettings }) => {
    const [newBlackoutDate, setNewBlackoutDate] = useState('');

    const handleFieldChange = (field: keyof ReservationSetting, value: any) => {
        setSettings(prev => prev ? ({ ...prev, [field]: value }) : null);
    };

    const handleTimeWindowChange = (part: 'from' | 'to', value: string) => {
        setSettings(prev => prev ? ({...prev, bookableWindow: { ...prev.bookableWindow!, [part]: value }}) : null);
    };

    const addBlackoutDate = () => {
        if(newBlackoutDate && !settings.blackoutDates.includes(newBlackoutDate)){
            const updatedDates = [...settings.blackoutDates, newBlackoutDate].sort();
            handleFieldChange('blackoutDates', updatedDates);
            setNewBlackoutDate('');
        }
    };
    
    const removeBlackoutDate = (date: string) => {
        handleFieldChange('blackoutDates', settings.blackoutDates.filter(d => d !== date));
    };

    return (
        <div className="space-y-6">
            <div className="p-4 bg-white border rounded-lg">
                <h3 className="font-bold mb-2">Foglalható időablak</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm">Nyitás</label><input type="time" value={settings.bookableWindow?.from} onChange={e => handleTimeWindowChange('from', e.target.value)} className="w-full p-2 border rounded-md" step="300" /></div>
                    <div><label className="text-sm">Zárás</label><input type="time" value={settings.bookableWindow?.to} onChange={e => handleTimeWindowChange('to', e.target.value)} className="w-full p-2 border rounded-md" step="300" /></div>
                </div>
            </div>
             <div className="p-4 bg-white border rounded-lg">
                <h3 className="font-bold mb-2">Egyéb időpontok</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm">Konyha nyitás</label><input type="time" value={settings.kitchenOpen || ''} onChange={e => handleFieldChange('kitchenOpen', e.target.value || null)} className="w-full p-2 border rounded-md"/></div>
                    <div><label className="text-sm">Bár zárás</label><input type="time" value={settings.barClose || ''} onChange={e => handleFieldChange('barClose', e.target.value || null)} className="w-full p-2 border rounded-md"/></div>
                </div>
            </div>
            <div className="p-4 bg-white border rounded-lg">
                <label className="font-bold mb-2 block">Napi létszám limit</label>
                <input type="number" placeholder="Nincs limit" value={settings.dailyCapacity || ''} onChange={e => handleFieldChange('dailyCapacity', e.target.value ? Number(e.target.value) : null)} className="w-full p-2 border rounded-md"/>
            </div>
            <div className="p-4 bg-white border rounded-lg">
                <h3 className="font-bold mb-2">Blackout napok</h3>
                <div className="flex gap-2 mb-3">
                    <input type="date" value={newBlackoutDate} onChange={e => setNewBlackoutDate(e.target.value)} className="w-full p-2 border rounded-md"/>
                    <button onClick={addBlackoutDate} className="bg-blue-600 text-white px-3 rounded font-semibold shrink-0">Hozzáad</button>
                </div>
                 <div className="space-y-1 max-h-40 overflow-y-auto">
                    {settings.blackoutDates.map(date => (
                        <div key={date} className="flex justify-between items-center bg-gray-100 p-2 rounded">
                            <span>{date}</span>
                            <button onClick={() => removeBlackoutDate(date)} className="p-1 text-red-500"><TrashIcon className="h-4 w-4"/></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const FormOptionsTab: FC<{ settings: ReservationSetting, setSettings: React.Dispatch<React.SetStateAction<ReservationSetting | null>> }> = ({ settings, setSettings }) => {
    const handleUpdateOptions = (key: keyof GuestFormSettings, newOptions: string[]) => {
        setSettings(prev => prev ? ({ ...prev, guestForm: { ...prev.guestForm!, [key]: newOptions } }) : null);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <OptionManager 
                title="Alkalom opciók"
                options={settings.guestForm?.occasionOptions || []}
                setOptions={(newOptions) => handleUpdateOptions('occasionOptions', newOptions)}
                defaultOptions={DEFAULT_GUEST_FORM.occasionOptions}
            />
             <OptionManager 
                title="Hol hallottál rólunk? opciók"
                options={settings.guestForm?.heardFromOptions || []}
                setOptions={(newOptions) => handleUpdateOptions('heardFromOptions', newOptions)}
                defaultOptions={DEFAULT_GUEST_FORM.heardFromOptions}
            />
        </div>
    );
};

const OptionManager: FC<{title: string, options: string[], setOptions: (opts: string[])=>void, defaultOptions: string[]}> = ({ title, options, setOptions, defaultOptions }) => {
    const [newOption, setNewOption] = useState('');

    const addOption = () => {
        if (newOption.trim() && !options.includes(newOption.trim())) {
            setOptions([...options, newOption.trim()]);
            setNewOption('');
        }
    };

    const removeOption = (index: number) => {
        setOptions(options.filter((_, i) => i !== index));
    };

    const moveOption = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= options.length) return;
        const newOptions = [...options];
        [newOptions[index], newOptions[newIndex]] = [newOptions[newIndex], newOptions[index]];
        setOptions(newOptions);
    };

    return (
        <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-bold mb-3">{title}</h3>
            <div className="space-y-2 mb-4">
                {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded border">
                        <span className="flex-grow">{opt}</span>
                        <button onClick={() => moveOption(i, 'up')} disabled={i === 0} className="p-1 disabled:opacity-30"><ArrowUpIcon className="h-4 w-4" /></button>
                        <button onClick={() => moveOption(i, 'down')} disabled={i === options.length - 1} className="p-1 disabled:opacity-30"><ArrowDownIcon className="h-4 w-4" /></button>
                        <button onClick={() => removeOption(i)} className="p-1 text-red-500"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <input value={newOption} onChange={e => setNewOption(e.target.value)} placeholder="Új opció..." className="w-full p-2 border rounded" />
                <button onClick={addOption} className="bg-blue-600 text-white px-3 rounded font-semibold shrink-0">Hozzáad</button>
            </div>
             <button onClick={() => setOptions(defaultOptions)} className="text-sm text-gray-500 hover:underline mt-4">Alapértékek visszaállítása</button>
        </div>
    );
};

const ThemeStyleTab: FC<{ settings: ReservationSetting, setSettings: React.Dispatch<React.SetStateAction<ReservationSetting | null>> }> = ({ settings, setSettings }) => {
    const theme = settings.theme!;

    const handleThemeChange = (key: keyof ThemeSettings, value: string) => {
        setSettings(prev => prev ? ({...prev, theme: {...prev.theme!, [key]: value}}) : null);
    };

    const contrastWarning = useMemo(() => {
        const checkContrast = (bg: string, text: string) => {
            const ratio = getContrastRatio(bg, text);
            return ratio < 4.5; // WCAG AA
        };
        const warnings: string[] = [];
        if (checkContrast(theme.surface, theme.textPrimary)) warnings.push("Felület / Elsődleges szöveg");
        if (checkContrast(theme.background, theme.textPrimary)) warnings.push("Háttér / Elsődleges szöveg");
        if (checkContrast(theme.primary, '#ffffff')) warnings.push("Gomb / Fehér szöveg");
        return warnings;
    }, [theme]);
    
    return (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-white p-4 rounded-lg border space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <ColorInput label="Elsődleges szín (gombok)" color={theme.primary} onChange={v => handleThemeChange('primary', v)} />
                    <ColorInput label="Kiemelő szín" color={theme.accent} onChange={v => handleThemeChange('accent', v)} />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <ColorInput label="Felület (kártyák)" color={theme.surface} onChange={v => handleThemeChange('surface', v)} />
                    <ColorInput label="Háttér" color={theme.background} onChange={v => handleThemeChange('background', v)} />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <ColorInput label="Elsődleges szöveg" color={theme.textPrimary} onChange={v => handleThemeChange('textPrimary', v)} />
                    <ColorInput label="Másodlagos szöveg" color={theme.textSecondary} onChange={v => handleThemeChange('textSecondary', v)} />
                </div>
                {contrastWarning.length > 0 && <div className="text-sm text-amber-700 bg-amber-100 p-2 rounded">Figyelem: alacsony kontraszt a következőknél: {contrastWarning.join(', ')}</div>}
                 <hr/>
                <div>
                    <h4 className="font-bold mb-2">Stílus</h4>
                     <div className="grid grid-cols-3 gap-2">
                        {(['low', 'mid', 'high'] as const).map(el => <button key={el} onClick={() => handleThemeChange('elevation', el)} className={`p-2 rounded border ${theme.elevation === el ? 'border-green-600 bg-green-100' : ''}`}>{el}</button>)}
                    </div>
                </div>
                <div>
                     <h4 className="font-bold mb-2">Lekerekítés</h4>
                     <div className="grid grid-cols-3 gap-2">
                        {(['sm', 'md', 'lg'] as const).map(r => <button key={r} onClick={() => handleThemeChange('radius', r)} className={`p-2 rounded border ${theme.radius === r ? 'border-green-600 bg-green-100' : ''}`}>{r}</button>)}
                    </div>
                </div>
                 <div>
                     <h4 className="font-bold mb-2">Betűméret</h4>
                     <div className="grid grid-cols-3 gap-2">
                        {(['S', 'M', 'L'] as const).map(s => <button key={s} onClick={() => handleThemeChange('typographyScale', s)} className={`p-2 rounded border ${theme.typographyScale === s ? 'border-green-600 bg-green-100' : ''}`}>{s}</button>)}
                    </div>
                </div>
                 <button onClick={() => setSettings(prev => prev ? ({...prev, theme: DEFAULT_THEME}) : null)} className="text-sm text-gray-500 hover:underline">Alapértékek visszaállítása</button>
            </div>
            <div className="p-4 rounded-lg bg-white border">
                <ThemePreview theme={theme} />
            </div>
         </div>
    );
};

const ColorInput: FC<{label: string, color: string, onChange: (c: string) => void}> = ({ label, color, onChange }) => (
    <div>
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-2 mt-1">
            <input type="color" value={color} onChange={e => onChange(e.target.value)} className="w-8 h-8 rounded border p-0.5" />
            <input type="text" value={color} onChange={e => onChange(e.target.value)} className="w-full p-1 border rounded" />
        </div>
    </div>
);

const ThemePreview: FC<{theme: ThemeSettings}> = ({ theme }) => {
     const radiusClass = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg' }[theme.radius];
     const shadowClass = { low: 'shadow-sm', mid: 'shadow-md', high: 'shadow-lg' }[theme.elevation];
     const fontBaseClass = { S: 'text-sm', M: 'text-base', L: 'text-lg' }[theme.typographyScale];

    return (
        <div className="h-full p-4 rounded" style={{ backgroundColor: theme.background, color: theme.textPrimary }}>
            <div className={`p-4 ${radiusClass} ${shadowClass}`} style={{ backgroundColor: theme.surface }}>
                <h3 className={`font-bold text-lg ${fontBaseClass}`}>Élő előnézet</h3>
                <p className={`mt-1 text-sm ${fontBaseClass}`} style={{ color: theme.textSecondary }}>Ez a kártya a beállításaidat tükrözi.</p>
                <div className="flex gap-2 mt-4">
                    <button className={`py-2 px-4 font-bold text-white ${radiusClass}`} style={{ backgroundColor: theme.primary }}>Elsődleges gomb</button>
                    <button className={`py-2 px-4 font-bold border ${radiusClass}`} style={{ color: theme.textPrimary, borderColor: theme.textSecondary }}>Másodlagos</button>
                </div>
            </div>
        </div>
    );
};

// --- COLOR UTILITIES ---
function hexToRgb(hex: string): {r: number, g: number, b: number} | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}
function getLuminance(r: number, g: number, b: number): number {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}
function getContrastRatio(color1: string, color2: string): number {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    if (!rgb1 || !rgb2) return 1;
    const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
}


export default ReservationSettingsModal;