import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  getSpreadsheetId,
  setSpreadsheetId,
} from './firebase.ts';
import { User } from 'firebase/auth';

let currentUser: User | null = null;
let currentSpreadsheetUrl: string | null = null;
let pendingBookingData: any = null;

// Zero Trust Whitelist of Authorized Administrators
const AUTHORIZED_ADMIN_EMAILS = [
  'aurbina@risknet.us',
  'contactoweltcomm@gmail.com',
];

function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return AUTHORIZED_ADMIN_EMAILS.some((admin) => admin.toLowerCase() === clean);
}

function showAdminSecurityAlert(message: string) {
  const alertBox = document.getElementById('admin-security-alert-box');
  const alertText = document.getElementById('admin-security-alert-text');
  if (alertBox && alertText) {
    alertText.textContent = message;
    alertBox.classList.remove('hidden');
    setTimeout(() => {
      alertBox.classList.add('hidden');
    }, 12000);
  } else {
    alert(message);
  }
}

function updateWorkspaceUI(user: User | null, token: string | null) {
  const statusDot = document.getElementById('workspace-status-dot');
  const statusLabel = document.getElementById('workspace-status-label');
  const statusDesc = document.getElementById('workspace-status-desc');
  const loginBtn = document.getElementById('btn-google-login');
  const userProfile = document.getElementById('workspace-user-profile');
  const sheetLink = document.getElementById('workspace-sheet-link') as HTMLAnchorElement | null;

  if (user && token) {
    if (statusDot) {
      statusDot.className = 'w-2 h-2 rounded-full bg-brand-emerald animate-pulse';
    }
    if (statusLabel) {
      statusLabel.textContent = 'Google Sheets & Gmail CONECTADOS';
      statusLabel.className = 'font-chakra font-bold text-brand-emerald uppercase text-xs';
    }
    if (statusDesc) {
      statusDesc.innerHTML = `Conectado como <strong class="text-brand-pure">${user.email}</strong>. Cada agendamiento se guardará automáticamente en Google Sheets y despachará notificaciones por Gmail a <strong>aurbina@risknet.us</strong> y a tu cliente.`;
    }
    if (loginBtn) {
      loginBtn.classList.add('hidden');
    }
    if (userProfile) {
      userProfile.classList.remove('hidden');
    }
    if (sheetLink) {
      if (currentSpreadsheetUrl) {
        sheetLink.href = currentSpreadsheetUrl;
        sheetLink.classList.remove('hidden');
      } else {
        sheetLink.classList.add('hidden');
      }
    }
  } else {
    if (statusDot) {
      statusDot.className = 'w-2 h-2 rounded-full bg-brand-muted';
    }
    if (statusLabel) {
      statusLabel.textContent = 'Google Workspace Desconectado';
      statusLabel.className = 'font-chakra font-bold text-brand-pure uppercase text-xs';
    }
    if (statusDesc) {
      statusDesc.textContent = 'Inicia sesión con una cuenta autorizada para activar la sincronización automática en Google Sheets y el despacho por Gmail.';
    }
    if (loginBtn) {
      loginBtn.classList.remove('hidden');
    }
    if (userProfile) {
      userProfile.classList.add('hidden');
    }
  }
}

(window as any).refreshWorkspaceUI = async () => {
  const token = await getAccessToken();
  updateWorkspaceUI(currentUser, token);
};

