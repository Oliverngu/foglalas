import React, { useState, useEffect, useMemo } from 'react';
import { User, Unit, Position } from '../../data/mockData';
import { db, serverTimestamp } from '../../firebase/config';
import { collection, doc, onSnapshot, query, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import LoadingSpinner from '../LoadingSpinner';
import UsersIcon from '../icons/UsersIcon';
import SearchIcon from '../icons/SearchIcon';
import InvitationIcon from '../icons/InvitationIcon';
import AddUserModal from './AddUserModal';
import UserPlusIcon from '../icons/UserPlusIcon';
import TrashIcon from '../icons/TrashIcon';


// Invite User Modal
const InviteUserModal: React.FC<{
    units: Unit[];
    positions: Position[];
    onClose: () => void;
    currentUser: User;
}> = ({ units, positions, onClose, currentUser }) => {
    const isUnitAdmin = currentUser.role === 'Unit Admin';
    const [role, setRole] = useState<User['role']>('User');
    const [unitId, setUnitId] = useState(isUnitAdmin ? currentUser.unitIds?.[0] || '' : '');
    const [position, setPosition] = useState('');
    const [prefilledLastName, setPrefilledLastName] = useState('');
    const [prefilledFirstName, setPrefilledFirstName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const generateInviteCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let code = '';
        for (let i = 0; i < 16; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!unitId || !position) {
            alert("Kérlek, válassz egységet és pozíciót is.");
            return;
        }
        setIsSubmitting(true);
        const code = generateInviteCode();
        
        const newInvite: any = {
            code, 
            role,
            unitId, 
            position,
            status: 'active',
            createdAt: serverTimestamp(),
        };
        if (prefilledLastName.trim()) {
            newInvite.prefilledLastName = prefilledLastName.trim();
        }
         if (prefilledFirstName.trim()) {
            newInvite.prefilledFirstName = prefilledFirstName.trim();
        }

        try {
            await setDoc(doc(db, 'invitations', code), newInvite);
            const url = `${window.location.origin}?register=${code}`;
            setGeneratedLink(url);
        } catch (err) {
            console.error("Error creating invitation:", err);
            alert("Hiba történt a meghívó létrehozásakor.");
            setIsSubmitting(false);
        }
    };

    const handleCopy = () => {
        if (!generatedLink) return;
        navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                {generatedLink ? (
                    <div className="p-6 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <InvitationIcon className="h-8 w-8 text-green-700" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Meghívó sikeresen létrehozva!</h2>
                        <p className="text-gray-600 mt-2 mb-4">Másold ki a lenti linket és küldd el az új felhasználónak a regisztrációhoz.</p>
                        <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg border">
                           <input type="text" value={generatedLink} readOnly className="w-full bg-transparent text-sm text-gray-700 focus:outline-none"/>
                           <button onClick={handleCopy} className="bg-blue-600 text-white font-semibold text-sm px-3 py-1.5 rounded-md hover:bg-blue-700 whitespace-nowrap">
                                {copied ? 'Másolva!' : 'Másolás'}
                           </button>
                        </div>
                         <button onClick={onClose} className="mt-6 bg-gray-200 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300">Bezárás</button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="p-5 border-b">
                            <h2 className="text-xl font-bold text-gray-800">Új felhasználó meghívása</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-medium">Név (opcionális)</label>
                                 <div className="flex gap-4 mt-1">
                                    <input 
                                        type="text"
                                        value={prefilledLastName}
                                        onChange={(e) => setPrefilledLastName(e.target.value)}
                                        placeholder="Vezetéknév"
                                        className="w-full p-2 border rounded-lg bg-white"
                                    />
                                     <input 
                                        type="text"
                                        value={prefilledFirstName}
                                        onChange={(e) => setPrefilledFirstName(e.target.value)}
                                        placeholder="Keresztnév"
                                        className="w-full p-2 border rounded-lg bg-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Szerepkör</label>
                                <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full mt-1 p-2 border rounded-lg bg-white">
                                    <option value="User">User</option>
                                    <option value="Unit Leader">Unit Leader</option>
                                    <option value="Guest">Guest (Vendég)</option>
                                    {currentUser.role === 'Admin' && <option value="Unit Admin">Unit Admin</option>}
                                    {currentUser.role === 'Admin' && <option value="Admin">Admin (Super Admin)</option>}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Egység</label>
                                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white" required disabled={isUnitAdmin}>
                                    <option value="" disabled>Válassz egységet</option>
                                    {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                                </select>
                            </div>
                            <div><label className="text-sm font-medium">Pozíció</label><select value={position} onChange={(e) => setPosition(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white" required><option value="" disabled>Válassz pozíciót</option>{positions.map(pos => <option key={pos.id} value={pos.name}>{pos.name}</option>)}</select></div>
                        </div>
                        <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                            <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg font-semibold">Mégse</button>
                            <button type="submit" disabled={isSubmitting} className="bg-green-700 text-white px-4 py-2 rounded-lg font-semibold disabled:bg-gray-400">{isSubmitting ? 'Generálás...' : 'Meghívó generálása'}</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};


// Edit User Modal
const EditUserModal: React.FC<{
    user: User;
    units: Unit[];
    positions: Position[];
    onClose: () => void;
    onSave: (userId: string, updates: Partial<User>) => Promise<void>;
    currentUser: User;
}> = ({ user, units, positions, onClose, onSave, currentUser }) => {
    const [formData, setFormData] = useState({
        lastName: user.lastName,
        firstName: user.firstName,
        name: user.name,
        role: user.role,
        unitIds: user.unitIds || [],
        position: user.position || '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUnitChange = (unitId: string) => {
        setFormData(prev => {
            const newUnitIds = prev.unitIds.includes(unitId)
                ? prev.unitIds.filter(id => id !== unitId)
                : [...prev.unitIds, unitId];
            return { ...prev, unitIds: newUnitIds };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const updates = {
            ...formData,
            fullName: `${formData.lastName} ${formData.firstName}`.trim(),
        };
        await onSave(user.id, updates);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-5 border-b">
                        <h2 className="text-xl font-bold text-gray-800">Felhasználó szerkesztése</h2>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div className="flex gap-4">
                             <div className="w-1/2">
                                <label className="text-sm font-medium">Vezetéknév</label>
                                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full mt-1 p-2 border rounded-lg" required />
                            </div>
                            <div className="w-1/2">
                                <label className="text-sm font-medium">Keresztnév</label>
                                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full mt-1 p-2 border rounded-lg" required />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Felhasználónév</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full mt-1 p-2 border rounded-lg" required />
                        </div>
                         <div>
                            <label className="text-sm font-medium">Email</label>
                            <input type="email" value={user.email && !user.email.endsWith('@noemail.provided') ? user.email : 'Nincs megadva'} className="w-full mt-1 p-2 border rounded-lg bg-gray-100" readOnly disabled />
                            <p className="text-xs text-gray-500 mt-1">Az email címet csak a felhasználó módosíthatja a saját beállításainál.</p>
                        </div>
                         <div>
                            <label className="text-sm font-medium">Szerepkör</label>
                            <select name="role" value={formData.role} onChange={handleChange} className="w-full mt-1 p-2 border rounded-lg bg-white" disabled={currentUser.role !== 'Admin'}>
                                <option value="User">User</option>
                                <option value="Unit Leader">Unit Leader</option>
                                <option value="Guest">Guest (Vendég)</option>
                                <option value="Unit Admin">Unit Admin</option>
                                {currentUser.role === 'Admin' && <option value="Admin">Admin (Super Admin)</option>}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Egységek</label>
                            <div className="mt-2 space-y-2 border p-3 rounded-lg max-h-40 overflow-y-auto">
                                {units.map(unit => (
                                    <label key={unit.id} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={formData.unitIds.includes(unit.id)}
                                            onChange={() => handleUnitChange(unit.id)}
                                            className="h-4 w-4 rounded text-green-600 focus:ring-green-500"
                                            disabled={currentUser.role !== 'Admin' && currentUser.role !== 'Unit Admin'}
                                        />
                                        <span className="ml-2 text-gray-700">{unit.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                         <div>
                            <label className="text-sm font-medium">Pozíció</label>
                            <select name="position" value={formData.position} onChange={handleChange} className="w-full mt-1 p-2 border rounded-lg bg-white">
                                <option value="">Nincs hozzárendelve</option>
                                {positions.map(pos => <option key={pos.id} value={pos.name}>{pos.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                        <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg font-semibold">Mégse</button>
                        <button type="submit" disabled={isSubmitting} className="bg-green-700 text-white px-4 py-2 rounded-lg font-semibold disabled:bg-gray-400">{isSubmitting ? 'Mentés...' : 'Mentés'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const FelhasznalokApp: React.FC<{currentUser: User, canGenerateInvites: boolean}> = ({currentUser, canGenerateInvites}) => {
    const [users, setUsers] = useState<User[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    
    const isSuperAdmin = currentUser.role === 'Admin';

    useEffect(() => {
        const usersQueryRef = collection(db, 'users');

        const unsubscribeUsers = onSnapshot(usersQueryRef, snapshot => {
            const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            
            const adminUnits = new Set(currentUser.unitIds || []);
            const visibleUsers = isSuperAdmin 
                ? fetchedUsers 
                : fetchedUsers.filter(u => {
                    if (!u.unitIds || u.unitIds.length === 0) return true; // Show unassigned
                    return u.unitIds.some(userUnitId => adminUnits.has(userUnitId));
                  });

            setUsers(visibleUsers.sort((a,b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)));
            setLoading(false);
        }, err => {
            setError("Hiba a felhasználók betöltésekor.");
            setLoading(false);
        });
        
        const unsubscribeUnits = onSnapshot(collection(db, 'units'), snapshot => {
            setUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
        });

        const unsubscribePositions = onSnapshot(collection(db, 'positions'), snapshot => {
            setPositions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Position)));
        });

        return () => {
            unsubscribeUsers();
            unsubscribeUnits();
            unsubscribePositions();
        };
    }, [isSuperAdmin, currentUser.unitIds]);

    const handleSaveUser = async (userId: string, updates: Partial<User>) => {
        try {
            await updateDoc(doc(db, 'users', userId), updates);
        } catch (err) {
            console.error("Error updating user:", err);
            alert("Hiba történt a felhasználó frissítésekor.");
        }
    };

    const handleDeleteUser = async (userToDelete: User) => {
        if (userToDelete.id === currentUser.id) {
            alert("Saját magadat nem törölheted.");
            return;
        }

        if (window.confirm(`Biztosan törölni szeretnéd ${userToDelete.lastName} ${userToDelete.firstName} felhasználót? Ez a művelet nem vonható vissza, és a felhasználó minden adata elvész.`)) {
            try {
                await deleteDoc(doc(db, 'users', userToDelete.id));
                console.warn(`User ${userToDelete.id} deleted from Firestore. Auth user must be deleted from the backend.`);
            } catch (err) {
                console.error("Error deleting user:", err);
                alert("Hiba történt a felhasználó törlése során.");
            }
        }
    };

    const getUnitNames = (unitIds?: string[]) => {
        if (!unitIds || unitIds.length === 0) return 'N/A';
        return unitIds.map(id => units.find(u => u.id === id)?.name || 'Ismeretlen').join(', ');
    };


    const filteredUsers = useMemo(() => {
        if (!searchTerm) {
            return users;
        }
        const lowercasedFilter = searchTerm.toLowerCase();
        return users.filter(user =>
            `${user.lastName} ${user.firstName}`.toLowerCase().includes(lowercasedFilter) ||
            user.name.toLowerCase().includes(lowercasedFilter)
        );
    }, [users, searchTerm]);
    
    const getRoleStyle = (role: User['role']) => {
        switch(role) {
            case 'Admin': return 'bg-red-100 text-red-800';
            case 'Unit Admin': return 'bg-green-100 text-green-800';
            case 'Unit Leader': return 'bg-yellow-100 text-yellow-800';
            case 'User': return 'bg-blue-100 text-blue-800';
            case 'Guest': return 'bg-gray-200 text-gray-800';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="p-4 md:p-8">
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Felhasználók Kezelése</h1>
                <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative w-full sm:w-64">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Keresés név alapján..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                    </div>
                    {isSuperAdmin && (
                        <button onClick={() => setIsAddUserModalOpen(true)} className="w-full sm:w-auto bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                            <UserPlusIcon className="h-5 w-5" />
                            Új felhasználó
                        </button>
                    )}
                    {canGenerateInvites && (
                        <button onClick={() => setIsInviteModalOpen(true)} className="w-full sm:w-auto bg-green-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-800 flex items-center justify-center gap-2">
                            <InvitationIcon className="h-5 w-5" />
                            Új meghívó
                        </button>
                    )}
                </div>
            </div>

            {loading && <div className="relative h-64"><LoadingSpinner /></div>}
            {error && <p className="text-red-500">{error}</p>}
            
            {!loading && !error && (
                <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-4 font-semibold">Név</th>
                                    <th className="p-4 font-semibold hidden md:table-cell">Email</th>
                                    <th className="p-4 font-semibold">Szerepkör</th>
                                    <th className="p-4 font-semibold hidden sm:table-cell">Egység(ek)</th>
                                    <th className="p-4 font-semibold hidden sm:table-cell">Pozíció</th>
                                    <th className="p-4 font-semibold">Műveletek</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => (
                                    <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50">
                                        <td className="p-4">
                                            <p className="font-bold text-gray-800">{`${user.lastName} ${user.firstName}`}</p>
                                            <p className="text-sm text-gray-500">@{user.name}</p>
                                        </td>
                                        <td className="p-4 text-gray-600 hidden md:table-cell">                                            
                                            {user.email && !user.email.endsWith('@noemail.provided')
                                                ? user.email
                                                : <span className="text-gray-400 italic">Nincs megadva</span>}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${getRoleStyle(user.role)}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-600 hidden sm:table-cell">{getUnitNames(user.unitIds)}</td>
                                        <td className="p-4 text-gray-600 hidden sm:table-cell">{user.position || 'N/A'}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setEditingUser(user)} className="font-semibold text-blue-600 hover:text-blue-800">Szerkesztés</button>
                                                {isSuperAdmin && (
                                                    <button 
                                                        onClick={() => handleDeleteUser(user)} 
                                                        disabled={user.id === currentUser.id}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title={user.id === currentUser.id ? "Saját magad nem törölheted" : "Felhasználó törlése"}
                                                    >
                                                        <TrashIcon className="h-5 w-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     {filteredUsers.length === 0 && (
                        <div className="text-center py-16">
                            <UsersIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700">{searchTerm ? 'Nincs találat' : 'Nincsenek felhasználók'}</h3>
                            <p className="text-gray-500 mt-1">{searchTerm ? 'Próbálj meg más keresési feltételt.' : 'Még senki sem regisztrált.'}</p>
                        </div>
                    )}
                </div>
            )}
            
            {editingUser && (
                <EditUserModal 
                    user={editingUser}
                    units={units}
                    positions={positions}
                    onClose={() => setEditingUser(null)}
                    onSave={handleSaveUser}
                    currentUser={currentUser}
                />
            )}

             {isInviteModalOpen && (
                <InviteUserModal 
                    units={units}
                    positions={positions}
                    onClose={() => setIsInviteModalOpen(false)}
                    currentUser={currentUser}
                />
            )}
            {isAddUserModalOpen && (
                <AddUserModal
                    units={units}
                    positions={positions}
                    onClose={() => setIsAddUserModalOpen(false)}
                />
            )}
        </div>
    );
};

export default FelhasznalokApp;