# Smart Attendance System - Deployment Guide

This guide will help you deploy your Smart Attendance System on Render.com correctly.

## ⚠️ Important Fix: Change from Node to Docker

You mistakenly selected **Node** as the runtime for your backend. Since Render doesn't natively support .NET, you need to use **Docker** instead.

---

## Prerequisites

1. **MongoDB Atlas Account** - For cloud database
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free account and cluster
   - Get your connection string

2. **GitHub/GitLab Repository** - Render needs to connect to your repo

---

## Step 1: MongoDB Atlas Setup

1. Create a free cluster on MongoDB Atlas
2. Create a database user (username/password)
3. Add your IP to the access list (use `0.0.0.0/0` for anywhere access in development)
4. Get your connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/
   ```
5. Replace `<username>` and `<password>` with your credentials

---

## Step 2: Deploy Backend (Docker)

### Render Configuration for Backend

1. **Create a new Web Service** on Render
2. **Settings:**
   | Setting | Value |
   |---------|-------|
   | Name | smart-attendance-api |
   | Language | **Docker** (NOT Node!) |
   | Branch | master |
   | Root Directory | `backend/SmartAttendance.API` |
   | Build Command | (leave empty - handled by Docker) |
   | Start Command | (leave empty - handled by Docker) |

3. **Environment Variables** (in Render dashboard):
   | Variable | Value |
   |----------|-------|
   | `MONGO_URI` | Your MongoDB Atlas connection string |
   | `JWT_SECRET` | A strong random string (min 32 chars) |
   | `PORT` | `5000` |

4. Click **Create Web Service**

### Files Created for Backend

- ✅ `Dockerfile` - Multi-stage build for .NET 10
- ✅ `.dockerignore` - Excludes unnecessary files
- ✅ Updated `Program.cs` - Listens on 0.0.0.0:5000

---

## Step 3: Deploy Frontend (Node.js)

### Render Configuration for Frontend

1. **Create a new Web Service** on Render
2. **Settings:**
   | Setting | Value |
   |---------|-------|
   | Name | smart-attendance-frontend |
   | Language | **Node** |
   | Branch | master |
   | Root Directory | `frontend` |
   | Build Command | `npm run build` |
   | Start Command | `npm run preview` |

3. **Environment Variables**:
   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | Your backend URL (e.g., `https://smart-attendance-api.onrender.com/api`) |

4. Click **Create Web Service**

### Frontend Updates Made

- ✅ Updated `frontend/src/utils/api.js` to use environment variables

---

## Environment Variables Reference

### Backend (Docker)
```
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/SmartAttendance
JWT_SECRET=YourSuperSecretKey12345678901234567890
PORT=5000
ASPNETCORE_ENVIRONMENT=Production
```

### Frontend (Node)
```
VITE_API_URL=https://your-backend-service.onrender.com/api
```

---

## Files Modified/Created

### Backend
| File | Purpose |
|------|---------|
| `backend/SmartAttendance.API/Dockerfile` | Multi-stage Docker build |
| `backend/SmartAttendance.API/.dockerignore` | Excludes build artifacts |
| `backend/SmartAttendance.API/Program.cs` | Updated for Render deployment |

### Frontend
| File | Purpose |
|------|---------|
| `frontend/src/utils/api.js` | Uses VITE_API_URL env variable |

---

## Common Deployment Mistakes and Fixes

### Mistake 1: Selecting Node for .NET Backend
**Problem:** You selected Node as the runtime for ASP.NET Core
**Fix:** Delete the service and recreate with **Docker** as the language

### Mistake 2: Not Setting PORT Environment Variable
**Problem:** App fails to start
**Fix:** Set `PORT=5000` in Render environment variables

### Mistake 3: Wrong Root Directory
**Problem:** Docker build fails, can't find Dockerfile
**Fix:** Set Root Directory to `backend/SmartAttendance.API`

### Mistake 4: MongoDB Connection Issues
**Problem:** Can't connect to MongoDB Atlas
**Fix:** 
- Ensure IP is whitelisted (0.0.0.0/0 for testing)
- Check username/password in connection string
- Verify cluster is running (not paused)

### Mistake 5: Frontend Can't Connect to Backend
**Problem:** CORS errors or connection refused
**Fix:**
- Set `VITE_API_URL` in frontend environment variables
- Ensure backend CORS allows all origins

### Mistake 6: JWT Secret Too Short
**Problem:** Authentication failures
**Fix:** Use a JWT_SECRET of at least 32 characters

---

## Testing Your Deployment

1. **Backend Health Check:**
   ```
   https://your-backend.onrender.com/health
   ```
   Should return: `{"status":"healthy","timestamp":"..."}`

2. **API Endpoints:**
   ```
   POST https://your-backend.onrender.com/api/auth/register
   POST https://your-backend.onrender.com/api/auth/login
   ```

3. **Frontend:**
   Visit `https://your-frontend.onrender.com`

---

## Architecture Overview

```
                    ┌─────────────────┐
                    │  MongoDB Atlas  │
                    │   (Database)    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Render Docker  │
                    │   (Backend)     │
                    │  Port 5000      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Render Node   │
                    │   (Frontend)    │
                    └─────────────────┘
```

---

## Troubleshooting Commands

### Test MongoDB Connection Locally
```bash
mongosh "mongodb+srv://<connection-string>"
```

### Test API Locally
```bash
curl http://localhost:5000/health
```

### Build Docker Image Locally
```bash
cd backend/SmartAttendance.API
docker build -t smart-attendance .
docker run -p 5000:5000 -e MONGO_URI="your-mongo-uri" -e JWT_SECRET="your-secret" smart-attendance
```

### View Docker Logs on Render
Check the **Logs** tab in Render dashboard for deployment and runtime logs.

---

## Security Notes

1. ✅ Run container as non-root user
2. ✅ Use environment variables for secrets (not in code)
3. ✅ Disable HTTPS redirection in container (Render handles SSL)
4. ✅ Use strong JWT_SECRET (32+ characters)
5. ⚠️ In production, restrict CORS to specific domains instead of `AllowAnyOrigin`

---

## Next Steps After Deployment

1. Update your frontend's `VITE_API_URL` when backend URL is assigned
2. Test user registration and login
3. Verify attendance marking works
4. Check MongoDB Atlas for data being stored

---

## Support

If you encounter issues:
1. Check Render logs in dashboard
2. Verify all environment variables are set
3. Ensure MongoDB Atlas cluster is running
4. Check Docker image builds locally first
