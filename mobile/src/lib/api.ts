import { useSession } from './session';
import type { Capture, Dashboard, PaymentOverview, Reminder, Trip, TripBooking, TripChecklistItem, User } from './types';
import { Platform } from 'react-native';

const origin = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const apiRoot = `${origin}/api/v1`;

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = useSession.getState().refreshToken;
  if (!refreshToken) return false;
  refreshInFlight = (async () => {
    const response = await fetch(`${apiRoot}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) {
      useSession.getState().clearSession();
      return false;
    }
    const session = await response.json() as { access_token: string; refresh_token: string; user: User };
    useSession.getState().setSession(session.access_token, session.user, session.refresh_token);
    return true;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function fetchWithSession(path: string, init: RequestInit = {}): Promise<Response> {
  const perform = () => {
    const headers = new Headers(init.headers);
    const token = useSession.getState().token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    return fetch(`${apiRoot}${path}`, { ...init, headers });
  };
  let response: Response;
  try {
    response = await perform();
  } catch {
    throw new Error(`Can’t reach PINGO. Check the API address (${origin}) and try again.`);
  }
  if (response.status === 401 && !path.startsWith('/auth/')) {
    let refreshed = false;
    try { refreshed = await refreshSession(); }
    catch { throw new Error('Your session could not be refreshed. Check your connection and try again.'); }
    if (refreshed) response = await perform();
  }
  return response;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchWithSession(path, init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') message = body.detail;
      if (Array.isArray(body.detail)) message = body.detail.map((item: { msg?: string }) => item.msg).join('\n');
    } catch {
      // Keep the status message when an error response has no JSON body.
    }
    if (response.status === 401 && !path.startsWith('/auth/')) useSession.getState().clearSession();
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string; user: User }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string; user: User }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  dashboard: () => request<Dashboard>('/dashboard'),
  updateTimezone: (timezone: string) => request<User>('/me', { method: 'PATCH', body: JSON.stringify({ timezone }) }),
  updateExternalAiConsent: (ai_external_consent: boolean) => request<User>('/me', { method: 'PATCH', body: JSON.stringify({ ai_external_consent }) }),
  captures: (q = '') => request<Capture[]>(`/captures${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  search: (q: string) => request<{ captures: Capture[]; reminders: Reminder[]; trips: Trip[] }>(`/search?q=${encodeURIComponent(q)}`),
  capture: (id: string) => request<Capture>(`/captures/${id}`),
  understandCapture: (id: string) => request<Capture>(`/captures/${id}/understand`, { method: 'POST' }),
  createCapture: (payload: { title: string; kind: 'note' | 'link'; body: string; source_url?: string }) =>
    request<Capture>('/captures', { method: 'POST', body: JSON.stringify(payload) }),
  uploadCapture: (form: FormData) => request<Capture>('/captures/upload', { method: 'POST', body: form }),
  updateCapture: (id: string, payload: { title?: string; body?: string }) =>
    request<Capture>(`/captures/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteCapture: (id: string) => request<void>(`/captures/${id}`, { method: 'DELETE' }),
  reminders: (kind?: string, includeCompleted = false) => {
    const params = new URLSearchParams();
    if (kind) params.set('kind', kind);
    if (includeCompleted) params.set('include_completed', 'true');
    const query = params.toString();
    return request<Reminder[]>(`/reminders${query ? `?${query}` : ''}`);
  },
  createReminder: (payload: {
    capture_id?: string; trip_id?: string; title: string; note: string; kind: Reminder['kind']; due_at: string;
    amount?: number; currency?: string; recurrence?: Reminder['recurrence']; reminder_offsets_minutes?: number[];
  }) => request<Reminder>('/reminders', { method: 'POST', body: JSON.stringify(payload) }),
  paymentOverview: () => request<PaymentOverview>('/payments/overview'),
  registerPushDevice: (payload: { device_id: string; expo_push_token: string; platform: 'android' | 'ios'; show_details?: boolean }) =>
    request<{ registered: boolean; device_id: string }>('/push/devices', { method: 'PUT', body: JSON.stringify(payload) }),
  unregisterPushDevice: (deviceId: string) => request<void>(`/push/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }),
  notificationStatus: () => request<{ push_devices: number; pending: number; failed: number }>('/notifications/status'),
  logout: () => {
    const refreshToken = useSession.getState().refreshToken;
    return refreshToken
      ? request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) })
      : Promise.resolve();
  },
  completeReminder: (payload: { id: string; due_at: string }) =>
    request<Reminder>(`/reminders/${encodeURIComponent(payload.id)}/complete`, { method: 'POST', body: JSON.stringify({ due_at: payload.due_at }) }),
  updateReminder: (id: string, payload: {
    title?: string; note?: string; due_at?: string; status?: 'active' | 'archived';
    recurrence?: Reminder['recurrence']; amount?: number | null; currency?: string | null; reminder_offsets_minutes?: number[];
  }) => request<Reminder>(`/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  snoozeReminder: (id: string, minutes = 1440) =>
    request<Reminder>(`/reminders/${id}/snooze?minutes=${minutes}`, { method: 'POST' }),
  trips: () => request<Trip[]>('/trips'),
  trip: (id: string) => request<Trip>(`/trips/${encodeURIComponent(id)}`),
  createTrip: (payload: { title: string; destination: string; starts_at: string; ends_at: string; timezone: string; notes?: string }) =>
    request<Trip>('/trips', { method: 'POST', body: JSON.stringify(payload) }),
  createTripBooking: (tripId: string, payload: {
    kind: TripBooking['kind']; title: string; capture_id?: string; confirmation_reference?: string;
    departure_at?: string; arrival_at?: string; departure_timezone?: string; arrival_timezone?: string;
    from_location?: string; to_location?: string; notes?: string;
  }) => request<TripBooking>(`/trips/${encodeURIComponent(tripId)}/bookings`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteTripBooking: (tripId: string, bookingId: string) =>
    request<void>(`/trips/${encodeURIComponent(tripId)}/bookings/${encodeURIComponent(bookingId)}`, { method: 'DELETE' }),
  createTripChecklistItem: (tripId: string, payload: { title: string; category: TripChecklistItem['category'] }) =>
    request<TripChecklistItem>(`/trips/${encodeURIComponent(tripId)}/checklist`, { method: 'POST', body: JSON.stringify(payload) }),
  updateTripChecklistItem: (tripId: string, itemId: string, completed: boolean) =>
    request<TripChecklistItem>(`/trips/${encodeURIComponent(tripId)}/checklist/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: JSON.stringify({ completed }) }),
  deleteTripChecklistItem: (tripId: string, itemId: string) =>
    request<void>(`/trips/${encodeURIComponent(tripId)}/checklist/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),
  deleteTrip: (tripId: string) => request<void>(`/trips/${encodeURIComponent(tripId)}`, { method: 'DELETE' }),
  openAttachment: async (path: string, filename: string, contentType: string | null) => {
    const response = await fetchWithSession(path);
    if (!response.ok) throw new Error(`Could not open the private file (${response.status})`);
    const blob = await response.blob();
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    const [{ File, Paths }, Sharing] = await Promise.all([import('expo-file-system'), import('expo-sharing')]);
    const file = new File(Paths.cache, filename);
    if (file.exists) file.delete();
    file.create();
    await file.write(new Uint8Array(await blob.arrayBuffer()));
    if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
    await Sharing.shareAsync(file.uri, { dialogTitle: 'Open private PINGO document', mimeType: contentType || 'application/octet-stream' });
  },
  deleteAccount: (password: string) => request<void>('/me', { method: 'DELETE', body: JSON.stringify({ password }) }),
  exportAccount: async () => {
    const response = await fetchWithSession('/me/export');
    if (!response.ok) throw new Error(`Could not prepare your export (${response.status})`);
    if (Platform.OS === 'web') {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pingo-export.zip';
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    const [{ File, Paths }, Sharing] = await Promise.all([import('expo-file-system'), import('expo-sharing')]);
    const file = new File(Paths.cache, 'pingo-export.zip');
    if (file.exists) file.delete();
    file.create();
    await file.write(new Uint8Array(await response.arrayBuffer()));
    if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
    await Sharing.shareAsync(file.uri, { dialogTitle: 'Export your PINGO data', mimeType: 'application/zip' });
  },
};

export function attachmentUrl(path: string | null) {
  return path ? `${origin}${path}` : null;
}

