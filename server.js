import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode';
import cron from 'node-cron';
import { getBills, saveBills, getSettings, saveSettings } from './database.js';

const { Client, LocalAuth } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// WhatsApp Client State
let clientStatus = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, QR_RECEIVED, CONNECTED, ERROR
let qrCodeBase64 = '';
let connectionInfo = null;
let client = null;

// Initialize WhatsApp Client
function initWhatsApp() {
  clientStatus = 'CONNECTING';
  qrCodeBase64 = '';
  connectionInfo = null;

  console.log('Inicializando cliente de WhatsApp...');

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '.wwebjs_auth')
    }),
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36'
      ]
    }
  });

  client.on('qr', async (qr) => {
    console.log('Código QR recibido, convirtiendo a base64...');
    clientStatus = 'QR_RECEIVED';
    try {
      qrCodeBase64 = await qrcode.toDataURL(qr);
    } catch (err) {
      console.error('Error al generar código QR base64:', err);
    }
  });

  client.on('ready', () => {
    console.log('¡El cliente de WhatsApp está listo!');
    clientStatus = 'CONNECTED';
    qrCodeBase64 = '';
    connectionInfo = {
      pushname: client.info.pushname,
      wid: client.info.wid.user
    };
  });

  client.on('authenticated', () => {
    console.log('WhatsApp autenticado.');
  });

  client.on('auth_failure', (msg) => {
    console.error('Fallo de autenticación de WhatsApp:', msg);
    clientStatus = 'ERROR';
    qrCodeBase64 = '';
  });

  client.on('disconnected', async (reason) => {
    console.log('WhatsApp desconectado:', reason);
    clientStatus = 'DISCONNECTED';
    qrCodeBase64 = '';
    connectionInfo = null;
    try {
      await client.destroy();
    } catch (e) {
      console.error('Error al destruir el cliente de WhatsApp:', e);
    }
    // Re-initialize after disconnection
    setTimeout(initWhatsApp, 5000);
  });

  client.initialize().catch((err) => {
    console.error('Error durante la inicialización de WhatsApp:', err);
    clientStatus = 'ERROR';
  });
}

// Format Phone Number for WhatsApp Web API
function formatPhoneNumber(phone) {
  if (!phone) return null;
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;
  // If it doesn't have @c.us, append it
  if (!cleaned.endsWith('@c.us')) {
    cleaned = `${cleaned}@c.us`;
  }
  return cleaned;
}

// Send WhatsApp message helper
async function sendWhatsAppMessage(to, message) {
  if (clientStatus !== 'CONNECTED' || !client) {
    console.warn('No se puede enviar el mensaje: WhatsApp no está conectado.');
    return false;
  }
  try {
    const formattedTo = formatPhoneNumber(to);
    if (!formattedTo) {
      console.error('Número de teléfono inválido:', to);
      return false;
    }
    await client.sendMessage(formattedTo, message);
    console.log(`Mensaje enviado con éxito a ${formattedTo}`);
    return true;
  } catch (err) {
    console.error(`Error al enviar mensaje a ${to}:`, err);
    return false;
  }
}

