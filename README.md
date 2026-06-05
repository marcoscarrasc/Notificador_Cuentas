# NotiPay - Notificador de Cuentas por WhatsApp 🔔

NotiPay es una aplicación web local y automatizada construida en **Node.js** que permite gestionar tus cuentas de pago pendientes y recibir recordatorios automatizados de WhatsApp cuando se acerque o llegue la fecha de vencimiento.

## Características

- 📊 **Dashboard Premium**: Interfaz interactiva en modo oscuro con estadísticas de total pendiente, vencido y pagado.
- 📱 **Vinculación por Código QR**: Conexión directa con tu cuenta de WhatsApp usando un código QR generado dinámicamente en pantalla (gratuito y sin APIs de pago).
- 🕒 **Programador de Alertas**: Un motor cron integrado que revisa tus facturas y envía notificaciones a la hora exacta configurada.
- ⚙️ **Configuración flexible**: Permite editar la hora de envío, plantilla de mensaje, días de anticipación de alertas y moneda.
- 🔒 **Privacidad total**: Tus datos se guardan de forma local en tu computadora y no se envían a ningún servidor externo.

---

## Captura de Pantalla

*(Agrega una captura de tu interfaz aquí)*

---

## Requisitos Previos

Asegúrate de tener instalado en tu sistema:
- **Node.js** (versión 18 o superior)
- **NPM** (incluido con Node.js)
- Un teléfono con la aplicación **WhatsApp** instalada

---

## Instalación y Configuración

1. Clona este repositorio o descarga el código fuente:
   ```bash
   git clone https://github.com/tu-usuario/notificador-cuentas.git
   cd notificador-cuentas
   ```

2. Instala las dependencias necesarias:
   ```bash
   npm install
   ```

3. Inicia la aplicación:
   ```bash
   npm start
   ```

4. Abre tu navegador y ve a:
   👉 **http://localhost:3000**

---

## ¿Cómo vincular tu WhatsApp?

1. Ve a la pestaña **WhatsApp Connection** en la aplicación web.
2. Espera a que cargue el código QR en pantalla.
3. Desde tu teléfono en la app de WhatsApp, ve a **Dispositivos Vinculados** > **Vincular un dispositivo** y escanea el código QR de la pantalla.
4. Una vez conectado, podrás configurar en la sección de **Configuración** tu número por defecto para recibir las notificaciones.

---

## 🔒 Advertencia de Seguridad Importante

El sistema guarda las credenciales de sesión en la carpeta local `.wwebjs_auth/`. **NUNCA subas esta carpeta ni la carpeta `data/` a GitHub** (estas ya están incluidas en el archivo `.gitignore`). Si compartes esos archivos, otras personas podrían tener acceso a tu WhatsApp o ver tus cuentas privadas.

---

## Tecnologías Utilizadas

- **Backend**: Node.js, Express.js
- **WhatsApp Web**: `whatsapp-web.js`
- **Planificador**: `node-cron`
- **Frontend**: HTML5, Vanilla CSS (diseño personalizado), JavaScript (ES6) e Iconos de Lucide.
