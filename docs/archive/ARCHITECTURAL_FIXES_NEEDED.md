# 🏗️ Architectural Issues - Action Plan

**Identified by:** System Review Agent  
**Priority:** After deployment of current fixes  
**Estimated Total Time:** 2 hours

---

## 🔴 HIGH Priority (Deploy Today)

### 1. Webhook Signature Validation (5 min)

**Issue:** Helius webhook signature validation can be skipped  
**Risk:** Fake trades could be injected  
**Impact:** HIGH - compromises leaderboard integrity

**Fix:**
```typescript
// src/routes/webhooks.ts
const isProduction = process.env.NODE_ENV === 'production';
const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;

if (isProduction && !webhookSecret) {
  throw new Error('HELIUS_WEBHOOK_SECRET required in production');
}

if (!verifySignature(signature, webhookSecret)) {
  return c.json({ error: 'Invalid signature' }, 403);
}
```

**Deploy:**
```bash
cd backend
# Add to .env (Railway):
HELIUS_WEBHOOK_SECRET=your-secret-from-helius-dashboard

# Push change
git add src/routes/webhooks.ts
git commit -m "security: enforce webhook signature validation in production"
git push origin main
```

---

## 🟡 MEDIUM Priority (This Week)

### 2. PrismaClient Singleton (30 min)

**Issue:** 20+ PrismaClient instances created across files  
**Risk:** Connection pool exhaustion (default: 10 connections)  
**Impact:** MEDIUM - could cause DB connection errors under load

**Current State:**
```typescript
// Every file doing this:
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

**Fix:**
```typescript
// src/lib/db.ts (create this)
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Then replace all:**
```bash
# Find all files with PrismaClient
grep -r "new PrismaClient" src/

# Replace with:
import { prisma } from '../lib/db';
```

**Files to update:** ~20  
**Benefit:** Reduces DB connections from 20+ to 1

---

### 3. CORS Restriction (10 min)

**Issue:** CORS effectively allows any origin  
**Risk:** CSRF attacks, unauthorized API access  
**Impact:** MEDIUM - security vulnerability

**Current:**
```typescript
cors({
  origin: (origin) => origin || '*',  // ❌ Bad!
  credentials: true,
})
```

**Fix:**
```typescript
const ALLOWED_ORIGINS = [
  'https://www.supermolt.xyz',
  'https://supermolt.xyz',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean);

cors({
  origin: (origin) => {
    if (!origin) return false;  // Block requests with no origin
    return ALLOWED_ORIGINS.includes(origin);
  },
  credentials: true,
})
```

**Deploy:**
```bash
git add src/index.ts
git commit -m "security: restrict CORS to known origins"
git push origin main
```

---

### 4. Frontend Token Refresh (20 min)

**Issue:** No automatic token refresh interceptor  
**Risk:** Silent 401s after 15 minutes  
**Impact:** MEDIUM - bad UX (users randomly signed out)

**Fix:**
```typescript
// web/lib/api.ts
import { getAuthToken, refreshAuthToken } from '../store/authStore';

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const newToken = await refreshAuthToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, sign out
        clearAuth();
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

---

## 🟢 LOW Priority (Next Sprint)

### 5. Concurrency Limiter (15 min)

**Issue:** Unbounded parallel API calls in some loops  
**Risk:** Rate limiting, API throttling  
**Impact:** LOW - only affects bulk operations

**Fix:**
```typescript
// lib/utils/concurrency.ts
export async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  
  return results;
}
```

**Use in:**
- Observer agent loops
- Bulk task creation
- Batch API calls

---

## 📋 Deployment Order

**Today (before end of day):**
1. ✅ Deploy current 9 bug fixes + XP system
2. 🔴 Add webhook signature enforcement (5 min)

**This Week:**
3. 🟡 Migrate to PrismaClient singleton (30 min)
4. 🟡 Restrict CORS to known origins (10 min)
5. 🟡 Add frontend token refresh interceptor (20 min)

**Next Sprint:**
6. 🟢 Add concurrency limiter to bulk operations (15 min)

---

## ✅ Success Metrics

**After all fixes:**
- ✅ 0 critical security vulnerabilities
- ✅ Stable DB connections (1 pool vs 20+)
- ✅ Auth never expires silently
- ✅ CORS properly restricted
- ✅ Webhook tampering impossible

---

**Total effort:** ~2 hours  
**Impact:** Production-ready security + stability  
**Priority:** High (#1 today, #2-5 this week)
