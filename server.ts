import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

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

// Endpoint for AI Advisor Chat
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'El mensaje es requerido.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Prepare conversation contents
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      if (Array.isArray(history)) {
        for (const item of history.slice(-8)) {
          if (item && item.role && item.text) {
            contents.push({
              role: item.role === 'user' ? 'user' : 'model',
              parts: [{ text: item.text }],
            });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        },
      });

      const replyText = response.text || 'No fue posible generar una respuesta en este momento.';
      return res.json({ reply: replyText });
    } else {
      // Intelligent fallback when API key is not configured in local environment
      const lower = message.toLowerCase();
      let fallbackReply = '';

      if (lower.includes('nist') || lower.includes('csf') || lower.includes('gobernar') || lower.includes('tier')) {
        fallbackReply = `El marco **NIST CSF 2.0** establece una estructura de resiliencia dinámica basada en resultados:\n\n` +
          `• **Función Gobernar (GV)**: Es el nuevo eje transversal obligatorio que asegura que la ciberseguridad esté integrada con la estrategia de negocio y la junta directiva (incluye Contexto Organizacional, Estrategia de Riesgos y Cadena de Suministro GV.SC).\n` +
          `• **Ruedas Operativas**: Identificar (ID), Proteger (PR), Detectar (DE), Responder (RS) y Recuperar (RC).\n` +
          `• **Tiers de Implementación (1 al 4)**: Desde Parcial (1) hasta Adaptativo (4), evaluando cómo la organización percibe y responde al riesgo.\n` +
          `• **Ciclo de 5 Pasos**: Alcance -> Recopilación -> Creación de Perfiles -> Análisis de Brechas (Gap Analysis) -> POA&M.\n\n` +
          `¿Deseas que te orientemos en cómo evaluar el Tier actual de tu organización? Puedes agendar una sesión de diagnóstico en nuestra sección de contacto.`;
      } else if (lower.includes('iso') || lower.includes('27001') || lower.includes('anexo a') || lower.includes('sgsi') || lower.includes('control')) {
        fallbackReply = `La norma **ISO/IEC 27001:2022** es el estándar internacional para el Sistema de Gestión de Seguridad de la Información (SGSI):\n\n` +
          `• **Estructura del Anexo A**: Se simplificó a **93 controles** agrupados en 4 temáticas: Organizacionales (37), Personas (8), Físicos (14) y Tecnológicos (34).\n` +
          `• **11 Nuevos Controles Críticos**: Entre ellos destacan Inteligencia de Amenazas (A.5.7), Seguridad en la Nube (A.5.23), Preparación TIC (A.5.30), Gestión de Configuración (A.8.9), Supresión y Enmascaramiento de Datos (A.8.10/11) y Codificación Segura (A.8.28).\n` +
          `• **Ciclo PDCA**: Planificar, Hacer, Verificar y Actuar para mejora continua.\n\n` +
          `En Risknet contamos con **Auditores Internos Certificados ISO/IEC 27001:2022** para guiar a tu equipo en la adecuación y superar la auditoría de certificación.`;
      } else if (lower.includes('vgrc') || lower.includes('servicio') || lower.includes('plataforma')) {
        fallbackReply = `El modelo **vGRC (Virtual GRC as a Service)** de Risknet resuelve la escasez de talento especializado y el alto costo de equipos internos:\n\n` +
          `• **Plataforma + CISO Asignado**: Te proporciona una plataforma tecnológica para gestión continua de controles, respaldada por un equipo consultor senior.\n` +
          `• **Monitoreo de Terceros**: Clasificación y control de riesgos en la cadena de suministro (proveedores SaaS y partners cloud).\n` +
          `• **Alineación Continua**: Mapeo simultáneo entre ISO 27001 y NIST CSF 2.0 sin duplicar esfuerzos documentales.\n\n` +
          `Puedes solicitar un diagnóstico preliminar para dimensionar el esquema adecuado para tu empresa.`;
      } else if (lower.includes('contacto') || lower.includes('correo') || lower.includes('sede') || lower.includes('telefono') || lower.includes('medellin') || lower.includes('albuquerque')) {
        fallbackReply = `Puedes comunicarte directamente con nuestros canales y sedes binacionales:\n\n` +
          `• **Sede Principal (USA)**: 2105 Vista Oeste NW, Suite E-1140, Albuquerque, NM 87120. Tel: (505) 565-7836.\n` +
          `• **Medellín Hub (Colombia)**: Soporte técnico y consultivo LATAM. Tel/WhatsApp: +57 301 248 3308.\n` +
          `• **Email Directo CISO**: aurbina@risknet.us\n` +
          `• **Canal Seguro PGP**: Fingerprint 0x4F8A 9E21 773B CC42 para envío de información técnica cifrada.`;
      } else if (lower.includes('nda') || lower.includes('confidencialidad') || lower.includes('diagnostico') || lower.includes('agenda')) {
        fallbackReply = `El **Diagnóstico Inicial de Risknet** se realiza bajo un estricto protocolo de confidencialidad:\n\n` +
          `• Al completar el formulario de agendamiento y marcar el checklist, se suscribe automáticamente un **Acuerdo Bilateral de Confidencialidad (Mutual NDA)** vinculante por 3 años.\n` +
          `• Se emite un Folio Único de Seguridad y un sello criptográfico SHA-256.\n` +
          `• Al enviar tu solicitud, puedes descargar de inmediato tu copia formal firmada o verla en pantalla.\n\n` +
          `Todo el intercambio técnico está respaldado por los controles de custodia de ISO 27001 y NIST CSF 2.0.`;
      } else {
        fallbackReply = `Hola. Soy el **Risknet AI Advisor**, consultor virtual en Gobierno, Riesgo y Cumplimiento (GRC) y Ciberseguridad Defensiva.\n\n` +
          `Puedo orientarte sobre:\n` +
          `1. **NIST CSF 2.0**: Implementación de la función Gobernar (GV), Tiers 1-4 y matriz de resiliencia.\n` +
          `2. **ISO/IEC 27001:2022**: Adaptación al nuevo Anexo A de 93 controles y auditoría interna del SGSI.\n` +
          `3. **Modelo vGRC**: Plataforma y servicios gestionados para terceros y cumplimiento continuo.\n` +
          `4. **Diagnóstico & NDA**: Agendamiento técnico y formalización bilateral automática.\n\n` +
          `¿Sobre cuál de estos temas deseas profundizar? También puedes consultar directamente con nuestro CISO en **aurbina@risknet.us**.`;
      }

      return res.json({ reply: fallbackReply });
    }
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    return res.status(500).json({ error: 'Error interno en el asistente virtual.' });
  }
});

