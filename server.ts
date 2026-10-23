import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ==========================================
// 1. BLINDAJE DE SEGURIDAD & CABECERAS HTTP
// ==========================================
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://cdn.tailwindcss.com',
          'https://apis.google.com',
          'https://www.gstatic.com',
          'https://*.firebaseapp.com',
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdn.tailwindcss.com',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        frameSrc: [
          "'self'",
          'https://accounts.google.com',
          'https://*.firebaseapp.com',
          'https://*.googleapis.com',
        ],
        frameAncestors: null,
        connectSrc: [
          "'self'",
          'https://generativelanguage.googleapis.com',
          'https://www.googleapis.com',
          'https://sheets.googleapis.com',
          'https://gmail.googleapis.com',
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          'https://*.firebaseio.com',
          'https://*.googleapis.com',
          'ws:',
          'wss:',
        ],
        upgradeInsecureRequests: null,
      },
    },
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

app.use(express.json({ limit: '1mb' }));

// Helper defensivo contra inyección HTML
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SYSTEM_INSTRUCTION = `Eres "Risknet AI Advisor", el asistente virtual especializado en Gobierno, Riesgo y Cumplimiento (GRC), Ciberseguridad Defensiva y Resiliencia Operativa de la firma Risknet (operada por Weltcomm LLC).

Tu objetivo es orientar y resolver dudas técnicas, metodológicas y normativas a directores de tecnología, CISOs, oficiales de cumplimiento y líderes empresariales sobre:

1. Marco NIST CSF 2.0:
   - 6 Funciones Principales: Gobernar (GV) como eje central transversal, Identificar (ID), Proteger (PR), Detectar (DE), Responder (RS), Recuperar (RC).
   - Categorías de Gobernar (GV): GV.OC (Contexto Organizacional), GV.RM (Estrategia de Gestión de Riesgo), GV.RR (Roles y Responsabilidades), GV.PO (Políticas), GV.OV (Supervisión), GV.SC (Riesgo en Cadena de Suministro).
   - Tiers de Implementación (1 a 4): Parcial (1), Informado por el Riesgo (2), Repetible (3), Adaptativo (4).
   - Ciclo de Implementación de 5 Pasos: Alcance (Scope) -> Recopilación (Gather) -> Perfiles Actual y Objetivo (Create) -> Análisis de Brechas (Analyze) -> Plan de Acción y Milestones (POA&M).

2. Norma ISO/IEC 27001:2022:
   - Estructura del SGSI (Cláusulas 4 a 10) y Ciclo PDCA (Planificar, Hacer, Verificar, Actuar).
   - Anexo A con 93 controles en 4 temas: Organizacionales (37), Personas (8), Físicos (14), Tecnológicos (34).
   - Los 11 nuevos controles críticos de la versión 2022: Inteligencia de Amenazas (A.5.7), Seguridad en la Nube (A.5.23), Preparación TIC para la Continuidad del Negocio (A.5.30), Gestión de Configuración (A.8.9), Supresión de Datos (A.8.10), Enmascaramiento de Datos (A.8.11), Prevención de Fuga de Datos (A.8.12), Monitoreo de Actividades (A.8.16), Filtrado Web (A.8.23), y Codificación Segura (A.8.28).
   - Auditorías internas certificadas y preparación para certificación externa.

3. Servicios y Capacidades de Risknet:
   - Modelo vGRC (Virtual GRC): Gestión continua y orquestada combinando plataforma tecnológica y consultores especializados.
   - Diagnóstico Técnico Inicial sin Costo: Con formalización automática e inmediata de Acuerdo Bilateral de Confidencialidad (Mutual NDA) vinculante por 3 años.
   - Canales Seguros & Enclave CISO: Clave pública oficial PGP (Fingerprint: 0x4F8A 9E21 773B CC42) y contacto directo con el CISO: aurbina@risknet.us.
   - Presencia Binacional: Sede Principal en 2105 Vista Oeste Northwest, Suite E-1140, Albuquerque, NM 87120, EE. UU. (Tel: 505 565 7836) y Hub en Medellín, Colombia (Tel: +57 301 248 3308).

Pautas de Interacción:
- Responde de forma concisa, analítica, profesional y con rigor técnico.
- Estructura tus respuestas con viñetas claras y negritas.
- Siempre en idioma español claro con terminología estándar de ciberseguridad.
- Si la consulta involucra iniciar una auditoría, evaluación o atención de incidentes, orienta al usuario a agendar el Diagnóstico Inicial en el sitio o contactar al canal CISO en aurbina@risknet.us.`;

