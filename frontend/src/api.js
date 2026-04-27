import axios from 'axios'

const BASE = 'https://playtoenginebackend-production.up.railway.app/api/v1'

export const api = axios.create({ baseURL: BASE })

export const getMerchants = () => api.get('/merchants/')
export const getBalance = (id) => api.get(`/merchants/${id}/balance/`)
export const getLedger = (id) => api.get(`/merchants/${id}/ledger/`)
export const getPayouts = (id) => api.get(`/merchants/${id}/payouts/`)
export const createPayout = (data, key) =>
  api.post('/payouts/', data, { headers: { 'Idempotency-Key': key } })