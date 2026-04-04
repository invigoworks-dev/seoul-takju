import type {
  Material,
  MaterialCategory,
  LedgerEntry,
  LedgerEntryInput,
  DailyReport,
  LeesEntry,
  FirstMashEntry,
  ContainerEntry,
  KojiEntry,
  MashEntry,
  StarterEntry,
  LiquorEntry,
  RawMaterialEntryExtended,
} from './types';
import { authHeaders } from './auth';
import type { User, UserRole } from './auth';

const API_BASE = '/api';

// Map MaterialCategory to backend URL path segment
const categoryToPath: Record<MaterialCategory, string> = {
  raw_material: 'raw-material',
  fermentation_agent: 'fermentation-agent',
  koji: 'koji',
  starter: 'starter',
  mash: 'mash',
  liquor: 'liquor',
};

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Materials API
export const materialsApi = {
  list: (category?: MaterialCategory): Promise<Material[]> => {
    const qs = category ? `?category=${category}` : '';
    return fetchApi(`/materials${qs}`);
  },

  create: (data: Omit<Material, 'id' | 'created_at' | 'updated_at'>): Promise<Material> =>
    fetchApi('/materials', { method: 'POST', body: JSON.stringify(data) }),
};

// Ledger API — backend uses /api/{category-path} not /api/ledger/{category}
export const ledgerApi = {
  list: (
    category: MaterialCategory,
    params?: { date?: string; startDate?: string; endDate?: string; materialId?: number }
  ): Promise<LedgerEntry[]> => {
    const qs = new URLSearchParams();
    // Backend uses 'from'/'to' not 'startDate'/'endDate', and 'material_id' not 'materialId'
    if (params?.date) {
      qs.set('from', params.date);
      qs.set('to', params.date);
    }
    if (params?.startDate) qs.set('from', params.startDate);
    if (params?.endDate) qs.set('to', params.endDate);
    if (params?.materialId) qs.set('material_id', String(params.materialId));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchApi(`/${categoryToPath[category]}${query}`);
  },

  create: (category: MaterialCategory, data: LedgerEntryInput): Promise<LedgerEntry> =>
    fetchApi(`/${categoryToPath[category]}`, { method: 'POST', body: JSON.stringify(data) }),

  update: (
    category: MaterialCategory,
    id: number,
    data: Partial<LedgerEntryInput>
  ): Promise<LedgerEntry> =>
    fetchApi(`/${categoryToPath[category]}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (category: MaterialCategory, id: number): Promise<void> =>
    fetchApi(`/${categoryToPath[category]}/${id}`, { method: 'DELETE' }),
};

// Dashboard API — backend uses /api/daily-status not /api/dashboard/daily-report
export const dashboardApi = {
  getDailyReport: (date: string): Promise<DailyReport> =>
    fetchApi(`/daily-status?date=${date}`),

  getMonthlySummary: (year: number, month: number): Promise<Record<string, unknown>> =>
    fetchApi(`/daily-status/monthly-summary?year=${year}&month=${month}`),

  getInventory: (): Promise<Record<string, unknown>> =>
    fetchApi('/daily-status/inventory'),

  inventorySummary: (to: string): Promise<Record<string, unknown>> =>
    fetchApi(`/daily-status/inventory/summary?to=${to}`),

  inventoryHistory: (item: string, from: string, to: string): Promise<Record<string, unknown>> =>
    fetchApi(`/daily-status/inventory/history/${encodeURIComponent(item)}?from=${from}&to=${to}`),
};

// User Management API (admin only)
export const usersApi = {
  list: (): Promise<User[]> =>
    fetchApi('/users'),

  invite: (email: string, role: UserRole): Promise<{ invitation: { token: string }; invite_link: string }> =>
    fetchApi('/users/invite', { method: 'POST', body: JSON.stringify({ email, role }) }),

  updateRole: (userId: string, role: UserRole): Promise<User> =>
    fetchApi(`/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),

  // Backend uses DELETE for deactivation (soft-delete)
  deactivate: (userId: string): Promise<{ message: string; user: User }> =>
    fetchApi(`/users/${userId}`, { method: 'DELETE' }),

  // Backend uses PATCH to reactivate
  activate: (userId: string): Promise<User> =>
    fetchApi(`/users/${userId}/activate`, { method: 'PATCH' }),
};

