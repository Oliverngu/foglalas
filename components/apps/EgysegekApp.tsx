import React, { useState, useEffect } from 'react';
import { Unit, User, Invitation } from '../../data/mockData';
import { db, storage, serverTimestamp } from '../../firebase/config';
import { collection, onSnapshot, orderBy, query, doc, writeBatch, deleteDoc, updateDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import LoadingSpinner from '../LoadingSpinner';
import BuildingIcon from '../icons/BuildingIcon';
import TrashIcon from '../icons/TrashIcon';
import CopyIcon from '../icons/CopyIcon';

const EgysegekApp: React.FC = () => {
    const [units, setUnits] = useState<Unit[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newUnitName, setNewUnitName] = useState('');
    const [newUnitAdminName, setNewUnitAdminName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [generatedLink, setGeneratedLink] = useState('');
    const [copied, setCopied] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsubscribeUnits = onSnapshot(query(collection(db, 'units'), orderBy('name')), snapshot => {
            const fetchedUnits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
            setUnits(fetchedUnits);
            setLoading(false);
        }, err => {
            console.error("Error fetching units:", err);
            setError("Hiba az üzletek betöltése közben.");
            setLoading(false);
        });
        
        const unsubscribeUsers = onSnapshot(collection(db, 'users'), snapshot => {
            const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setUsers(fetchedUsers);
        });

        return () => {
            unsubscribeUnits();
            unsubscribeUsers();
        };
    }, []);

    const generateInviteCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let code = '';
        for (let i = 0; i < 16; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    const handleInviteUnitAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedUnitName = newUnitName.trim();
        const trimmedAdminName = newUnitAdminName.trim();
        if (trimmedUnitName === '' || trimmedAdminName === '') return;
        
        if (units.some(unit => unit.name.toLowerCase() === trimmedUnitName.toLowerCase())) {
            alert('Már létezik üzlet ezzel a névvel.');
            return;
        }

        setIsSubmitting(true);
        setGeneratedLink('');

        try {
            const batch = writeBatch(db);
            
            // 1. Create new unit
            const newUnitRef = doc(collection(db, 'units'));
            batch.set(newUnitRef, { name: trimmedUnitName });
            
            // 2. Create invitation for the Unit Admin
            const inviteCode = generateInviteCode();
            const newInviteRef = doc(db, 'invitations', inviteCode);
            const nameParts = trimmedAdminName.split(' ');
            const firstName = nameParts.pop() || '';
            const lastName = nameParts.join(' ');
            const newInvite: Omit<Invitation, 'id' | 'createdAt'> & {createdAt: any} = {
                code: inviteCode,
                role: 'Unit Admin',
                unitId: newUnitRef.id,
                position: 'Üzletvezető', // Default position for new unit admins
                prefilledLastName: lastName,
                prefilledFirstName: firstName,
                status: 'active',
                createdAt: serverTimestamp()
            };
            batch.set(newInviteRef, newInvite);

            await batch.commit();

            setGeneratedLink(`${window.location.origin}?register=${inviteCode}`);
            setNewUnitName('');
            setNewUnitAdminName('');
        } catch (err) {
            console.error("Error creating unit and invitation:", err);
            alert("Hiba történt a folyamat során.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCopy = () => {
        if (!generatedLink) return;
        navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDeleteUnit = async (unitId: string, unitName: string) => {
        const usersInUnit = users.filter(user => user.unitIds?.includes(unitId)).length;
        let confirmationMessage = `Biztosan törölni szeretnéd a(z) "${unitName}" üzletet?`;
        if (usersInUnit > 0) {
            confirmationMessage = `Figyelem! ${usersInUnit} felhasználó ehhez az üzlethez tartozik. Ha törlöd, a felhasználókat manuálisan kell majd egy másikhoz rendelned a "Felhasználók" menüpontban. Biztosan folytatod a törlést?`;
        }

        if (window.confirm(confirmationMessage)) {
            try {
                await deleteDoc(doc(db, 'units', unitId));
            } catch (err) {
                console.error("Error deleting unit:", err);
                alert("Hiba történt az üzlet törlése közben.");
            }
        }
    };

    const handleLogoUpload = async (unitId: string, file: File) => {
        if (!file) return;
        setUploadingLogo(unitId);
        const storagePath = `unit_logos/${unitId}/${file.name}`;
        const storageRef = ref(storage, storagePath);
        try {
            const uploadTask = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(uploadTask.ref);
            await updateDoc(doc(db, 'units', unitId), { logoUrl: downloadURL });
        } catch (error) {
            console.error("Error uploading logo:", error);
            alert("Hiba a logó feltöltésekor.");
        } finally {
            setUploadingLogo(null);
        }
    };

    const handleDeleteLogo = async (unit: Unit) => {
        if (window.confirm(`Biztosan törölni szeretnéd a(z) "${unit.name}" üzlet logóját?`)) {
            try {
                // Note: This does not delete the file from Storage, only removes the link.
                // A Cloud Function would be needed for full cleanup.
                await updateDoc(doc(db, 'units', unit.id), {
                    logoUrl: deleteField()
                });
            } catch (err) {
                console.error("Error deleting logo URL:", err);
                alert("Hiba történt a logó törlése során.");
            }
        }
    };

    return (
        <div className="p-4 md:p-8">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 mb-8 max-w-2xl mx-auto">
                <h2 className="text-xl font-bold text-gray-800 mb-2">Új üzlet és adminisztrátor meghívása</h2>
                <p className="text-gray-600 mb-4 text-sm">Add meg az új üzlet nevét és az elsődleges adminisztrátorának nevét. A rendszer létrehozza az üzletet és generál egy meghívó linket, amivel az adminisztrátor regisztrálhat.</p>
                <form onSubmit={handleInviteUnitAdmin} className="space-y-4">
                    <input
                        type="text"
                        value={newUnitName}
                        onChange={(e) => setNewUnitName(e.target.value)}
                        placeholder="Új üzlet neve (pl. MintLeaf Debrecen)"
                        className="w-full px-4 py-2 border rounded-lg"
                        required
                    />
                     <input
                        type="text"
                        value={newUnitAdminName}
                        onChange={(e) => setNewUnitAdminName(e.target.value)}
                        placeholder="Egység Adminisztrátor teljes neve"
                        className="w-full px-4 py-2 border rounded-lg"
                        required
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-green-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-800 disabled:bg-gray-400"
                    >
                        {isSubmitting ? 'Létrehozás...' : 'Üzlet létrehozása és meghívó generálása'}
                    </button>
                </form>
                {generatedLink && (
                     <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                         <h3 className="font-bold text-green-800">Sikeres művelet!</h3>
                         <p className="text-sm text-green-700 mb-2">Másold ki és küldd el ezt a linket a meghívott adminisztrátornak:</p>
                         <div className="flex items-center gap-2 bg-white p-2 rounded-md border">
                            <input type="text" value={generatedLink} readOnly className="w-full bg-transparent text-sm focus:outline-none"/>
                            <button onClick={handleCopy} className="bg-blue-600 text-white font-semibold text-sm px-3 py-1.5 rounded-md hover:bg-blue-700 whitespace-nowrap">
                                 {copied ? 'Másolva!' : 'Másolás'}
                            </button>
                         </div>
                     </div>
                )}
            </div>

            {loading && <div className="relative h-64"><LoadingSpinner /></div>}
            {error && <div className="bg-red-100 p-4 rounded-lg text-red-700">{error}</div>}
      
            {!loading && !error && (
                 <div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Meglévő üzletek</h3>
                     {units.length > 0 ? (
                        <div className="space-y-3 max-w-2xl mx-auto">
                            {units.map(unit => {
                                const userCount = users.filter(u => u.unitIds?.includes(unit.id)).length;
                                return (
                                    <div key={unit.id} className="bg-white p-4 rounded-xl shadow-md border">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                {unit.logoUrl ? (
                                                    <img src={unit.logoUrl} alt={`${unit.name} logo`} className="h-14 w-14 rounded-lg object-cover bg-gray-100" />
                                                ) : (
                                                    <div className="p-3 bg-gray-100 rounded-lg">
                                                        <BuildingIcon className="h-8 w-8 text-gray-600" />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-semibold text-gray-800 text-lg">{unit.name}</p>
                                                    <p className="text-sm text-gray-500">{userCount} felhasználó</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteUnit(unit.id, unit.name)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                aria-label={`${unit.name} törlése`}
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                        <div className="mt-4 pt-3 border-t">
                                            <label htmlFor={`logo-upload-${unit.id}`} className="text-sm font-medium text-gray-700">
                                                Logó cseréje/feltöltése
                                            </label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <input
                                                    id={`logo-upload-${unit.id}`}
                                                    type="file"
                                                    accept="image/png, image/jpeg, image/webp"
                                                    onChange={(e) => e.target.files && handleLogoUpload(unit.id, e.target.files[0])}
                                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                    disabled={uploadingLogo === unit.id}
                                                />
                                                {unit.logoUrl && (
                                                    <button onClick={() => handleDeleteLogo(unit)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Logó törlése">
                                                        <TrashIcon className="h-5 w-5" />
                                                    </button>
                                                )}
                                            </div>
                                             {uploadingLogo === unit.id && <p className="text-xs text-blue-600 mt-1">Feltöltés folyamatban...</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                     ) : (
                        <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-xl max-w-2xl mx-auto">
                            <BuildingIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700">Nincsenek üzletek</h3>
                            <p className="text-gray-500 mt-1">Még nem hoztál létre egyetlen üzletet sem.</p>
                        </div>
                     )}
                 </div>
            )}
        </div>
    );
};

export default EgysegekApp;