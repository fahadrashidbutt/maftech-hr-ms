// src/api.js
// Thin fetch wrapper. Stores the JWT in localStorage and attaches it to requests.
const TOKEN_KEY = 'hris_token';

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(path, { method = 'GET', body, isForm } = {}) {
  const headers = {};
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),

  dashboard: () => request('/'),
  notifications: () => request('/notifications'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  generateNotifications: () => request('/notifications/generate', { method: 'POST' }),

  employees: (q = '') => request(`/employees${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  employee: (id) => request(`/employees/${id}`),
  departments: () => request('/employees/meta/departments'),
  managers: () => request('/employees/meta/managers'),
  teamManagers: () => request('/employees/meta/team-managers'),
  teamMembers: (managerEmpId) => request(`/employees/team/${managerEmpId}`),
  assignManager: (empId, managerId) => request(`/employees/${empId}/assign-manager`, { method: 'PATCH', body: { manager_id: managerId ?? null } }),
  createEmployee: (b) => request('/employees', { method: 'POST', body: b }),
  updateEmployee: (id, b) => request(`/employees/${id}`, { method: 'PUT', body: b }),
  changeEmployeeStatus: (id, status) => request(`/employees/${id}/status`, { method: 'PATCH', body: { employment_status: status } }),

  leave: () => request('/leave'),
  submitLeave: (b) => request('/leave', { method: 'POST', body: b }),
  approveLeave: (id) => request(`/leave/${id}/approve`, { method: 'POST' }),
  rejectLeave: (id, reason) => request(`/leave/${id}/reject`, { method: 'POST', body: { rejection_reason: reason || null } }),
  editLeaveStatus: (id, status, reason, paidStatus) => request(`/leave/${id}`, { method: 'PATCH', body: { status, rejection_reason: reason || null, paid_status: paidStatus || null } }),
  sendToManager: (id, managerId, hrComment) => request(`/leave/${id}/send-to-manager`, { method: 'POST', body: { manager_id: managerId, hr_comment: hrComment || null } }),
  managerReview: (id, decision, comment) => request(`/leave/${id}/manager-review`, { method: 'POST', body: { decision, comment: comment || null } }),
  leaveManagers: () => request('/leave/meta/managers'),
  leaveQuotas: (empId, year) => {
    const p = [];
    if (empId) p.push(`employee_id=${empId}`);
    if (year) p.push(`year=${year}`);
    return request(`/leave/quotas${p.length ? `?${p.join('&')}` : ''}`);
  },
  setLeaveQuota: (empId, type, year, days) => request('/leave/quotas/set', { method: 'POST', body: { employee_id: empId, leave_type: type, year, total_days: days } }),

  docTypes: () => request('/documents/types'),
  documents: (empId) => request(`/documents/employee/${empId}`),
  uploadDocument: (form) => request('/documents', { method: 'POST', body: form, isForm: true }),
  downloadDocUrl: (id) => `/api/documents/${id}/download`,

  // Shifts (HR + super_admin)
  shifts: () => request('/shifts'),
  createShift: (name) => request('/shifts', { method: 'POST', body: { name } }),
  deleteShift: (id) => request(`/shifts/${id}`, { method: 'DELETE' }),

  // Admin (super_admin only)
  adminDepts: () => request('/admin/departments'),
  createDept: (name) => request('/admin/departments', { method: 'POST', body: { name } }),
  deleteDept: (id) => request(`/admin/departments/${id}`, { method: 'DELETE' }),
  adminUsers: () => request('/admin/users'),
  createUser: (b) => request('/admin/users', { method: 'POST', body: b }),
  updateUser: (id, b) => request(`/admin/users/${id}`, { method: 'PATCH', body: b }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),

  jobs: () => request('/recruitment/jobs'),
  createJob: (b) => request('/recruitment/jobs', { method: 'POST', body: b }),
  candidates: (jobId) => request(`/recruitment/candidates${jobId ? `?job_id=${jobId}` : ''}`),
  createCandidate: (form) => request('/recruitment/candidates', { method: 'POST', body: form, isForm: true }),
  updateCandidate: (id, b) => request(`/recruitment/candidates/${id}`, { method: 'PATCH', body: b }),
};
