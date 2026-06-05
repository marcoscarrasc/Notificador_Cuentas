import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const BILLS_FILE = path.join(DATA_DIR, 'bills.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory and files exist
async function initDb() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    try {
      await fs.access(BILLS_FILE);
    } catch {
      await fs.writeFile(BILLS_FILE, JSON.stringify([], null, 2));
    }

    try {
      await fs.access(SETTINGS_FILE);
    } catch {
      const defaultSettings = {
        notificationTime: '09:00',
        notifyOnDueDate: true,
        notifyDaysBefore: 1,
        currency: 'S/.',
        defaultPhoneNumber: '51922100353',
        messageTemplate: '¡Hola! 🔔 Te recordamos que tu cuenta de *{name}* por un monto de *{currency}{amount}* vence el *{dueDate}*. Por favor, realiza tu pago a tiempo.'
      };
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
    }
  } catch (err) {
    console.error('Error al inicializar la base de datos:', err);
  }
}

// Read Bills
export async function getBills() {
  await initDb();
  try {
    const data = await fs.readFile(BILLS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error al leer las cuentas:', err);
    return [];
  }
}

// Save Bills
export async function saveBills(bills) {
  await initDb();
  try {
    await fs.writeFile(BILLS_FILE, JSON.stringify(bills, null, 2));
    return true;
  } catch (err) {
    console.error('Error al guardar las cuentas:', err);
    return false;
  }
}

// Read Settings
export async function getSettings() {
  await initDb();
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error al leer la configuración:', err);
    return {};
  }
}

// Save Settings
export async function saveSettings(settings) {
  await initDb();
  try {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return true;
  } catch (err) {
    console.error('Error al guardar la configuración:', err);
    return false;
  }
}

// Initial initialization check
initDb().catch(console.error);
