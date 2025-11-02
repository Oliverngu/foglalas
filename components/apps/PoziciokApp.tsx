import React, { useState, useEffect } from 'react';
import { Position, User } from '../../data/mockData';
import { db } from '../../firebase/config';
import { collection, onSnapshot, orderBy, query, addDoc, deleteDoc, doc } from 'firebase/firestore';
import LoadingSpinner from '../LoadingSpinner';
import BriefcaseIcon from '../icons/BriefcaseIcon';
import TrashIcon from '../icons/TrashIcon';

const PoziciokApp: React.FC = () => {
    const [positions, setPositions] = useState<Position[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newPositionName, setNewPositionName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setLoading(true);
        const positionsQuery = query(collection(db, 'positions'), orderBy('name'));
        const unsubscribePositions = onSnapshot(positionsQuery, snapshot => {
            const fetchedPositions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Position));
            setPositions(fetchedPositions);
            setLoading(false);
        }, err => {
            console.error("Error fetching positions:", err);
            setError("Hiba a pozíciók betöltése közben.");
            setLoading(false);
        });
        
        // Fetch all users to check for dependencies on delete
        const unsubscribeUsers = onSnapshot(collection(db, 'users'), snapshot => {
            const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setUsers(fetchedUsers);
        });

        return () => {
            unsubscribePositions();
            unsubscribeUsers();
        };
    }, []);

    const handleAddPosition = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newPositionName.trim();
        if (trimmedName === '') return;
        
        if (positions.some(pos => pos.name.toLowerCase() === trimmedName.toLowerCase())) {
            alert('Már létezik pozíció ezzel a névvel.');
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'positions'), { name: trimmedName });
            setNewPositionName('');
        } catch (err) {
            console.error("Error adding position:", err);
            alert("Hiba történt az új pozíció hozzáadása közben.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePosition = async (positionId: string, positionName: string) => {
        const usersInPosition = users.filter(user => user.position === positionName).length;
        
        let confirmationMessage = `Biztosan törölni szeretnéd a(z) "${positionName}" pozíciót?`;
        if (usersInPosition > 0) {
            confirmationMessage = `Figyelem! ${usersInPosition} felhasználó ehhez a pozícióhoz tartozik. Ha törlöd, a felhasználókat manuálisan kell majd egy másikhoz rendelned a "Felhasználók" menüpontban. Biztosan folytatod a törlést?`;
        }

        if (window.confirm(confirmationMessage)) {
            try {
                await deleteDoc(doc(db, 'positions', positionId));
            } catch (err) {
                console.error("Error deleting position:", err);
                alert("Hiba történt a pozíció törlése közben.");
            }
        }
    };


    return (
        <div className="p-4 md:p-8">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 mb-8 max-w-2xl mx-auto">
                <h2 className="text-xl font-bold text-gray-800 mb-2">Új pozíció hozzáadása</h2>
                <p className="text-gray-600 mb-4 text-sm">Az itt létrehozott pozíciók kiválaszthatók lesznek a meghívók generálásakor és a felhasználók szerkesztésénél. Ez biztosítja az egységes kategóriákat.</p>
                <form onSubmit={handleAddPosition} className="flex items-center gap-3">
                    <input
                        type="text"
                        value={newPositionName}
                        onChange={(e) => setNewPositionName(e.target.value)}
                        placeholder="Új pozíció neve (pl. Pincér)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition"
                        disabled={isSubmitting}
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting || newPositionName.trim() === ''}
                        className="bg-green-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSubmitting ? 'Mentés...' : 'Hozzáadás'}
                    </button>
                </form>
            </div>

            {loading && <div className="relative h-64"><LoadingSpinner /></div>}
            {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-r-lg" role="alert"><p className="font-bold">Hiba történt</p><p>{error}</p></div>}
      
            {!loading && !error && (
                 <div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Meglévő pozíciók</h3>
                     {positions.length > 0 ? (
                        <div className="space-y-3 max-w-2xl mx-auto">
                            {positions.map(pos => {
                                const userCount = users.filter(u => u.position === pos.name).length;
                                return (
                                    <div key={pos.id} className="bg-white p-4 rounded-xl shadow-md border flex items-center justify-between">
                                        <div className="flex items-center">
                                             <div className="p-3 bg-gray-100 rounded-lg mr-4">
                                                <BriefcaseIcon className="h-6 w-6 text-gray-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800 text-lg">{pos.name}</p>
                                                <p className="text-sm text-gray-500">{userCount} felhasználó</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeletePosition(pos.id, pos.name)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                            aria-label={`${pos.name} törlése`}
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                     ) : (
                        <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-xl max-w-2xl mx-auto">
                            <BriefcaseIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700">Nincsenek pozíciók</h3>
                            <p className="text-gray-500 mt-1">Még nem hoztál létre egyetlen pozíciót sem.</p>
                        </div>
                     )}
                 </div>
            )}
        </div>
    );
};

export default PoziciokApp;