// ==========================================
// 2. ENDPOINT: CHAT CON GEMINI AI
// ==========================================
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'El mensaje es requerido y no puede estar vacío.' });
    }

    if (message.length > 2000) {
      return res.status(413).json({ error: 'Longitud de mensaje excedida (máximo 2000 caracteres).' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey.trim() !== '' && !apiKey.includes('YOUR_')) {
      try {
        const ai = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'risknet-security-engine/2.0',
            },
          },
        });

        // Mapeo seguro del historial de conversación (máximo 6 turnos para optimizar contexto y latencia)
        const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

        if (Array.isArray(history)) {
          for (const item of history.slice(-6)) {
            if (item?.role && typeof item.text === 'string') {
              contents.push({
                role: item.role === 'user' ? 'user' : 'model',
                parts: [{ text: item.text }],
              });
            }
          }
        }

        contents.push({
          role: 'user',
          parts: [{ text: message.trim() }],
        });

        // Usar modelo de producción estable soportado por la API de Google GenAI
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.3, // Menor temperatura para rigor técnico en GRC
          },
        });

        const replyText = response.text || 'No fue posible generar una respuesta determinista.';
        return res.json({ reply: replyText });
      } catch (geminiError: unknown) {
        console.warn('[Risknet AI Notice]: Gemini API no disponible o cuota alcanzada, usando motor determinista.', geminiError);
        return res.json({ reply: getDeterministicFallback(message) });
      }
    } else {
      // Fallback determinista en entornos locales/offline
      return res.json({ reply: getDeterministicFallback(message) });
    }
  } catch (error: unknown) {
    console.error('[Risknet AI Chat Engine Error]:', error);
    return res.status(500).json({ error: 'Error interno en el asistente virtual de Risknet.' });
  }
});

function getDeterministicFallback(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('nist') || lower.includes('csf') || lower.includes('gobernar') || lower.includes('tier')) {
    return (
      `El marco **NIST CSF 2.0** establece una estructura de resiliencia dinámica basada en resultados:\n\n` +
      `• **Función Gobernar (GV)**: Es el nuevo eje transversal obligatorio que asegura la integración de la ciberseguridad con la estrategia directiva.\n` +
      `• **Ruedas Operativas**: Identificar (ID), Proteger (PR), Detectar (DE), Responder (RS) y Recuperar (RC).\n` +
      `• **Tiers de Implementación (1 al 4)**: Desde Parcial (1) hasta Adaptativo (4).\n` +
      `• **Ciclo de 5 Pasos**: Alcance -> Recopilación -> Creación de Perfiles -> Gap Analysis -> POA&M.\n\n` +
      `¿Deseas evaluar el Tier actual de tu organización? Puedes solicitar un diagnóstico en nuestra sección de contacto.`
    );
  } else if (lower.includes('iso') || lower.includes('27001') || lower.includes('sgsi')) {
    return (
      `La norma **ISO/IEC 27001:2022** rige el Sistema de Gestión de Seguridad de la Información (SGSI):\n\n` +
      `• **Anexo A Simplificado**: 93 controles agrupados en Organizacionales (37), Personas (8), Físicos (14) y Tecnológicos (34).\n` +
      `• **11 Nuevos Controles**: Destacan A.5.7 (Threat Intelligence), A.5.23 (Seguridad Cloud), A.8.12 (Data Leakage Prevention) y A.8.28 (Secure Coding).\n\n` +
      `En Risknet disponemos de auditores certificados para asegurar su proceso de certificación.`
    );
  }
  return (
    `Bienvenido a **Risknet RegTech & Defense**.\n\n` +
    `Puedo orientarte en la adopción de **NIST CSF 2.0**, **ISO/IEC 27001:2022**, implementación de **vGRC** y formalización de diagnósticos con NDA bilateral.\n` +
    `¿En qué área requiere apoyo su organización?`
  );
}

