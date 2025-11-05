// src/core/api/emailService.ts
import { emailProviderConfig } from '../config/emailConfig';
import { User, Booking, Unit } from '../models/data';

// 1. Standardized types
export type EmailMessageType =
  | "registration_confirmation"
  | "guest_reservation_confirmation"
  | "unit_new_reservation_notification"
  | "schedule_published_notification";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  messageType: EmailMessageType;
  locale?: "hu" | "en";
  meta?: Record<string, unknown>; // Optional extra data for logging
}

// 2. Internal provider function (mock implementation)
const sendViaMockProvider = async (params: SendEmailParams): Promise<void> => {
  const { to, subject, html, messageType, meta, locale } = params;
  
  console.groupCollapsed(`📧 Mock Email Sent: [${messageType}]`);
  console.log(`To:`, to);
  console.log(`Subject:`, subject);
  console.log(`Locale:`, locale || 'N/A');
  if (meta) {
    console.log(`Metadata:`, meta);
  }
  console.log(`HTML Body (first 100 chars):`, html.substring(0, 100) + '...');
  // To inspect the full body, you can uncomment the next line
  // console.log('Full HTML Body:', html);
  console.groupEnd();
  
  // Simulate a short network delay
  await new Promise(resolve => setTimeout(resolve, 100));
};

// Internal router for different providers
const sendViaProvider = async (params: SendEmailParams): Promise<void> => {
    switch (emailProviderConfig.provider) {
        case "mock":
            return sendViaMockProvider(params);
        // case "resend":
        //   return sendViaResend(params); // Future implementation
        default:
            console.error(`Unknown email provider configured: ${emailProviderConfig.provider}`);
            // Silently fail, as per requirements
            return;
    }
};


// 3. Public API function with error handling
export const sendEmail = async (params: SendEmailParams): Promise<void> => {
  try {
    await sendViaProvider(params);
  } catch (error) {
    console.error(`[emailService] Failed to send email of type "${params.messageType}". This error did not stop the application flow.`, {
      params,
      error,
    });
  }
};


// --- TEMPLATE GENERATORS ---
// These functions now just create the SendEmailParams object for the main sendEmail function.

export const createRegistrationEmail = (user: User): SendEmailParams => {
  const subject = "Sikeres regisztráció a MintLeaf rendszerben";
  const html = `
    <h1>Üdv a MintLeaf csapatában, ${user.firstName}!</h1>
    <p>A regisztrációd sikeres volt. Mostantól be tudsz jelentkezni a fiókodba.</p>
    <p><strong>Felhasználónév:</strong> ${user.name}</p>
    <p><strong>Szerepkör:</strong> ${user.role}</p>
    <p>A rendszerbe a következő linken tudsz belépni:</p>
    <a href="${window.location.origin}">Bejelentkezés</a>
    <br><br>
    <p>Üdvözlettel,<br>A MintLeaf Csapata</p>
  `;
  return {
    to: user.email,
    subject,
    html,
    messageType: 'registration_confirmation',
    meta: { userId: user.id }
  };
};

export const createGuestReservationConfirmationEmail = (reservation: Booking, unit: Unit): SendEmailParams | null => {
    if (!reservation.contact?.email) return null;

    const subject = `Foglalásod beérkezett - ${unit.name}`;
    const startTime = reservation.startTime.toDate().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    const date = reservation.startTime.toDate().toLocaleDateString('hu-HU');

    const html = `
        <h1>Kedves ${reservation.name}!</h1>
        <p>Köszönjük, hogy a(z) <strong>${unit.name}</strong> éttermet választottad. Foglalási kérésedet megkaptuk, hamarosan felvesszük veled a kapcsolatot a megerősítéssel.</p>
        <h3>Foglalásod részletei:</h3>
        <ul>
            <li><strong>Dátum:</strong> ${date}</li>
            <li><strong>Időpont:</strong> ${startTime}</li>
            <li><strong>Létszám:</strong> ${reservation.headcount} fő</li>
            <li><strong>Alkalom:</strong> ${reservation.occasion}</li>
            <li><strong>Azonosító:</strong> ${reservation.referenceCode}</li>
        </ul>
        <p>A foglalás lemondásához vagy módosításához kérjük, vedd fel velünk a kapcsolatot.</p>
        <br>
        <p>Üdvözlettel,<br>A(z) ${unit.name} csapata</p>
    `;
    return {
        to: reservation.contact.email,
        subject,
        html,
        messageType: 'guest_reservation_confirmation',
        locale: reservation.locale || 'hu',
        meta: { reservationId: reservation.id, unitId: unit.id }
    };
};

export const createUnitNewReservationNotificationEmail = (reservation: Booking, unit: Unit, recipientEmails: string[]): SendEmailParams => {
    const subject = `Új foglalás érkezett - ${unit.name}`;
    const startTime = reservation.startTime.toDate().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    const date = reservation.startTime.toDate().toLocaleDateString('hu-HU');

    const html = `
        <h1>Új foglalás érkezett a(z) ${unit.name} részére</h1>
        <h3>Részletek:</h3>
        <ul>
            <li><strong>Név:</strong> ${reservation.name}</li>
            <li><strong>Dátum:</strong> ${date}</li>
            <li><strong>Időpont:</strong> ${startTime}</li>
            <li><strong>Létszám:</strong> ${reservation.headcount} fő</li>
            <li><strong>Telefonszám:</strong> ${reservation.contact?.phoneE164 || 'N/A'}</li>
            <li><strong>Email:</strong> ${reservation.contact?.email || 'N/A'}</li>
            ${reservation.notes ? `<li><strong>Megjegyzés:</strong> ${reservation.notes}</li>` : ''}
        </ul>
        <p>A foglalás részletei a MintLeaf admin felületén is elérhetőek.</p>
    `;
    return {
        to: recipientEmails,
        subject,
        html,
        messageType: 'unit_new_reservation_notification',
        meta: { reservationId: reservation.id, unitId: unit.id }
    };
};


export const createNewScheduleNotificationEmail = (user: User, weekLabel: string): SendEmailParams => {
    const subject = `Új beosztásod elérhető a(z) ${weekLabel} hétre`;
    const html = `
        <h1>Szia ${user.firstName},</h1>
        <p>A(z) <strong>${weekLabel}</strong> hétre vonatkozó új beosztásodat publikálták.</p>
        <p>A részleteket megtekintheted a MintLeaf alkalmazásban bejelentkezés után.</p>
        <a href="${window.location.origin}">Beosztás megtekintése</a>
        <br><br>
        <p>Üdvözlettel,<br>A MintLeaf Csapata</p>
    `;
    return {
        to: user.email,
        subject,
        html,
        messageType: 'schedule_published_notification',
        meta: { userId: user.id, week: weekLabel }
    };
};