// Get localized today's date in YYYY-MM-DD
function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Check and send alerts
let isChecking = false;
async function checkBillsAndNotify() {
  if (isChecking) return;
  isChecking = true;
  console.log('Iniciando verificación de cuentas para notificaciones...');

  try {
    const bills = await getBills();
    const settings = await getSettings();
    const todayStr = getLocalDateString();
    const today = new Date(todayStr);

    let dbChanged = false;

    for (const bill of bills) {
      // Only process pending bills
      if (bill.status !== 'pending') continue;

      const dueDate = new Date(bill.dueDate);
      // Calculate diff in days (dueDate - today)
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let messageSent = false;
      let notificationType = '';

      // Check for Due Date notification
      if (diffDays === 0 && settings.notifyOnDueDate && !bill.notifiedDueDate) {
        notificationType = 'vence hoy';
        const msg = settings.messageTemplate
          .replace(/{name}/g, bill.name)
          .replace(/{amount}/g, bill.amount)
          .replace(/{currency}/g, settings.currency || '')
          .replace(/{dueDate}/g, bill.dueDate);

        const targetPhone = bill.phoneNumber || settings.defaultPhoneNumber;
        if (targetPhone) {
          console.log(`Enviando notificación para ${bill.name} (Vence hoy) a ${targetPhone}`);
          const success = await sendWhatsAppMessage(targetPhone, msg);
          if (success) {
            bill.notifiedDueDate = true;
            messageSent = true;
          }
        } else {
          console.warn(`No se pudo enviar la alerta de hoy para "${bill.name}". No hay teléfono configurado.`);
        }
      }

      // Check for Days Before notification
      const daysBefore = parseInt(settings.notifyDaysBefore, 10);
      if (
        !messageSent &&
        daysBefore > 0 &&
        diffDays === daysBefore &&
        !bill.notifiedDaysBefore
      ) {
        notificationType = `vence en ${daysBefore} día(s)`;
        const msg = `🔔 *Recordatorio Anticipado* 🔔\n\n` + settings.messageTemplate
          .replace(/{name}/g, bill.name)
          .replace(/{amount}/g, bill.amount)
          .replace(/{currency}/g, settings.currency || '')
          .replace(/{dueDate}/g, bill.dueDate);

        const targetPhone = bill.phoneNumber || settings.defaultPhoneNumber;
        if (targetPhone) {
          console.log(`Enviando notificación anticipada para ${bill.name} (${daysBefore} días antes) a ${targetPhone}`);
          const success = await sendWhatsAppMessage(targetPhone, msg);
          if (success) {
            bill.notifiedDaysBefore = true;
            messageSent = true;
          }
        } else {
          console.warn(`No se pudo enviar la alerta anticipada para "${bill.name}". No hay teléfono configurado.`);
        }
      }

      if (messageSent) {
        // Track the notification history on the bill
        if (!bill.notificationLog) bill.notificationLog = [];
        bill.notificationLog.push({
          date: todayStr,
          type: notificationType,
          timestamp: new Date().toISOString()
        });
        dbChanged = true;
      }
    }

    if (dbChanged) {
      await saveBills(bills);
    }
  } catch (err) {
    console.error('Error en checkBillsAndNotify:', err);
  } finally {
    isChecking = false;
  }
}

// Scheduler: Run every minute to check if the current time matches the notification time
let lastCheckedDate = '';
cron.schedule('* * * * *', async () => {
  try {
    const settings = await getSettings();
    const now = new Date();
    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayStr = getLocalDateString();

    if (currentHourMin === settings.notificationTime && lastCheckedDate !== todayStr) {
      console.log(`Hora de notificación alcanzada (${currentHourMin}). Ejecutando tareas de alerta...`);
      lastCheckedDate = todayStr;
      await checkBillsAndNotify();
    }
  } catch (e) {
    console.error('Error en el programador de alertas:', e);
  }
});

// REST API Endpoints

// 1. WhatsApp status
app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    status: clientStatus,
    qr: qrCodeBase64,
    connectionInfo
  });
});

// 2. WhatsApp logout / reset
app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    if (client) {
      await client.logout();
      await client.destroy();
    }
    initWhatsApp();
    res.json({ success: true, message: 'Sesión de WhatsApp cerrada y cliente reiniciado.' });
  } catch (err) {
    console.error('Error al desconectar WhatsApp:', err);
    res.status(500).json({ error: 'Error al desconectar WhatsApp' });
  }
});

// 3. Test WhatsApp sending
app.post('/api/whatsapp/test-message', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Teléfono y mensaje son requeridos.' });
  }
  const success = await sendWhatsAppMessage(phone, message);
  if (success) {
    res.json({ success: true, message: 'Mensaje de prueba enviado.' });
  } else {
    res.status(500).json({ error: 'No se pudo enviar el mensaje. Verifica el estado de WhatsApp y el número.' });
  }
});

