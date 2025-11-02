import React, { useState, useEffect } from 'react';
import { RolePermissions, Permissions, User } from '../../data/mockData';
import { db } from '../../firebase/config';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import LoadingSpinner from '../LoadingSpinner';
import ShieldIcon from '../icons/ShieldIcon';

interface JogosultsagokAppProps {
    currentUser: User;
    allPermissions: RolePermissions;
    unitPermissions: Record<string, any>;
    activeUnitId: string | null;
}

const permissionLabels: Record<keyof Permissions, string> = {
    canAddBookings: "Új foglalások hozzáadása",
    canManageSchedules: "Beosztás szerkesztése",
    canManageUsers: "Felhasználók kezelése (meghívás, szerkesztés)",
    canGenerateInvites: "Meghívók generálása",
    canManageLeaveRequests: "Szabadságkérelmek elbírálása",
    canSubmitLeaveRequests: "Szabadságkérelmek benyújtása",
    canManageTodos: "Csapat teendőlista kezelése",
    canManageContacts: "Névjegyek kezelése",
    canViewAllContacts: "Összes (rejtett) névjegy megtekintése",
    canManageUnits: "Üzletek kezelése",
    canManagePositions: "Pozíciók kezelése",
    canCreatePolls: "Szavazások létrehozása",
};

const GLOBAL_ROLES_TO_CONFIGURE: User['role'][] = ['Unit Admin', 'Unit Leader', 'User', 'Guest'];
const UNIT_ROLES_TO_CONFIGURE: User['role'][] = ['Unit Leader', 'User', 'Guest'];

const DEFAULT_PERMISSIONS: RolePermissions = {
    'Admin': {
        canAddBookings: true, canManageSchedules: true, canManageUsers: true, canGenerateInvites: true,
        canManageLeaveRequests: true, canSubmitLeaveRequests: true, canManageTodos: true,
        canManageContacts: true, canViewAllContacts: true, canManageUnits: true, canManagePositions: true, canCreatePolls: true,
    },
    'Unit Admin': {
        canAddBookings: true, canManageSchedules: true, canManageUsers: true, canGenerateInvites: true,
        canManageLeaveRequests: true, canSubmitLeaveRequests: true, canManageTodos: true,
        canManageContacts: false, canViewAllContacts: false, canManageUnits: false, canManagePositions: false, canCreatePolls: true,
    },
    'Unit Leader': {
        canAddBookings: false, canManageSchedules: true, canManageUsers: false, canGenerateInvites: false,
        canManageLeaveRequests: false, canSubmitLeaveRequests: true, canManageTodos: true,
        canManageContacts: false, canViewAllContacts: false, canManageUnits: false, canManagePositions: false, canCreatePolls: false,
    },
    'User': {
        canAddBookings: false, canManageSchedules: false, canManageUsers: false, canGenerateInvites: false,
        canManageLeaveRequests: false, canSubmitLeaveRequests: true, canManageTodos: true,
        canManageContacts: false, canViewAllContacts: false, canManageUnits: false, canManagePositions: false, canCreatePolls: false,
    },
    'Guest': {
        canAddBookings: false, canManageSchedules: false, canManageUsers: false, canGenerateInvites: false,
        canManageLeaveRequests: false, canSubmitLeaveRequests: false, canManageTodos: false,
        canManageContacts: false, canViewAllContacts: false, canManageUnits: false, canManagePositions: false, canCreatePolls: false,
    },
};