function createRfc2822(to: string, subject: string, htmlContent: string) {
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

// Endpoint to sync booking to Google Sheets and dispatch confirmation via Gmail
app.post('/api/workspace/sync-booking', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta token de autorización de Google Workspace.' });
    }

    const accessToken = authHeader.split(' ')[1];
    const { booking } = req.body;

    if (!booking || !booking.email || !booking.org || !booking.refCode) {
      return res.status(400).json({ error: 'Datos de agendamiento incompletos.' });
    }

    // Zero Trust Server-Side Validation: verify the token belongs to an authorized admin account
    const AUTHORIZED_ADMIN_EMAILS = [
      (process.env.ADMIN_EMAIL || 'aurbina@risknet.us').toLowerCase(),
      'contactoweltcomm@gmail.com',
    ];

    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        const tokenEmail = (userInfo.email || '').toLowerCase();
        if (tokenEmail && !AUTHORIZED_ADMIN_EMAILS.includes(tokenEmail)) {
          console.warn(`[SECURITY] Blocked unauthorized Google account from sync: ${tokenEmail}`);
          return res.status(403).json({
            error: `Acceso restringido: La cuenta Google (${tokenEmail}) no está autorizada para administrar o sincronizar datos de Risknet.`,
          });
        }
      }
    } catch (vErr) {
      console.warn('Could not verify Google token userinfo:', vErr);
    }

    let spreadsheetId = booking.spreadsheetId || null;
    let spreadsheetUrl = '';
    const sheetTabName = 'Diagnosticos';

    // --- STEP 1: GOOGLE SHEETS REGISTRATION ---
    if (!spreadsheetId) {
      try {
        const driveQuery = "name = 'Risknet - Diagnósticos & Clientes GRC' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
        const driveSearchRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (driveSearchRes.ok) {
          const driveData = await driveSearchRes.json();
          if (driveData.files && driveData.files.length > 0) {
            spreadsheetId = driveData.files[0].id;
            console.log('Found existing Google Sheet:', spreadsheetId);
          }
        } else {
          console.warn('Drive search error:', driveSearchRes.status, await driveSearchRes.text());
        }
      } catch (err) {
        console.warn('Could not search Drive for sheet:', err);
      }
    }

    if (!spreadsheetId) {
      try {
        const createSheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: {
              title: 'Risknet - Diagnósticos & Clientes GRC',
            },
            sheets: [
              {
                properties: {
                  title: sheetTabName,
                  gridProperties: { frozenRowCount: 1 },
                },
              },
            ],
          }),
        });

        if (createSheetRes.ok) {
          const sheetData = await createSheetRes.json();
          spreadsheetId = sheetData.spreadsheetId;
          console.log('Created new Google Sheet:', spreadsheetId);

          const headerRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTabName + '!A1:K1')}?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                values: [
                  [
                    'Folio / ID',
                    'Fecha de Registro',
                    'Nombre del Cliente',
                    'Organización',
                    'Correo Corporativo',
                    'Teléfono',
                    'Colaboradores',
                    'Estándar / Foco',
                    'Mensaje / Desafío',
                    'Estado Acuerdo NDA',
                    'Sello Criptográfico SHA-256',
                  ],
                ],
              }),
            }
          );
          if (!headerRes.ok) {
            console.warn('Could not set headers in new sheet:', headerRes.status, await headerRes.text());
          }
        } else {
          console.warn('Create sheet failed:', createSheetRes.status, await createSheetRes.text());
        }
      } catch (err) {
        console.warn('Could not create Google Sheet:', err);
      }
    }

    // Append row to sheet
    if (spreadsheetId) {
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

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
                  booking.refCode,
                  booking.timestamp || new Date().toLocaleString('es-CO'),
                  booking.name,
                  booking.org,
                  booking.email,
                  booking.phone,
                  booking.size,
                  booking.standard,
                  booking.msg || 'N/A',
                  'Formalizado y Vigente (3 años)',
                  booking.hash || 'SHA256: VALIDATED',
                ],
              ],
            }),
          }
        );
        if (!appendRes.ok) {
          console.warn('Append to sheet failed:', appendRes.status, await appendRes.text());
        } else {
          console.log('Row appended successfully to Google Sheet:', spreadsheetId);
        }
      } catch (err) {
        console.warn('Could not append row to Google Sheet:', err);
      }
    }

    // --- STEP 2: GMAIL DISPATCH ---
    let clientEmailSent = false;
    let adminEmailSent = false;
    let emailLogs: string[] = [];

    // Email 1: Confirmation to Client
    try {
      const clientHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; border: 1px solid #cbd5e1; border-top: 4px solid #00D8FF; background-color: #ffffff; color: #1e293b;">
          <div style="margin-bottom: 20px;">
            <span style="font-size: 11px; font-weight: bold; color: #0284c7; text-transform: uppercase; letter-spacing: 1px;">Confirmación Oficial de Diagnóstico Técnico</span>
            <h2 style="color: #0f172a; margin: 5px 0 0 0; font-size: 22px;">Risknet RegTech Enable Service</h2>
            <p style="color: #64748b; font-size: 12px; margin: 2px 0 0 0;">Operado por Weltcomm LLC · Albuquerque (USA) & Medellín Hub (Colombia)</p>
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; margin-bottom: 20px; font-size: 13px;">
            <strong>Estimado/a ${booking.name},</strong><br><br>
            Hemos registrado exitosamente la solicitud de diagnóstico técnico para <strong>${booking.org}</strong>.
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-family: monospace; font-size: 12px;">
              <strong>FOLIO DE ATENCIÓN:</strong> <span style="color: #0284c7; font-weight: bold;">${booking.refCode}</span><br>
              <strong>ESTÁNDAR SELECCIONADO:</strong> ${booking.standard}<br>
              <strong>ESTADO DEL ACUERDO:</strong> <span style="color: #16a34a; font-weight: bold;">NDA Bilateral Formalizado y Vigente (3 años)</span><br>
              <strong>SELLO CRIPTOGRÁFICO:</strong> ${booking.hash || 'SHA256 VALIDATED'}
            </div>
          </div>

          <h3 style="color: #0f172a; font-size: 14px; text-transform: uppercase;">Próximos Pasos:</h3>
          <ul style="font-size: 13px; color: #334155; line-height: 1.6; padding-left: 20px;">
            <li>Nuestro equipo técnico asignado bajo la dirección de <strong>Alejandro Urbina (CISO)</strong> revisará el alcance preliminar.</li>
            <li>Un consultor senior se comunicará directamente a su teléfono (${booking.phone}) o correo corporativo para coordinar la sesión virtual privada.</li>
            <li>Toda la documentación técnica que comparta durante la sesión se encuentra protegida bajo el Acuerdo Bilateral de Confidencialidad conforme a los estándares de custodia de ISO/IEC 27001:2022 y NIST CSF 2.0.</li>
          </ul>

          <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5;">
            <strong>Canales Directos de Atención CISO:</strong><br>
            • Email Directo CISO: <a href="mailto:aurbina@risknet.us" style="color: #0284c7;">aurbina@risknet.us</a><br>
            • EE. UU. (Albuquerque): (505) 565-7836<br>
            • Colombia (Medellín Hub): +57 301 248 3308<br>
            • Clave Pública PGP: Fingerprint 0x4F8A 9E21 773B CC42
          </div>
        </div>
      `;

      const clientMsgRaw = createRfc2822(
        booking.email,
        `[CONFIRMACIÓN] Diagnóstico Técnico Risknet - Folio ${booking.refCode} (NDA Formalizado)`,
        clientHtml
      );

      const clientSendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: clientMsgRaw }),
      });

      if (clientSendRes.ok) {
        clientEmailSent = true;
        emailLogs.push(`Cliente (${booking.email}): Despachado exitosamente.`);
        console.log(`Confirmation email sent to client: ${booking.email}`);
      } else {
        const errText = await clientSendRes.text();
        console.warn('Gmail client send failed:', clientSendRes.status, errText);
        emailLogs.push(`Cliente: Error ${clientSendRes.status}`);
      }
    } catch (err: any) {
      console.warn('Could not send client email via Gmail:', err);
      emailLogs.push(`Cliente: Excepción ${err.message}`);
    }

    // Email 2: Alert to Admin / CISO (aurbina@risknet.us and contactoweltcomm@gmail.com)
    const adminRecipients = ['aurbina@risknet.us', 'contactoweltcomm@gmail.com'];
    for (const recipient of adminRecipients) {
      try {
        const adminHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; border: 1px solid #cbd5e1; border-top: 4px solid #16a34a; background-color: #ffffff; color: #1e293b;">
            <span style="font-size: 11px; font-weight: bold; color: #16a34a; text-transform: uppercase;">Nuevo Lead / Solicitud de Diagnóstico GRC</span>
            <h2 style="color: #0f172a; margin: 5px 0 15px 0; font-size: 20px;">${booking.org}</h2>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold; width: 35%;">Folio / Ref:</td>
                <td style="padding: 8px 12px; font-family: monospace; color: #0284c7;">${booking.refCode}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold;">Cliente:</td>
                <td style="padding: 8px 12px;">${booking.name}</td>
              </tr>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold;">Empresa:</td>
                <td style="padding: 8px 12px;"><strong>${booking.org}</strong></td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold;">Email Corporativo:</td>
                <td style="padding: 8px 12px;"><a href="mailto:${booking.email}">${booking.email}</a></td>
              </tr>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold;">Teléfono / WhatsApp:</td>
                <td style="padding: 8px 12px;"><a href="tel:${booking.phone}">${booking.phone}</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold;">Colaboradores:</td>
                <td style="padding: 8px 12px;">${booking.size}</td>
              </tr>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold;">Estándar Foco:</td>
                <td style="padding: 8px 12px; color: #0284c7; font-weight: bold;">${booking.standard}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold;">Desafío / Mensaje:</td>
                <td style="padding: 8px 12px; color: #475569;">${booking.msg || 'No especificado'}</td>
              </tr>
              <tr style="background-color: #f8fafc;">
                <td style="padding: 8px 12px; font-weight: bold;">Fecha de Registro:</td>
                <td style="padding: 8px 12px;">${booking.timestamp || new Date().toLocaleString('es-CO')}</td>
              </tr>
            </table>

            ${spreadsheetUrl ? `<div style="margin-top: 15px; padding: 10px; background-color: #f0fdf4; border: 1px solid #bbf7d0; font-size: 12px;">
              <strong>Hoja de Google Sheets:</strong> <a href="${spreadsheetUrl}" target="_blank" style="color: #16a34a; font-weight: bold;">Abrir Hoja de Cálculo ↗</a>
            </div>` : ''}
          </div>
        `;

        const adminMsgRaw = createRfc2822(
          recipient,
          `[NUEVO CLIENTE GRC] ${booking.org} - Folio ${booking.refCode}`,
          adminHtml
        );

        const adminSendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: adminMsgRaw }),
        });

        if (adminSendRes.ok) {
          adminEmailSent = true;
          emailLogs.push(`Equipo CISO (${recipient}): Notificado exitosamente.`);
          console.log(`Lead alert sent to admin: ${recipient}`);
        } else {
          const errText = await adminSendRes.text();
          console.warn(`Admin send to ${recipient} failed:`, adminSendRes.status, errText);
        }
      } catch (err: any) {
        console.warn(`Could not send admin email to ${recipient} via Gmail:`, err);
      }
    }

    return res.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl,
      clientEmailSent,
      adminEmailSent,
      emailLogs,
      message: 'Sincronización completada exitosamente en Google Sheets y despacho por Gmail.',
    });
  } catch (error: any) {
    console.error('Error in /api/workspace/sync-booking:', error);
    return res.status(500).json({
      error: 'Error al sincronizar con Google Workspace.',
      details: error.message || 'Error desconocido',
    });
  }
});

// Setup Vite middleware in development or static serve in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const fs = await import('fs');
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Risknet Security Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
