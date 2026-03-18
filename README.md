# Smart Attendance System

A real-time attendance management system with user registration and login using MongoDB and JWT authentication.

## Prerequisites

- .NET 8+ SDK
- Node.js 18+
- MongoDB (Local or Atlas)

## Setup Instructions

### 1. MongoDB Setup

**Option A: MongoDB Atlas (Cloud - Recommended)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account and cluster
3. Get your connection string (format: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/`)
4. Update `.env` file with your connection string

**Option B: MongoDB Local**
1. Download MongoDB Community Server from https://www.mongodb.com/try/download/community
2. Install and start MongoDB service
3. Default connection: `mongodb://localhost:27017/SmartAttendance`

### 2. Environment Variables

Create a `.env` file in the project root:

```env
MONGO_URI=mongodb://localhost:27017/SmartAttendance
JWT_SECRET=ThisIsAVerySecureKeyForSmartAttendanceSystem12345!
PORT=5000
```

### 3. Run the Backend

```bash
cd backend/SmartAttendance.API
dotnet run
```

### 4. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token

### Users
- `GET /api/users` - Get all users
- `GET /api/users/{id}` - Get user by ID
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user

### Attendance
- `GET /api/attendance` - Get all attendance records
- `POST /api/attendance` - Mark attendance
- `GET /api/attendance/user/{userId}` - Get user attendance

## Database Schema

### Users Collection
```json
{
  "name": "string",
  "email": "string (unique)",
  "password": "string (hashed)",
  "role": "Admin|Employee|Student",
  "department": "string"
}
```

## Features

- Real-time user registration with MongoDB
- JWT-based authentication
- Role-based access control (Admin, Employee, Student)
- Department management
- Prisma-like ORM layer for MongoDB operations
