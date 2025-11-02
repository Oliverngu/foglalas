import React, { useState, useEffect } from 'react';
import { Invitation, Unit, Position } from '../../data/mockData';
import { db, serverTimestamp } from '../../firebase/config';
import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import LoadingSpinner from '../LoadingSpinner';
import InvitationIcon from '../icons/InvitationIcon';
import CopyIcon from '../icons/CopyIcon';

const MeghivokApp: React.FC = () => {
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [newInviteRole, setNewInviteRole] = useState<'User' | 'Admin' | 'Guest'>('User');
    const [newInviteUnitId, setNewInviteUnitId] = useState('');
    const [newInvitePosition, setNewInvitePosition] = useState('');
    const [newInvitePrefilledLastName, setNewInvitePrefilledLastName] = useState('');
    const [newInvitePrefilledFirstName, setNewInvitePrefilledFirstName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [copiedCode, setCopiedCode] = useState('');

    useEffect(() => {
        const invitesQuery = query(collection(db, 'invitations'), orderBy('createdAt', 'desc'));
        const unsubscribeInvites = onSnapshot(invitesQuery, snapshot => {
            const fetchedInvites = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
            setInvitations(fetchedInvites);
            setLoading(false);
        }, err => {
            setError("Hiba a meghívók betöltésekor.");
            setLoading(false);
        });
        
        const unitsQuery = query(collection(db, 'units'), orderBy('name'));
        const unsubscribeUnits = onSnapshot(unitsQuery, snapshot => {
            const fetchedUnits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
            setUnits(fetchedUnits);
        });
        
        const positionsQuery = query(collection(db, 'positions'), orderBy('name'));
        const unsubscribePositions = onSnapshot(positionsQuery, snapshot => {
            const fetchedPositions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Position));
            setPositions(fetchedPositions);
        });

        return () => {
            unsubscribeInvites();
            unsubscribeUnits();
            unsubscribePositions();
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
    
    const handleGenerateInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newInviteUnitId || !newInvitePosition) {
            alert("Kérlek, válassz egységet és pozíciót is.");
            return;
        }

        setIsSubmitting(true);
        const code = generateInviteCode();
        
        const newInvite: any = {
            code,
            role: newInviteRole,
            unitId: newInviteUnitId,
            position: newInvitePosition,
            status: 'active',
            createdAt: serverTimestamp(),
        };

        if (newInvitePrefilledLastName.trim()) {
            newInvite.prefilledLastName = newInvitePrefilledLastName.trim();
        }
        if (newInvitePrefilledFirstName.trim()) {
            newInvite.prefilledFirstName = newInvitePrefilledFirstName.trim();
        }

        try {
            await setDoc(doc(db, 'invitations', code), newInvite);
            setNewInvitePrefilledLastName('');
            setNewInvitePrefilledFirstName('');
        } catch (err) {
            console.error("Error creating invitation:", err);
            alert("Hiba történt a meghívó létrehozásakor.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCopy = (code: string) => {
        const url = `${window.location.origin}?register=${code}`;
        navigator.clipboard.writeText(url);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(''), 2000);
    };
    
    const getUnitName = (unitId: string) => units.find(u => u.id === unitId)?.name || 'Ismeretlen';

    return (
        <div className="p-4 md:p-8">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 mb-8 max-w-2xl mx-auto">
                <h2 className="text-xl font-bold text-gray-800 mb-2">Új meghívó generálása</h2>
                <form onSubmit={handleGenerateInvite} className="space-y-4">
                     <div>
                        <label className="text-sm font-medium">Név (opcionális)</label>
                        <div className="flex gap-4 mt-1">
                            <input 
                                type="text"
                                value={newInvitePrefilledLastName}
                                onChange={(e) => setNewInvitePrefilledLastName(e.target.value)}
                                placeholder="Vezetéknév"
                                className="w-full p-2 border rounded-lg bg-white"
                            />
                             <input 
                                type="text"
                                value={newInvitePrefilledFirstName}
                                onChange={(e) => setNewInvitePrefilledFirstName(e.target.value)}
                                placeholder="Keresztnév"
                                className="w-full p-2 border rounded-lg bg-white"
                            />
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-medium">Szerepkör</label>
                        <select value={newInviteRole} onChange={(e) => setNewInviteRole(e.target.value as any)} className="w-full mt-1 p-2 border rounded-lg bg-white">
                            <option value="User">User</option>
                            <option value="Guest">Guest (Vendég)</option>
                            <option value="Admin">Admin</option>
                        </select>
                    </div>
                     <div>
                        <label className="text-sm font-medium">Egység</label>
                        <select value={newInviteUnitId} onChange={(e) => setNewInviteUnitId(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white" required>
                            <option value="" disabled>Válassz egységet</option>
                            {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="text-sm font-medium">Pozíció</label>
                        <select value={newInvitePosition} onChange={(e) => setNewInvitePosition(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white" required>
                             <option value="" disabled>Válassz pozíciót</option>
                            {positions.map(pos => <option key={pos.id} value={pos.name}>{pos.name}</option>)}
                        </select>
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-green-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-800 disabled:bg-gray-400">
                        {isSubmitting ? 'Generálás...' : 'Meghívó link generálása'}
                    </button>
                </form>
            </div>
            
            {loading && <div className="relative h-64"><LoadingSpinner /></div>}
            {error && <p className="text-red-500">{error}</p>}

            {!loading && !error && (
                <div>
                     <h3 className="text-2xl font-bold text-gray-800 mb-4">Korábbi meghívók</h3>
                     {invitations.length > 0 ? (
                        <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-4 font-semibold">Státusz</th>
                                        <th className="p-4 font-semibold">Meghívott neve</th>
                                        <th className="p-4 font-semibold hidden md:table-cell">Egység / Pozíció</th>
                                        <th className="p-4 font-semibold hidden sm:table-cell">Létrehozva</th>
                                        <th className="p-4 font-semibold">Link</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invitations.map(invite => (
                                        <tr key={invite.id} className="border-b last:border-0">
                                            <td className="p-4"><span className={`px-2 py-1 text-xs font-bold rounded-full ${invite.status === 'active' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-600'}`}>{invite.status}</span></td>
                                            <td className="p-4 font-medium">{`${invite.prefilledLastName || ''} ${invite.prefilledFirstName || ''}`.trim() || <span className="text-gray-400 italic">Nincs megadva</span>}</td>
                                            <td className="p-4 hidden md:table-cell">{getUnitName(invite.unitId)} / {invite.position}</td>
                                            <td className="p-4 text-sm text-gray-500 hidden sm:table-cell">{invite.createdAt?.toDate().toLocaleDateString('hu-HU')}</td>
                                            <td className="p-4">
                                                {invite.status === 'active' ? (
                                                    <button onClick={() => handleCopy(invite.code)} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-sm">
                                                        <CopyIcon className="h-4 w-4" />
                                                        {copiedCode === invite.code ? 'Másolva!' : 'Másolás'}
                                                    </button>
                                                ) : <span className="text-sm text-gray-400">Felhasználva</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                     ) : (
                         <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-xl">
                            <InvitationIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700">Nincsenek meghívók</h3>
                            <p className="text-gray-500 mt-1">Még nem generáltál meghívó linket.</p>
                        </div>
                     )}
                </div>
            )}
        </div>
    );
};

export default MeghivokApp;