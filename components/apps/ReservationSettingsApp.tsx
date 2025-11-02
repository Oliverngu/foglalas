import React from 'react';
import CalendarOffIcon from '../icons/CalendarOffIcon';

const ReservationSettingsApp: React.FC = () => {
    return (
        <div className="p-8 text-center bg-white rounded-2xl shadow-lg border border-gray-100">
            <CalendarOffIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-700">A beállítások átkerültek</h2>
            <p className="mt-2 text-gray-600">
                A foglalási beállításokat, beleértve a blackout napokat is, mostantól a 'Foglalások' menüponton belül,
                a vendégoldalra navigálva, a fogaskerék ikonra kattintva lehet kezelni.
            </p>
        </div>
    );
};

export default ReservationSettingsApp;