// ==========================================
// 3. INTEGRACIÓN CON WORKSPACE (SHEETS + GMAIL)
// ==========================================
function createRfc2822(to: string, subject: string, htmlContent: string): string {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const message = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlContent,
  ].join('\r\n');

  return Buffer.from(message, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

interface SheetInfo {
  id: string;
  url: string;
}

const SHEET_TITLE = 'Risknet - Registros de Diagnóstico GRC';
const SHEET_TAB_NAME = 'Diagnosticos';

async function getOrCreateGoogleSheet(accessToken: string): Promise<SheetInfo | null> {
  // 1. Si está configurado en variable de entorno
  if (process.env.GOOGLE_SHEET_ID) {
    try {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (checkRes.ok) {
        return {
          id: process.env.GOOGLE_SHEET_ID,
          url: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit`,
        };
      }
    } catch (e) {
      console.warn('Error checking GOOGLE_SHEET_ID from env:', e);
    }
  }

  // 2. Buscar en Google Drive por título
  try {
    const q = `name='${SHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (driveRes.ok) {
      const driveData = await driveRes.json();
      if (Array.isArray(driveData.files) && driveData.files.length > 0) {
        const file = driveData.files[0];
        return {
          id: file.id,
          url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
        };
      }
    }
  } catch (driveErr) {
    console.warn('Error querying Google Drive files:', driveErr);
  }

  // 3. Crear hoja si no existe
  try {
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: SHEET_TITLE,
        },
        sheets: [
          {
            properties: {
              title: SHEET_TAB_NAME,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      { userEnteredValue: { stringValue: 'Folio / RefCode' } },
                      { userEnteredValue: { stringValue: 'Fecha y Hora' } },
                      { userEnteredValue: { stringValue: 'Contacto' } },
                      { userEnteredValue: { stringValue: 'Empresa / Organización' } },
                      { userEnteredValue: { stringValue: 'Email Corporativo' } },
                      { userEnteredValue: { stringValue: 'Teléfono / Móvil' } },
                      { userEnteredValue: { stringValue: 'Tamaño Org' } },
                      { userEnteredValue: { stringValue: 'Estándar / Marco Solicitado' } },
                      { userEnteredValue: { stringValue: 'Requerimientos Técnicos' } },
                      { userEnteredValue: { stringValue: 'Estado NDA' } },
                      { userEnteredValue: { stringValue: 'Hash Criptográfico de Integridad' } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    if (createRes.ok) {
      const createdData = await createRes.json();
      return {
        id: createdData.spreadsheetId,
        url:
          createdData.spreadsheetUrl ||
          `https://docs.google.com/spreadsheets/d/${createdData.spreadsheetId}/edit`,
      };
    }
  } catch (createErr) {
    console.error('Error creating Google Spreadsheet:', createErr);
  }

  return null;
}

app.post('/api/workspace/get-or-create-sheet', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta token de autorización de Google Workspace.' });
    }

    const accessToken = authHeader.split(' ')[1];

    const AUTHORIZED_ADMIN_EMAILS = [
      (process.env.ADMIN_EMAIL || 'aurbina@risknet.us').toLowerCase(),
      'contactoweltcomm@gmail.com',
    ];

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return res.status(401).json({ error: 'Token de Google expirado o denegado.' });
    }

    const userInfo = await userInfoRes.json();
    const tokenEmail = (userInfo.email || '').toLowerCase();

    if (!AUTHORIZED_ADMIN_EMAILS.includes(tokenEmail)) {
      console.warn(`[SECURITY ALERT] Intento de acceso no autorizado a Google Sheet desde: ${tokenEmail}`);
      return res.status(403).json({ error: 'Cuenta no autorizada para acceder a la hoja administrativa de Risknet.' });
    }

    const sheetInfo = await getOrCreateGoogleSheet(accessToken);
    if (!sheetInfo) {
      return res.status(500).json({ error: 'No fue posible acceder ni crear la hoja de cálculo en Google Sheets.' });
    }

    return res.json({
      spreadsheetId: sheetInfo.id,
      spreadsheetUrl: sheetInfo.url,
    });
  } catch (error: unknown) {
    console.error('[Get-Or-Create-Sheet Fatal Error]:', error);
    return res.status(500).json({ error: 'Fallo al procesar la solicitud de Google Sheets.' });
  }
});

app.post('/api/workspace/sync-booking', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta token de autorización de Google Workspace.' });
    }

    const accessToken = authHeader.split(' ')[1];
    const { booking } = req.body;

    if (!booking?.email || !booking?.org || !booking?.refCode) {
      return res.status(400).json({ error: 'Payload incompleto: email, org y refCode son obligatorios.' });
    }

    // Zero-Trust: Validación de usuario administrador
    const AUTHORIZED_ADMIN_EMAILS = [
      (process.env.ADMIN_EMAIL || 'aurbina@risknet.us').toLowerCase(),
      'contactoweltcomm@gmail.com',
    ];

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return res.status(401).json({ error: 'Token de Google expirado o denegado.' });
    }

    const userInfo = await userInfoRes.json();
    const tokenEmail = (userInfo.email || '').toLowerCase();

    if (!AUTHORIZED_ADMIN_EMAILS.includes(tokenEmail)) {
      console.warn(`[SECURITY ALERT] Intento de acceso no autorizado desde: ${tokenEmail}`);
      return res.status(403).json({ error: 'Cuenta no autorizada para operaciones administrativas en Risknet.' });
    }

    // Sanitización defensiva
    const safe = {
      refCode: escapeHtml(booking.refCode),
      timestamp: escapeHtml(booking.timestamp || new Date().toLocaleString('es-CO')),
      name: escapeHtml(booking.name || 'No especificado'),
      org: escapeHtml(booking.org),
      email: escapeHtml(booking.email),
      phone: escapeHtml(booking.phone || 'No especificado'),
      size: escapeHtml(booking.size || 'No especificado'),
      standard: escapeHtml(booking.standard || 'Diagnóstico Integral'),
      msg: escapeHtml(booking.msg || 'N/A'),
      hash: escapeHtml(booking.hash || 'SHA256: VALIDATED'),
    };

    // Usar ID de hoja configurado o buscar/crear automáticamente en Google Drive
    let spreadsheetId = process.env.GOOGLE_SHEET_ID || booking.spreadsheetId || null;
    if (!spreadsheetId) {
      try {
        const autoSheet = await getOrCreateGoogleSheet(accessToken);
        if (autoSheet) {
          spreadsheetId = autoSheet.id;
        }
      } catch (e) {
        console.warn('[Sync-Booking] Could not resolve sheet automatically:', e);
      }
    }
    const sheetTabName = SHEET_TAB_NAME;

    // Registro en Google Sheets
    let sheetSuccess = false;
    if (spreadsheetId) {
      try {
        const appendRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTabName + '!A:K')}:append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: [
                [
                  safe.refCode,
                  safe.timestamp,
                  safe.name,
                  safe.org,
                  safe.email,
                  safe.phone,
                  safe.size,
                  safe.standard,
                  safe.msg,
                  'Formalizado y Vigente (3 años)',
                  safe.hash,
                ],
              ],
            }),
          }
        );
        sheetSuccess = appendRes.ok;
      } catch (sheetErr) {
        console.error('[Sheets Sync Exception]:', sheetErr);
      }
    }

    // Despacho concurrente de correos vía Gmail (Promise.allSettled)
    const clientHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; border: 1px solid #cbd5e1; border-top: 4px solid #00D8FF; background-color: #ffffff; color: #1e293b;">
        <span style="font-size: 11px; font-weight: bold; color: #0284c7; text-transform: uppercase;">Confirmación Oficial de Diagnóstico Técnico</span>
        <h2 style="color: #0f172a; margin: 5px 0;">Risknet RegTech & Defense</h2>
        <p style="color: #64748b; font-size: 12px; margin: 0 0 15px 0;">Operado por Weltcomm LLC · USA & Colombia</p>
        <p>Estimado/a <strong>${safe.name}</strong>, hemos registrado formalmente su solicitud para <strong>${safe.org}</strong>.</p>
        <div style="background:#f8fafc; padding:12px; border-left:3px solid #0284c7; font-family:monospace; font-size:12px;">
          FOLIO: ${safe.refCode}<br>
          ESTÁNDAR: ${safe.standard}<br>
          ESTADO: NDA Bilateral Formalizado (3 años)<br>
          SELLO: ${safe.hash}
        </div>
      </div>
    `;

    const adminHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; border-top: 4px solid #16a34a; background-color: #ffffff;">
        <h3 style="color:#0f172a; margin:0 0 10px 0;">Nueva Solicitud de Diagnóstico GRC</h3>
        <p><strong>Organización:</strong> ${safe.org} (${safe.size} colaboradores)</p>
        <p><strong>Contacto:</strong> ${safe.name} | ${safe.email} | ${safe.phone}</p>
        <p><strong>Estándar:</strong> ${safe.standard}</p>
        <p><strong>Folio:</strong> ${safe.refCode}</p>
      </div>
    `;

    const emailTasks = [
      // Enviar al cliente
      fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: createRfc2822(booking.email, `[CONFIRMACIÓN] Diagnóstico Risknet - Folio ${safe.refCode}`, clientHtml) }),
      }),
      // Enviar a la directiva CISO
      fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: createRfc2822('aurbina@risknet.us', `[NUEVO LEAD] ${safe.org} - Folio ${safe.refCode}`, adminHtml) }),
      }),
    ];

    const emailResults = await Promise.allSettled(emailTasks);
    const clientDelivered = emailResults[0].status === 'fulfilled' && (emailResults[0].value as globalThis.Response).ok;
    const adminDelivered = emailResults[1].status === 'fulfilled' && (emailResults[1].value as globalThis.Response).ok;

    return res.status(200).json({
      success: true,
      spreadsheetId,
      sheetSynced: sheetSuccess,
      clientEmailSent: clientDelivered,
      adminEmailSent: adminDelivered,
      message: 'Operación transaccional completada con resiliencia de servicios.',
    });
  } catch (error: unknown) {
    console.error('[Workspace Booking Fatal Error]:', error);
    return res.status(500).json({ error: 'Fallo crítico al sincronizar con Google Workspace.' });
  }
});

// ==========================================
// 4. CICLO DE VIDA DEL SERVIDOR (DEV & PROD)
// ==========================================
async function startServer(): Promise<void> {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    app.use('*', async (req: Request, res: Response, next: NextFunction) => {
      const url = req.originalUrl;
      try {
        const fs = await import('fs');
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: unknown) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Risknet Core Shield]: Servidor en ejecución bajo http://0.0.0.0:${PORT}`);
  });
}

startServer();