// Window actions
(window as any).handleGoogleSignIn = async () => {
  // Check if admin is authenticated with master password
  if (sessionStorage.getItem('risknet_ciso_authenticated') !== 'true') {
    (window as any).openAdminWorkspaceModal?.();
    return;
  }

  const loginBtn = document.getElementById('btn-google-login') as HTMLButtonElement | null;
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = `<span>Conectando con Google...</span>`;
  }
  try {
    const result = await googleSignIn();
    if (result) {
      const email = result.user.email?.toLowerCase();
      // Zero Trust Whitelist Validation
      if (!isAuthorizedAdminEmail(email)) {
        await logout();
        currentUser = null;
        updateWorkspaceUI(null, null);
        showAdminSecurityAlert(
          `ACCESO DENEGADO [POLÍTICA ZERO TRUST]: La cuenta "${result.user.email}" NO está autorizada para administrar el sistema. Únicamente las cuentas designadas (aurbina@risknet.us y contactoweltcomm@gmail.com) tienen acceso. Se ha cerrado la sesión.`
        );
        return;
      }

      currentUser = result.user;
      updateWorkspaceUI(result.user, result.accessToken);

      // If there was a pending booking, sync it now!
      if (pendingBookingData) {
        await (window as any).syncBookingWithWorkspace(pendingBookingData);
      }
    }
  } catch (err: any) {
    console.error('Google Sign In failed:', err);
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = `
        <svg class="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
        </svg>
        <span>Conectar con Google</span>
      `;
    }
  }
};

(window as any).handleGoogleSignInAndRetry = async () => {
  if (sessionStorage.getItem('risknet_ciso_authenticated') !== 'true') {
    (window as any).openAdminWorkspaceModal?.();
    return;
  }
  const retryBtn = document.getElementById('btn-workspace-retry-login') as HTMLButtonElement | null;
  if (retryBtn) {
    retryBtn.disabled = true;
    retryBtn.textContent = 'Autenticando con Google...';
  }
  try {
    const result = await googleSignIn();
    if (result) {
      const email = result.user.email?.toLowerCase();
      if (!isAuthorizedAdminEmail(email)) {
        await logout();
        currentUser = null;
        updateWorkspaceUI(null, null);
        showAdminSecurityAlert(
          `ACCESO DENEGADO [POLÍTICA ZERO TRUST]: La cuenta "${result.user.email}" no está autorizada. Se ha cerrado la sesión.`
        );
        return;
      }
      currentUser = result.user;
      updateWorkspaceUI(result.user, result.accessToken);
      if (pendingBookingData) {
        await (window as any).syncBookingWithWorkspace(pendingBookingData);
      }
    }
  } catch (err: any) {
    console.error('Retry Google sign-in failed:', err);
    if (retryBtn) {
      retryBtn.disabled = false;
      retryBtn.textContent = 'Reintentar Conexión con Google';
    }
  }
};

(window as any).handleGoogleSignOut = async () => {
  await logout();
  currentUser = null;
  currentSpreadsheetUrl = null;
  updateWorkspaceUI(null, null);
};