// 4. Get Bills
app.get('/api/bills', async (req, res) => {
  const bills = await getBills();
  res.json(bills);
});

// 5. Add Bill
app.post('/api/bills', async (req, res) => {
  const { name, amount, dueDate, phoneNumber } = req.body;
  if (!name || amount === undefined || !dueDate) {
    return res.status(400).json({ error: 'Nombre, monto y fecha de vencimiento son requeridos.' });
  }

  const bills = await getBills();
  const newBill = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
    name,
    amount: parseFloat(amount),
    dueDate,
    phoneNumber: phoneNumber ? phoneNumber.trim() : '',
    status: 'pending',
    notifiedDueDate: false,
    notifiedDaysBefore: false,
    notificationLog: [],
    createdAt: new Date().toISOString()
  };

  bills.push(newBill);
  await saveBills(bills);
  res.status(201).json(newBill);
});

// 6. Update Bill
app.put('/api/bills/:id', async (req, res) => {
  const { id } = req.params;
  const { name, amount, dueDate, phoneNumber, status } = req.body;

  const bills = await getBills();
  const index = bills.findIndex((b) => b.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Cuenta no encontrada.' });
  }

  const bill = bills[index];

  // If dueDate changed, reset notification flags so it can trigger notifications again
  if (dueDate && dueDate !== bill.dueDate) {
    bill.notifiedDueDate = false;
    bill.notifiedDaysBefore = false;
    bill.dueDate = dueDate;
  }

  if (name !== undefined) bill.name = name;
  if (amount !== undefined) bill.amount = parseFloat(amount);
  if (phoneNumber !== undefined) bill.phoneNumber = phoneNumber.trim();
  
  if (status !== undefined) {
    bill.status = status;
    // If marked as paid, reset notification flags if we want, but usually paid means no more notifications.
    // If set back to pending, reset them so they can be notified.
    if (status === 'pending') {
      bill.notifiedDueDate = false;
      bill.notifiedDaysBefore = false;
    }
  }

  bills[index] = bill;
  await saveBills(bills);
  res.json(bill);
});

// 7. Delete Bill
app.delete('/api/bills/:id', async (req, res) => {
  const { id } = req.params;
  let bills = await getBills();
  const exists = bills.some((b) => b.id === id);

  if (!exists) {
    return res.status(404).json({ error: 'Cuenta no encontrada.' });
  }

  bills = bills.filter((b) => b.id !== id);
  await saveBills(bills);
  res.json({ success: true, message: 'Cuenta eliminada.' });
});

// 8. Get Settings
app.get('/api/settings', async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
});

// 9. Update Settings
app.post('/api/settings', async (req, res) => {
  const { notificationTime, notifyOnDueDate, notifyDaysBefore, messageTemplate, currency, defaultPhoneNumber } = req.body;
  const currentSettings = await getSettings();

  const newSettings = {
    ...currentSettings,
    notificationTime: notificationTime || currentSettings.notificationTime,
    notifyOnDueDate: notifyOnDueDate !== undefined ? !!notifyOnDueDate : currentSettings.notifyOnDueDate,
    notifyDaysBefore: notifyDaysBefore !== undefined ? parseInt(notifyDaysBefore, 10) : currentSettings.notifyDaysBefore,
    messageTemplate: messageTemplate || currentSettings.messageTemplate,
    currency: currency !== undefined ? currency : currentSettings.currency,
    defaultPhoneNumber: defaultPhoneNumber !== undefined ? defaultPhoneNumber.trim() : currentSettings.defaultPhoneNumber
  };

  await saveSettings(newSettings);
  res.json(newSettings);
});

// Start WhatsApp initialization after server starts
app.listen(PORT, () => {
  console.log(`Servidor de Notificaciones corriendo en http://localhost:${PORT}`);
  initWhatsApp();
});
