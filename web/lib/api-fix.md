# Frontend API Endpoint Fixes

## Issues Found (Feb 5, 2026 - 16:50)

### 1. Wrong API Endpoints
Current `lib/api.ts` is calling endpoints that don't exist:

**Broken Calls:**
- `/leaderboard` → Backend has `/api/leaderboard`
- `/feed/positions/all` → Backend has `/positions/all`  
- `/agents/{id}` → Backend has `/agents/{id}` ✅
- `/trades/{agentId}` → Backend has `/trades/{agentId}` ✅
- `/agents/conversations` → Needs verification
- `/agents/votes/active` → Exists but requires JWT (401 errors)

### 2. Login Redirect Loop
- 401 errors redirect to `/login`
- But `/login` page doesn't exist (404)
- Creates infinite redirect loop

### 3. Backend Route Structure
From `SR-Mobile/backend/src/index.ts`:

```typescript
// USDC Hackathon Routes (Standardized Modules)
app.route('/api/treasury', treasury);
app.route('/api/leaderboard', leaderboard);
app.route('/api/epochs', epochs);
app.route('/api/calls', calls);

// Other routes
app.route('/positions', positions); // /positions/all endpoint
app.route('/agents', agent); // /agents/* endpoints  
app.route('/agents/votes', voting); // /agents/votes/active
```

## Fixes Required

### Fix 1: Update API Endpoints
Edit `SR-Mobile/web/lib/api.ts`:

```typescript
// Leaderboard
export async function getLeaderboard(): Promise<Agent[]> {
  try {
    const response = await api.get<LeaderboardResponse>('/api/leaderboard'); // ADD /api prefix
    return response.data.leaderboard || [];
  } catch (error) {
    console.warn('API unavailable, using mock data for leaderboard');
    return generateMockAgents();
  }
}

// Get all positions  
export async function getAllPositions(): Promise<Position[]> {
  try {
    const response = await api.get<PositionsResponse>('/positions/all'); // REMOVE /feed prefix
    return response.data.positions || [];
  } catch (error) {
    console.warn('API unavailable, using mock data for all positions');
    return generateMockPositions();
  }
}
```

### Fix 2: Better 401 Error Handling
Edit `SR-Mobile/web/lib/api.ts`:

```typescript
// Response interceptor: Handle errors & token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      tokenManager.clearToken();
      console.warn('Authentication required - using public/mock data');
      // DON'T REDIRECT - let pages show mock data instead
      // if (typeof window !== 'undefined') {
      //   window.location.href = '/login';
      // }
    }
    console.error('API Error:', error.message);
    throw error; // Let individual API calls handle fallback to mock data
  }
);
```

### Fix 3: Optional - Create Login Page
Create `SR-Mobile/web/app/login/page.tsx`:

```typescript
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Login Coming Soon</h1>
        <p className="text-gray-600">
          Public leaderboard and tape available without login.
          <br />
          Agent registration will be available soon!
        </p>
        <a href="/" className="mt-8 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg">
          Back to Homepage
        </a>
      </div>
    </div>
  );
}
```

## Testing After Fixes

1. **Leaderboard:** Should load data from `/api/leaderboard` or show mock data
2. **Positions:** Should load from `/positions/all` or show mock data  
3. **Votes:** 401 errors should fallback to mock data (not redirect)
4. **No more 404s** on API calls

## Deploy

```bash
cd ~/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/SR-Mobile/web
git add .
git commit -m "fix: update API endpoints to match backend routes"
git push origin main
# Vercel auto-deploys
```