// Lees (술지거미) API
export const leesApi = {
  list: (params?: { from?: string; to?: string }): Promise<LeesEntry[]> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/lees${query}`);
  },
  create: (data: Partial<LeesEntry>): Promise<LeesEntry> =>
    fetchApi('/lees', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<LeesEntry>): Promise<LeesEntry> =>
    fetchApi(`/lees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number): Promise<void> =>
    fetchApi(`/lees/${id}`, { method: 'DELETE' }),
};

// First Mash (1차 술덧) API
export const firstMashApi = {
  list: (params?: { from?: string; to?: string }): Promise<FirstMashEntry[]> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/first-mash${query}`);
  },
  create: (data: Partial<FirstMashEntry>): Promise<FirstMashEntry> =>
    fetchApi('/first-mash', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<FirstMashEntry>): Promise<FirstMashEntry> =>
    fetchApi(`/first-mash/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number): Promise<void> =>
    fetchApi(`/first-mash/${id}`, { method: 'DELETE' }),
};

// Container (용기/마개) API
export const containerApi = {
  list: (params?: { from?: string; to?: string; container_type?: string }): Promise<ContainerEntry[]> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.container_type) qs.set('container_type', params.container_type);
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/container${query}`);
  },
  create: (data: Partial<ContainerEntry>): Promise<ContainerEntry> =>
    fetchApi('/container', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<ContainerEntry>): Promise<ContainerEntry> =>
    fetchApi(`/container/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number): Promise<void> =>
    fetchApi(`/container/${id}`, { method: 'DELETE' }),
};

// ── 도메인 특화 API ──────────────────────────────────────

// 입국 수불 API
export const kojiApi = {
  list: (params?: { from?: string; to?: string }): Promise<KojiEntry[]> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/koji${query}`);
  },
  create: (data: Partial<KojiEntry>): Promise<KojiEntry> =>
    fetchApi('/koji', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<KojiEntry>): Promise<KojiEntry> =>
    fetchApi(`/koji/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number): Promise<void> =>
    fetchApi(`/koji/${id}`, { method: 'DELETE' }),
};

// 술덧담금 API
export const mashApi = {
  list: (params?: { from?: string; to?: string }): Promise<MashEntry[]> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/mash${query}`);
  },
  create: (data: Partial<MashEntry>): Promise<MashEntry> =>
    fetchApi('/mash', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<MashEntry>): Promise<MashEntry> =>
    fetchApi(`/mash/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number): Promise<void> =>
    fetchApi(`/mash/${id}`, { method: 'DELETE' }),
};

// 밑술 제조 API
export const starterApi = {
  list: (params?: { from?: string; to?: string }): Promise<StarterEntry[]> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/starter${query}`);
  },
  create: (data: Partial<StarterEntry>): Promise<StarterEntry> =>
    fetchApi('/starter', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<StarterEntry>): Promise<StarterEntry> =>
    fetchApi(`/starter/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number): Promise<void> =>
    fetchApi(`/starter/${id}`, { method: 'DELETE' }),
};

// 주류 수불 API
export const liquorApi = {
  list: (params?: { from?: string; to?: string }): Promise<LiquorEntry[]> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/liquor${query}`);
  },
  create: (data: Partial<LiquorEntry>): Promise<LiquorEntry> =>
    fetchApi('/liquor', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<LiquorEntry>): Promise<LiquorEntry> =>
    fetchApi(`/liquor/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number): Promise<void> =>
    fetchApi(`/liquor/${id}`, { method: 'DELETE' }),
};

// 원료 수불 API (material_id 기반)
export const rawMaterialExtApi = {
  list: (params?: { from?: string; to?: string; material_id?: number }): Promise<RawMaterialEntryExtended[]> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.material_id) qs.set('material_id', String(params.material_id));
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/raw-material${query}`);
  },
  create: (data: Partial<RawMaterialEntryExtended>): Promise<RawMaterialEntryExtended> =>
    fetchApi('/raw-material', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<RawMaterialEntryExtended>): Promise<RawMaterialEntryExtended> =>
    fetchApi(`/raw-material/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number): Promise<void> =>
    fetchApi(`/raw-material/${id}`, { method: 'DELETE' }),
};