const JogosultsagokApp: React.FC<JogosultsagokAppProps> = ({ currentUser, allPermissions, unitPermissions, activeUnitId }) => {
    const isSuperAdmin = currentUser.role === 'Admin';
    
    if (!isSuperAdmin && !activeUnitId) {
         return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold text-gray-700">Nincs egység kiválasztva</h2>
                <p className="mt-2 text-gray-600">Kérlek, válassz egy egységet a jogosultságok szerkesztéséhez.</p>
            </div>
        );
    }

    const [localPermissions, setLocalPermissions] = useState<RolePermissions>({});
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const rolesToConfigure = isSuperAdmin ? GLOBAL_ROLES_TO_CONFIGURE : UNIT_ROLES_TO_CONFIGURE;

    useEffect(() => {
        const mergedPermissions: RolePermissions = {};
        const source = isSuperAdmin ? allPermissions : (activeUnitId ? unitPermissions[activeUnitId]?.roles : {});
        
        rolesToConfigure.forEach(role => {
            mergedPermissions[role] = {
                ...DEFAULT_PERMISSIONS[role],
                ...(source?.[role] || {}),
            };
        });
        setLocalPermissions(mergedPermissions);
    }, [allPermissions, unitPermissions, activeUnitId, isSuperAdmin, rolesToConfigure]);

    const handlePermissionChange = (role: User['role'], permission: keyof Permissions, value: boolean) => {
        setLocalPermissions(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [permission]: value,
            },
        }));
    };

    const handleSaveChanges = async (role: User['role']) => {
        setIsLoading(true);
        setSuccessMessage('');
        try {
            const permissionsToSave = localPermissions[role] || {};
            if (isSuperAdmin) {
                await setDoc(doc(db, 'permissions', role), permissionsToSave);
            } else if(activeUnitId) {
                const unitPermsRef = doc(db, 'unit_permissions', activeUnitId);
                const docSnap = await getDoc(unitPermsRef);
                if (docSnap.exists()) {
                    await updateDoc(unitPermsRef, { [`roles.${role}`]: permissionsToSave });
                } else {
                    await setDoc(unitPermsRef, { roles: { [role]: permissionsToSave } });
                }
            }
            setSuccessMessage(`"${role}" szerepkör jogosultságai sikeresen mentve!`);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error("Error saving permissions:", error);
            alert("Hiba történt a mentés során.");
        } finally {
            setIsLoading(false);
        }
    };

    const renderPermissionToggles = (role: User['role']) => {
        const permissionsForRole = localPermissions[role] || {};
        
        return (
            <div className="space-y-3">
                {Object.entries(permissionLabels).map(([key, label]) => {
                    if (!isSuperAdmin && (key === 'canManageUnits' || key === 'canManagePositions')) {
                        return null;
                    }
                    return (
                        <label key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                            <span className="text-gray-700 font-medium">{label}</span>
                            <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                <input
                                    type="checkbox"
                                    name={key}
                                    id={`${role}-${key}`}
                                    checked={permissionsForRole[key as keyof Permissions] || false}
                                    onChange={(e) => handlePermissionChange(role, key as keyof Permissions, e.target.checked)}
                                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                />
                                <span className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></span>
                            </div>
                        </label>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8">
             <style>{`
                .toggle-checkbox:checked { right: 0; border-color: #16a34a; }
                .toggle-checkbox:checked + .toggle-label { background-color: #16a34a; }
            `}</style>
            <div className="flex items-center mb-6">
                 <ShieldIcon className="h-10 w-10 text-green-700 mr-4"/>
                 <div>
                    <h1 className="text-3xl font-bold text-gray-800">Jogosultságok Kezelése</h1>
                    <p className="text-gray-600">
                        {isSuperAdmin ? 'Globális jogosultságok beállítása az egyes szerepkörökhöz.' : `Jogosultságok beállítása az aktív egységhez.`}
                    </p>
                 </div>
            </div>
            {successMessage && <div className="mb-4 p-3 bg-green-100 text-green-800 font-semibold rounded-lg">{successMessage}</div>}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {rolesToConfigure.map(role => (
                    <div key={role} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">{role}</h2>
                        <div className="flex-grow">
                            {renderPermissionToggles(role)}
                        </div>
                        <button
                            onClick={() => handleSaveChanges(role)}
                            disabled={isLoading}
                            className="mt-6 w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                        >
                            {isLoading ? 'Mentés...' : 'Mentés'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default JogosultsagokApp;