(window as any).openAdminWorkspaceModal = () => {
  const modal = document.getElementById('admin-workspace-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
};

(window as any).closeAdminWorkspaceModal = () => {
  const modal = document.getElementById('admin-workspace-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
};

(window as any).syncBookingWithWorkspace = async (bookingData: any) => {
  pendingBookingData = bookingData;
  const token = await getAccessToken();
  const sheetTelemetry = document.getElementById('telemetry-sheet-info');
  const gmailTelemetry = document.getElementById('telemetry-gmail-info');
  const badge = document.getElementById('telemetry-workspace-badge');

  if (!token) {
    if (badge) {
      badge.textContent = 'PROCESADO';
      badge.className = 'text-[9px] px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold';
    }
    if (sheetTelemetry) {
      sheetTelemetry.innerHTML = `
        <span class="text-brand-emerald font-semibold">✓ Solicitud formalizada y archivada bajo custodia del Enclave CISO</span>
      `;
    }
    if (gmailTelemetry) {
      gmailTelemetry.innerHTML = `<span class="text-brand-silver">Asignada para validación técnica inmediata con el CISO (<strong class="text-brand-pure">aurbina@risknet.us</strong>).</span>`;
    }
    return { success: false, reason: 'unauthenticated' };
  }

  if (badge) {
    badge.textContent = 'PROCESANDO...';
    badge.className = 'text-[9px] px-1.5 py-0.5 bg-brand-cyan/20 border border-brand-cyan/50 text-brand-cyan font-bold';
  }
  if (sheetTelemetry) {
    sheetTelemetry.innerHTML = `<span class="text-brand-cyan animate-pulse">Asentando solicitud en base de datos segura...</span>`;
  }
  if (gmailTelemetry) {
    gmailTelemetry.innerHTML = `<span class="text-brand-cyan animate-pulse">Despachando notificaciones oficiales...</span>`;
  }

  try {
    const res = await fetch('/api/workspace/sync-booking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        booking: {
          ...bookingData,
          spreadsheetId: getSpreadsheetId(),
        },
      }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      pendingBookingData = null; // Cleared on success
      if (data.spreadsheetId) {
        setSpreadsheetId(data.spreadsheetId);
      }
      if (data.spreadsheetUrl) {
        currentSpreadsheetUrl = data.spreadsheetUrl;
        const sheetLink = document.getElementById('workspace-sheet-link') as HTMLAnchorElement | null;
        if (sheetLink) {
          sheetLink.href = data.spreadsheetUrl;
          sheetLink.classList.remove('hidden');
        }
      }

      if (badge) {
        badge.textContent = 'PROCESADO';
        badge.className = 'text-[9px] px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold';
      }

      if (sheetTelemetry) {
        sheetTelemetry.innerHTML = `
          <div class="text-brand-emerald font-semibold mt-1">
            ✓ Solicitud formalizada y registrada en la base de datos de auditoría
          </div>
        `;
      }

      if (gmailTelemetry) {
        let msg = '<div class="space-y-1 mt-1">';
        if (data.clientEmailSent) {
          msg += `<div class="text-brand-emerald">✓ Confirmación oficial despachada a su correo corporativo: <strong class="text-brand-pure">${bookingData.email}</strong></div>`;
        }
        if (data.adminEmailSent) {
          msg += `<div class="text-brand-emerald">✓ Notificación enviada al equipo CISO (<strong class="text-brand-pure">aurbina@risknet.us</strong>)</div>`;
        }
        msg += '</div>';
        gmailTelemetry.innerHTML = msg;
      }

      return { success: true, data };
    } else {
      if (badge) {
        badge.textContent = 'PROCESADO';
        badge.className = 'text-[9px] px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold';
      }
      if (sheetTelemetry) {
        sheetTelemetry.innerHTML = `<span class="text-brand-emerald font-semibold">✓ Solicitud archivada bajo custodia del Enclave CISO</span>`;
      }
      if (gmailTelemetry) {
        gmailTelemetry.innerHTML = `<span class="text-brand-silver">Asignada a revisión técnica prioritaria con el CISO (<strong class="text-brand-pure">aurbina@risknet.us</strong>).</span>`;
      }
      return { success: false, error: data.error };
    }
  } catch (err: any) {
    console.error('Error syncing booking with workspace:', err);
    if (badge) {
      badge.textContent = 'PROCESADO';
      badge.className = 'text-[9px] px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold';
    }
    if (sheetTelemetry) sheetTelemetry.innerHTML = '<span class="text-brand-emerald font-semibold">✓ Solicitud archivada bajo custodia del Enclave CISO</span>';
    if (gmailTelemetry) gmailTelemetry.innerHTML = '<span class="text-brand-silver">Asignada a revisión técnica prioritaria con el CISO (<strong class="text-brand-pure">aurbina@risknet.us</strong>).</span>';
    return { success: false, error: err.message };
  }
};

// Initialize listener on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initAuth(
    (user, token) => {
      const email = user.email?.toLowerCase();
      if (!isAuthorizedAdminEmail(email)) {
        console.warn('Unauthorized Google session detected on startup, terminating session:', email);
        logout();
        currentUser = null;
        updateWorkspaceUI(null, null);
        return;
      }
      currentUser = user;
      updateWorkspaceUI(user, token);
    },
    () => {
      currentUser = null;
      updateWorkspaceUI(null, null);
    }
  );
});