// Excel Import/Export API
export const excelApi = {
  import: async (ledgerType: string, file: File): Promise<{
    message: string;
    total: number;
    inserted: number;
    skipped: number;
    failed: number;
    errors?: { row: number; error: string }[];
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/ledgers/${ledgerType}/import`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: formData,
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  exportUrl: (ledgerType: string, from?: string, to?: string): string => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const query = qs.toString() ? `?${qs}` : '';
    return `${API_BASE}/ledgers/${ledgerType}/export${query}`;
  },

  uploadLogs: (ledgerType?: string): Promise<Array<{
    id: number;
    ledger_type: string;
    filename: string;
    rows_total: number;
    rows_inserted: number;
    rows_skipped: number;
    rows_failed: number;
    errors: string;
    uploader_name: string;
    created_at: string;
  }>> => {
    const qs = ledgerType ? `?ledger_type=${ledgerType}` : '';
    return fetchApi(`/ledgers/upload-logs${qs}`);
  },
};

// Monthly Close API
export const monthlyCloseApi = {
  list: (): Promise<Array<{
    id: number;
    year_month: string;
    closed_by: string;
    closed_by_name: string;
    closed_at: string;
    notes?: string;
  }>> => fetchApi('/monthly-close'),

  check: (yearMonth: string): Promise<{ closed: boolean; data: unknown }> =>
    fetchApi(`/monthly-close/${yearMonth}`),

  close: (yearMonth: string, notes?: string): Promise<unknown> =>
    fetchApi('/monthly-close', {
      method: 'POST',
      body: JSON.stringify({ year_month: yearMonth, notes }),
    }),

  open: (yearMonth: string): Promise<void> =>
    fetchApi(`/monthly-close/${yearMonth}`, { method: 'DELETE' }),
};

// Approval Workflow API
export interface Approval {
  id: number;
  ledger_type: string;
  record_id: number;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: string;
  requester_name: string;
  requester_email: string;
  approved_by: string | null;
  approver_name: string | null;
  reason: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export const approvalsApi = {
  list: (params?: { status?: string; ledger_type?: string; record_ids?: number[] }): Promise<Approval[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.ledger_type) qs.set('ledger_type', params.ledger_type);
    if (params?.record_ids?.length) qs.set('record_ids', params.record_ids.join(','));
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/approvals${query}`);
  },

  request: (ledgerType: string, recordId: number): Promise<Approval> =>
    fetchApi('/approvals/request', { method: 'POST', body: JSON.stringify({ ledger_type: ledgerType, record_id: recordId }) }),

  approve: (id: number): Promise<Approval> =>
    fetchApi(`/approvals/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'approve' }) }),

  reject: (id: number, reason: string): Promise<Approval> =>
    fetchApi(`/approvals/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'reject', reason }) }),
};

// Settings API
export interface CompanyInfo {
  id?: number;
  name: string;
  address: string;
  phone: string;
  license_no: string;
  updated_at?: string;
}

export interface PrevBalance {
  id?: number;
  category: string;
  amount: number;
  balance_date?: string | null;
  updated_at?: string;
}

export const settingsApi = {
  getCompany: (): Promise<CompanyInfo> =>
    fetchApi('/settings/company'),

  putCompany: (data: Omit<CompanyInfo, 'id' | 'updated_at'>): Promise<CompanyInfo> =>
    fetchApi('/settings/company', { method: 'PUT', body: JSON.stringify(data) }),

  getPrevBalance: (): Promise<PrevBalance[]> =>
    fetchApi('/settings/prev-balance'),

  putPrevBalance: (category: string, amount: number, balance_date?: string): Promise<PrevBalance> =>
    fetchApi(`/settings/prev-balance/${encodeURIComponent(category)}`, {
      method: 'PUT',
      body: JSON.stringify({ amount, balance_date: balance_date ?? null }),
    }),
};

// Persons API
export interface Person {
  id: number;
  name: string;
  role?: string;
  active: boolean;
  created_at: string;
}

export const personsApi = {
  list: (): Promise<Person[]> =>
    fetchApi('/settings/persons'),

  create: (name: string, role?: string): Promise<Person> =>
    fetchApi('/settings/persons', { method: 'POST', body: JSON.stringify({ name, role }) }),

  delete: (id: number): Promise<void> =>
    fetchApi(`/settings/persons/${id}`, { method: 'DELETE' }),
};

// Invite API — backend uses /api/auth/accept-invite
export const inviteApi = {
  verify: (token: string): Promise<{ email: string; role: UserRole }> =>
    fetchApi(`/auth/verify-invite?token=${token}`),

  accept: (token: string, name: string, password: string): Promise<{ token: string; user: User }> =>
    fetchApi('/auth/accept-invite', { method: 'POST', body: JSON.stringify({ token, name, password }) }),
};
