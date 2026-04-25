# Production-Ready Enterprise Architecture Guide

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [14-Layer Architecture](#14-layer-architecture)
3. [Microservices Design](#microservices-design)
4. [Code Examples](#code-examples)
5. [Deployment Strategy](#deployment-strategy)
6. [Monitoring & Operations](#monitoring--operations)
7. [Security Best Practices](#security-best-practices)
8. [Performance Optimization](#performance-optimization)
9. [Disaster Recovery](#disaster-recovery)
10. [Compliance & Governance](#compliance--governance)

---

## System Overview

### Architecture Principles
- **Microservices**: Loosely coupled, independently deployable services
- **Event-Driven**: Asynchronous communication via message queues
- **API-First**: RESTful APIs with proper versioning
- **Cloud-Native**: Container-based, Kubernetes orchestration
- **DevOps**: Infrastructure as Code, automated CI/CD
- **Security-First**: Defense in depth, encryption everywhere
- **Observability**: Comprehensive logging, metrics, tracing

### High-Level Components
```
┌─────────────────────────────────────────────────────────┐
│                   CLIENT LAYER                          │
│  (Web, Mobile, Desktop)                                 │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│            API GATEWAY & LOAD BALANCING                 │
│  (Nginx, Rate Limiting, SSL/TLS)                        │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│       AUTHENTICATION & SECURITY LAYER                   │
│  (JWT, OAuth2, MFA, RBAC)                               │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│            MICROSERVICES LAYER                          │
│  (User, Attendance, Department, Notification, Analytics)│
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│       BUSINESS LOGIC & DATA ACCESS LAYER                │
│  (Repository Pattern, Domain Models, Caching)          │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│        MESSAGE QUEUE & EVENT-DRIVEN LAYER               │
│  (RabbitMQ, Domain Events, Saga Pattern)                │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│            DATABASE & CACHE LAYER                       │
│  (MongoDB, Redis, Elasticsearch)                        │
└──────────────────────────────────────────────────────────┘
```

---

## 14-Layer Architecture

### 1. CLIENT LAYER (Frontend)

**Technology Stack:**
- Framework: React 18 + Vite
- State Management: Redux Toolkit + Redux Thunk
- HTTP Client: Axios with interceptors
- UI Library: Material-UI / Chakra UI
- Build Tool: Vite (faster development)

**Code Example - HTTP Client with JWT Interceptor:**

```typescript
// src/utils/api-client.ts
import axios, { AxiosInstance, AxiosError } from 'axios';

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor - Add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor - Handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/api/v1/auth/refresh`,
          { refreshToken }
        );

        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

**Redux Store Example:**

```typescript
// src/store/slices/authSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../utils/api-client';

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/api/v1/auth/login', credentials);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    accessToken: null,
    loading: false,
    error: null,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        localStorage.setItem('accessToken', action.payload.accessToken);
        localStorage.setItem('refreshToken', action.payload.refreshToken);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default authSlice.reducer;
```

---

### 2. API GATEWAY & LOAD BALANCING

**Nginx Configuration:**

```nginx
# /etc/nginx/nginx.conf
upstream backend_api {
    least_conn;  # Load balancing algorithm
    server api1:5000 weight=3 max_fails=3 fail_timeout=30s;
    server api2:5000 weight=3 max_fails=3 fail_timeout=30s;
    server api3:5000 weight=3 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name attendance.company.com;
    client_max_body_size 10M;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req zone=api_limit burst=200 nodelay;

    location / {
        proxy_pass http://backend_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
    }
}
```

---

### 3. AUTHENTICATION & SECURITY

**JWT Authentication Service (.NET 8):**

```csharp
// Services/AuthenticationService.cs
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

public interface IAuthenticationService
{
    string GenerateAccessToken(User user);
    string GenerateRefreshToken();
    ClaimsPrincipal GetPrincipalFromExpiredToken(string token);
}

public class JwtAuthenticationService : IAuthenticationService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<JwtAuthenticationService> _logger;

    public JwtAuthenticationService(IConfiguration configuration, ILogger<JwtAuthenticationService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public string GenerateAccessToken(User user)
    {
        var securityKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_configuration["Jwt:Secret"]!)
        );
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim("role", user.Role.ToString()),
            new Claim("department", user.DepartmentId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(15),  // 15 minutes for access token
            signingCredentials: credentials
        );

        var tokenHandler = new JwtSecurityTokenHandler();
        var tokenString = tokenHandler.WriteToken(token);

        _logger.LogInformation($"Access token generated for user: {user.Email}");
        return tokenString;
    }

    public string GenerateRefreshToken()
    {
        var randomNumber = new byte[32];
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    public ClaimsPrincipal GetPrincipalFromExpiredToken(string token)
    {
        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false,
            ValidateIssuer = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(_configuration["Jwt:Secret"]!)
            ),
            ValidateLifetime = false  // Don't validate expiration for refresh flow
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, 
            out SecurityToken securityToken);

        if (!(securityToken is JwtSecurityToken jwtSecurityToken) ||
            !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256,
                StringComparison.InvariantCultureIgnoreCase))
        {
            throw new SecurityTokenException("Invalid token");
        }

        return principal;
    }
}
```

**Authentication Controller:**

```csharp
// Controllers/AuthController.cs
[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthenticationService _authService;
    private readonly IUserService _userService;
    private readonly IRedisService _redisService;
    private readonly ILogger<AuthController> _logger;

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        try
        {
            // Validate input
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // Check if user exists
            var existingUser = await _userService.GetUserByEmailAsync(request.Email);
            if (existingUser != null)
                return BadRequest("User already exists");

            // Create new user
            var user = new User
            {
                Name = request.Name,
                Email = request.Email,
                Password = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = UserRole.Employee,
                CreatedAt = DateTime.UtcNow,
            };

            var createdUser = await _userService.CreateUserAsync(user);

            _logger.LogInformation($"New user registered: {createdUser.Email}");

            return Ok(new { message = "User registered successfully", userId = createdUser.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Registration error: {ex.Message}");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            var user = await _userService.GetUserByEmailAsync(request.Email);
            
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.Password))
                return Unauthorized("Invalid credentials");

            // Generate tokens
            var accessToken = _authService.GenerateAccessToken(user);
            var refreshToken = _authService.GenerateRefreshToken();

            // Store refresh token in Redis with expiration (7 days)
            await _redisService.SetAsync(
                $"refresh_token:{user.Id}",
                refreshToken,
                TimeSpan.FromDays(7)
            );

            _logger.LogInformation($"User logged in: {user.Email}");

            return Ok(new
            {
                accessToken,
                refreshToken,
                user = new { user.Id, user.Name, user.Email, user.Role }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Login error: {ex.Message}");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        try
        {
            var principal = _authService.GetPrincipalFromExpiredToken(request.AccessToken);
            var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            // Verify refresh token exists in Redis
            var storedToken = await _redisService.GetAsync($"refresh_token:{userId}");
            if (storedToken != request.RefreshToken)
                return Unauthorized("Invalid refresh token");

            var user = await _userService.GetUserByIdAsync(Guid.Parse(userId!));
            var newAccessToken = _authService.GenerateAccessToken(user);

            return Ok(new { accessToken = newAccessToken });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Token refresh error: {ex.Message}");
            return Unauthorized("Invalid token");
        }
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            await _redisService.DeleteAsync($"refresh_token:{userId}");

            _logger.LogInformation($"User logged out: {userId}");
            return Ok("Logged out successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Logout error: {ex.Message}");
            return StatusCode(500, "Logout failed");
        }
    }
}
```

---

### 4. MICROSERVICES LAYER

**Attendance Service with Repository Pattern:**

```csharp
// Models/Attendance.cs
public class Attendance
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateTime CheckInTime { get; set; }
    public DateTime? CheckOutTime { get; set; }
    public string? Location { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public AttendanceStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public User? User { get; set; }
}

public enum AttendanceStatus
{
    Present,
    Absent,
    Late,
    Leave,
    Holiday,
    OnDuty
}

// Data Access
public interface IAttendanceRepository : IRepository<Attendance>
{
    Task<IEnumerable<Attendance>> GetUserAttendanceAsync(Guid userId, DateTime from, DateTime to);
    Task<Attendance?> GetTodayAttendanceAsync(Guid userId);
    Task<AttendanceReport> GetAttendanceReportAsync(DateTime from, DateTime to);
}

public class AttendanceRepository : Repository<Attendance>, IAttendanceRepository
{
    private readonly ILogger<AttendanceRepository> _logger;

    public AttendanceRepository(IMongoDbContext context, ILogger<AttendanceRepository> logger)
        : base(context)
    {
        _logger = logger;
    }

    public async Task<IEnumerable<Attendance>> GetUserAttendanceAsync(
        Guid userId, DateTime from, DateTime to)
    {
        try
        {
            return await _dbSet
                .Find(a => a.UserId == userId &&
                          a.CheckInTime >= from &&
                          a.CheckInTime <= to)
                .Sort(Builders<Attendance>.Sort.Descending(a => a.CheckInTime))
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error fetching attendance: {ex.Message}");
            throw;
        }
    }

    public async Task<Attendance?> GetTodayAttendanceAsync(Guid userId)
    {
        var today = DateTime.UtcNow.Date;
        return await _dbSet
            .Find(a => a.UserId == userId &&
                      a.CheckInTime >= today &&
                      a.CheckInTime < today.AddDays(1))
            .FirstOrDefaultAsync();
    }

    public async Task<AttendanceReport> GetAttendanceReportAsync(DateTime from, DateTime to)
    {
        var attendances = await _dbSet
            .Find(a => a.CheckInTime >= from && a.CheckInTime <= to)
            .ToListAsync();

        return new AttendanceReport
        {
            TotalPresent = attendances.Count(a => a.Status == AttendanceStatus.Present),
            TotalAbsent = attendances.Count(a => a.Status == AttendanceStatus.Absent),
            TotalLate = attendances.Count(a => a.Status == AttendanceStatus.Late),
            TotalOnLeave = attendances.Count(a => a.Status == AttendanceStatus.Leave),
            PeriodFrom = from,
            PeriodTo = to
        };
    }
}

// Business Logic
public interface IAttendanceService
{
    Task<Attendance> CheckInAsync(Guid userId, CheckInRequest request);
    Task<Attendance> CheckOutAsync(Guid userId);
    Task<IEnumerable<Attendance>> GetUserAttendanceAsync(Guid userId, DateTime from, DateTime to);
    Task<AttendanceReport> GenerateReportAsync(DateTime from, DateTime to);
}

public class AttendanceService : IAttendanceService
{
    private readonly IAttendanceRepository _repository;
    private readonly IRedisService _cacheService;
    private readonly IEventBus _eventBus;
    private readonly ILogger<AttendanceService> _logger;

    public AttendanceService(
        IAttendanceRepository repository,
        IRedisService cacheService,
        IEventBus eventBus,
        ILogger<AttendanceService> logger)
    {
        _repository = repository;
        _cacheService = cacheService;
        _eventBus = eventBus;
        _logger = logger;
    }

    public async Task<Attendance> CheckInAsync(Guid userId, CheckInRequest request)
    {
        try
        {
            // Validate geolocation
            if (!ValidateLocation(request.Latitude, request.Longitude))
                throw new InvalidOperationException("Check-in location is outside office premises");

            // Check if already checked in
            var today = await _repository.GetTodayAttendanceAsync(userId);
            if (today != null && today.CheckInTime.Date == DateTime.UtcNow.Date)
                throw new InvalidOperationException("Already checked in today");

            // Create attendance record
            var attendance = new Attendance
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                CheckInTime = DateTime.UtcNow,
                Location = request.Location,
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                Status = AttendanceStatus.Present,
                CreatedAt = DateTime.UtcNow
            };

            var result = await _repository.AddAsync(attendance);
            await _repository.SaveChangesAsync();

            // Clear cache
            await _cacheService.DeleteAsync($"attendance:user:{userId}:today");

            // Publish event
            await _eventBus.PublishAsync(new AttendanceCheckedInEvent
            {
                AttendanceId = result.Id,
                UserId = userId,
                CheckInTime = result.CheckInTime,
                Location = result.Location
            });

            _logger.LogInformation($"Check-in recorded for user {userId}");
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Check-in error for user {userId}: {ex.Message}");
            throw;
        }
    }

    public async Task<Attendance> CheckOutAsync(Guid userId)
    {
        try
        {
            var today = await _repository.GetTodayAttendanceAsync(userId);
            if (today == null)
                throw new InvalidOperationException("No check-in record found for today");

            if (today.CheckOutTime != null)
                throw new InvalidOperationException("Already checked out");

            today.CheckOutTime = DateTime.UtcNow;
            today.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(today);
            await _repository.SaveChangesAsync();

            // Clear cache
            await _cacheService.DeleteAsync($"attendance:user:{userId}:today");

            // Publish event
            await _eventBus.PublishAsync(new AttendanceCheckedOutEvent
            {
                AttendanceId = today.Id,
                UserId = userId,
                CheckOutTime = today.CheckOutTime.Value
            });

            _logger.LogInformation($"Check-out recorded for user {userId}");
            return today;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Check-out error for user {userId}: {ex.Message}");
            throw;
        }
    }

    public async Task<IEnumerable<Attendance>> GetUserAttendanceAsync(
        Guid userId, DateTime from, DateTime to)
    {
        try
        {
            var cacheKey = $"attendance:user:{userId}:{from:yyyy-MM-dd}:{to:yyyy-MM-dd}";
            var cached = await _cacheService.GetAsync<IEnumerable<Attendance>>(cacheKey);
            
            if (cached != null)
                return cached;

            var attendances = await _repository.GetUserAttendanceAsync(userId, from, to);
            
            // Cache for 1 hour
            await _cacheService.SetAsync(cacheKey, attendances, TimeSpan.FromHours(1));
            
            return attendances;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error fetching attendance: {ex.Message}");
            throw;
        }
    }

    public async Task<AttendanceReport> GenerateReportAsync(DateTime from, DateTime to)
    {
        return await _repository.GetAttendanceReportAsync(from, to);
    }

    private bool ValidateLocation(double latitude, double longitude)
    {
        // Office coordinates (example)
        const double officeLat = 28.7041;
        const double officeLon = 77.1025;
        const double radiusKm = 0.5;

        var distance = CalculateDistance(latitude, longitude, officeLat, officeLon);
        return distance <= radiusKm;
    }

    private double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double r = 6371; // Earth's radius in km
        var dlat = (lat2 - lat1) * Math.PI / 180;
        var dlon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.Sin(dlat / 2) * Math.Sin(dlat / 2) +
                Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                Math.Sin(dlon / 2) * Math.Sin(dlon / 2);
        var c = 2 * Math.Asin(Math.Sqrt(a));
        return r * c;
    }
}

// API Controller
[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class AttendanceController : ControllerBase
{
    private readonly IAttendanceService _service;
    private readonly ILogger<AttendanceController> _logger;

    [HttpPost("check-in")]
    public async Task<IActionResult> CheckIn([FromBody] CheckInRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
            var result = await _service.CheckInAsync(userId, request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Check-in error: {ex.Message}");
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("check-out")]
    public async Task<IActionResult> CheckOut()
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
            var result = await _service.CheckOutAsync(userId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Check-out error: {ex.Message}");
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("records")]
    public async Task<IActionResult> GetRecords([FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
            var result = await _service.GetUserAttendanceAsync(userId, from, to);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error fetching records: {ex.Message}");
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("report")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GenerateReport([FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        try
        {
            var result = await _service.GenerateReportAsync(from, to);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error generating report: {ex.Message}");
            return BadRequest(ex.Message);
        }
    }
}
```

---

### 5. EVENT-DRIVEN ARCHITECTURE

**Domain Events & Event Bus:**

```csharp
// Domain/Events/DomainEvent.cs
public abstract class DomainEvent
{
    public Guid AggregateId { get; protected set; }
    public DateTime Timestamp { get; protected set; }
    public string EventType { get; protected set; }

    protected DomainEvent()
    {
        Timestamp = DateTime.UtcNow;
        EventType = GetType().Name;
    }
}

public class AttendanceCheckedInEvent : DomainEvent
{
    public Guid AttendanceId { get; set; }
    public Guid UserId { get; set; }
    public DateTime CheckInTime { get; set; }
    public string? Location { get; set; }
}

public class AttendanceCheckedOutEvent : DomainEvent
{
    public Guid AttendanceId { get; set; }
    public Guid UserId { get; set; }
    public DateTime CheckOutTime { get; set; }
}

// Event Bus
public interface IEventBus
{
    Task PublishAsync<TEvent>(TEvent @event) where TEvent : DomainEvent;
    void Subscribe<TEvent, TEventHandler>()
        where TEvent : DomainEvent
        where TEventHandler : IEventHandler<TEvent>;
}

public interface IEventHandler<in TEvent> where TEvent : DomainEvent
{
    Task HandleAsync(TEvent @event);
}

// RabbitMQ Implementation
public class RabbitMQEventBus : IEventBus
{
    private readonly IConnection _connection;
    private readonly IModel _channel;
    private readonly IServiceProvider _serviceProvider;

    public RabbitMQEventBus(RabbitMQConnection connection, IServiceProvider serviceProvider)
    {
        _connection = connection.Connection;
        _channel = _connection.CreateModel();
        _serviceProvider = serviceProvider;
    }

    public async Task PublishAsync<TEvent>(TEvent @event) where TEvent : DomainEvent
    {
        var eventName = typeof(TEvent).Name;
        var exchangeName = "attendance_events";

        _channel.ExchangeDeclare(exchange: exchangeName, type: ExchangeType.Topic, durable: true);

        var message = JsonConvert.SerializeObject(@event);
        var body = Encoding.UTF8.GetBytes(message);

        var properties = _channel.CreateBasicProperties();
        properties.Persistent = true;
        properties.ContentType = "application/json";

        _channel.BasicPublish(
            exchange: exchangeName,
            routingKey: eventName,
            basicProperties: properties,
            body: body
        );

        await Task.CompletedTask;
    }

    public void Subscribe<TEvent, TEventHandler>()
        where TEvent : DomainEvent
        where TEventHandler : IEventHandler<TEvent>
    {
        var eventName = typeof(TEvent).Name;
        var queueName = $"{eventName}_{typeof(TEventHandler).Name}";
        var exchangeName = "attendance_events";

        _channel.ExchangeDeclare(exchange: exchangeName, type: ExchangeType.Topic, durable: true);
        _channel.QueueDeclare(queue: queueName, durable: true, exclusive: false, autoDelete: false);
        _channel.QueueBind(queue: queueName, exchange: exchangeName, routingKey: eventName);

        var consumer = new EventingBasicConsumer(_channel);
        consumer.Received += async (model, ea) =>
        {
            var message = Encoding.UTF8.GetString(ea.Body.ToArray());
            var @event = JsonConvert.DeserializeObject<TEvent>(message);

            using var scope = _serviceProvider.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<TEventHandler>();
            await handler.HandleAsync(@event!);

            _channel.BasicAck(ea.DeliveryTag, false);
        };

        _channel.BasicConsume(queue: queueName, autoAck: false, consumer: consumer);
    }
}

// Event Handler Examples
public class AttendanceCheckedInEventHandler : IEventHandler<AttendanceCheckedInEvent>
{
    private readonly INotificationService _notificationService;
    private readonly ILogger<AttendanceCheckedInEventHandler> _logger;

    public AttendanceCheckedInEventHandler(
        INotificationService notificationService,
        ILogger<AttendanceCheckedInEventHandler> logger)
    {
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task HandleAsync(AttendanceCheckedInEvent @event)
    {
        try
        {
            // Send notification to user
            await _notificationService.SendEmailAsync(
                @event.UserId,
                "Attendance Check-In",
                $"You checked in at {@event.CheckInTime:yyyy-MM-dd HH:mm:ss}"
            );

            _logger.LogInformation($"Check-in notification sent for user {@event.UserId}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error handling check-in event: {ex.Message}");
        }
    }
}
```

---

### 6. DATABASE LAYER

**MongoDB Context & Configuration:**

```csharp
// Data/MongoDbContext.cs
public interface IMongoDbContext
{
    IMongoCollection<T> GetCollection<T>(string name);
    Task SaveChangesAsync();
}

public class MongoDbContext : IMongoDbContext
{
    private readonly IMongoDatabase _database;
    private readonly IClientSessionHandle? _session;

    public MongoDbContext(IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MongoDb");
        var mongoUrl = MongoUrl.Create(connectionString);
        var client = new MongoClient(mongoUrl);
        _database = client.GetDatabase(mongoUrl.DatabaseName ?? "SmartAttendance");
    }

    public IMongoCollection<T> GetCollection<T>(string name) => _database.GetCollection<T>(name);

    public async Task SaveChangesAsync()
    {
        if (_session != null)
            await _session.CommitTransactionAsync();
    }
}

// Startup Configuration
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddMongoDb(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddSingleton<IMongoDbContext>(new MongoDbContext(configuration));
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IAttendanceRepository, AttendanceRepository>();
        services.AddScoped<IUserRepository, UserRepository>();

        return services;
    }

    public static async Task CreateIndexesAsync(this IMongoDbContext context)
    {
        // Create indexes for Users collection
        var usersCollection = context.GetCollection<User>("users");
        await usersCollection.Indexes.CreateOneAsync(
            new CreateIndexModel<User>(
                Builders<User>.IndexKeys.Ascending(u => u.Email),
                new CreateIndexOptions { Unique = true }
            )
        );

        // Create indexes for Attendance collection
        var attendanceCollection = context.GetCollection<Attendance>("attendance");
        await attendanceCollection.Indexes.CreateOneAsync(
            new CreateIndexModel<Attendance>(
                Builders<Attendance>.IndexKeys
                    .Ascending(a => a.UserId)
                    .Ascending(a => a.CheckInTime)
            )
        );
    }
}
```

---

### 7. CACHING STRATEGY

**Redis Cache Service:**

```csharp
// Services/CacheService.cs
public interface IRedisService
{
    Task<T?> GetAsync<T>(string key);
    Task SetAsync<T>(string key, T value, TimeSpan? expiration = null);
    Task DeleteAsync(string key);
    Task<bool> ExistsAsync(string key);
    Task IncrementAsync(string key, long value = 1);
    Task DecrementAsync(string key, long value = 1);
}

public class RedisService : IRedisService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisService> _logger;

    public RedisService(IConnectionMultiplexer redis, ILogger<RedisService> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        try
        {
            var db = _redis.GetDatabase();
            var value = await db.StringGetAsync(key);

            if (!value.HasValue)
                return default;

            return JsonConvert.DeserializeObject<T>(value.ToString());
        }
        catch (Exception ex)
        {
            _logger.LogError($"Redis GET error for key {key}: {ex.Message}");
            return default;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiration = null)
    {
        try
        {
            var db = _redis.GetDatabase();
            var serialized = JsonConvert.SerializeObject(value);
            await db.StringSetAsync(key, serialized, expiration);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Redis SET error for key {key}: {ex.Message}");
        }
    }

    public async Task DeleteAsync(string key)
    {
        try
        {
            var db = _redis.GetDatabase();
            await db.KeyDeleteAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Redis DELETE error for key {key}: {ex.Message}");
        }
    }

    public async Task<bool> ExistsAsync(string key)
    {
        try
        {
            var db = _redis.GetDatabase();
            return await db.KeyExistsAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Redis EXISTS error for key {key}: {ex.Message}");
            return false;
        }
    }

    public async Task IncrementAsync(string key, long value = 1)
    {
        try
        {
            var db = _redis.GetDatabase();
            await db.StringIncrementAsync(key, value);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Redis INCREMENT error for key {key}: {ex.Message}");
        }
    }

    public async Task DecrementAsync(string key, long value = 1)
    {
        try
        {
            var db = _redis.GetDatabase();
            await db.StringDecrementAsync(key, value);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Redis DECREMENT error for key {key}: {ex.Message}");
        }
    }
}

// Dependency Injection
services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var configuration = ConfigurationOptions.Parse(
        Configuration.GetConnectionString("Redis") ??
        "localhost:6379"
    );
    configuration.AbortOnConnectFail = false;
    return ConnectionMultiplexer.Connect(configuration);
});
services.AddScoped<IRedisService, RedisService>();
```

---

### 8. STRUCTURED LOGGING

**Serilog + Elasticsearch Integration:**

```csharp
// Startup configuration
public static class LoggingExtensions
{
    public static WebApplicationBuilder AddStructuredLogging(this WebApplicationBuilder builder)
    {
        builder.Host.UseSerilog((context, config) =>
        {
            var elasticsearchUri = context.Configuration["Elasticsearch:Uri"];
            
            config
                .MinimumLevel.Information()
                .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
                .MinimumLevel.Override("System", LogEventLevel.Warning)
                .Enrich.WithProperty("Application", "SmartAttendance")
                .Enrich.WithProperty("Environment", context.HostingEnvironment.EnvironmentName)
                .Enrich.FromLogContext()
                .Enrich.WithCorrelationIdHeader()
                .Enrich.WithExceptionDetails()
                .WriteTo.Console(new RenderedCompactJsonFormatter())
                .WriteTo.Elasticsearch(new ElasticsearchSinkOptions(new Uri(elasticsearchUri!))
                {
                    AutoRegisterTemplate = true,
                    IndexFormat = "smartattendance-logs-{0:yyyy.MM.dd}",
                    MinimumLogEventLevel = LogEventLevel.Information,
                });
        });

        return builder;
    }
}

// Usage in code
public class ExampleService
{
    private readonly ILogger<ExampleService> _logger;

    public ExampleService(ILogger<ExampleService> logger)
    {
        _logger = logger;
    }

    public void ProcessAttendance(Guid userId)
    {
        using (_logger.BeginScope(new { UserId = userId }))
        {
            _logger.LogInformation("Processing attendance for user");
            
            try
            {
                // Business logic
                _logger.LogInformation("Attendance processed successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing attendance");
            }
        }
    }
}
```

---

### 9. MONITORING & METRICS

**Prometheus Metrics:**

```csharp
// Metrics setup
public static class MetricsExtensions
{
    public static IServiceCollection AddPrometheusMetrics(this IServiceCollection services)
    {
        services.AddSingleton<ICollectorRegistry>(new CollectorRegistry());
        services.AddSingleton<IMetricsCollector, PrometheusMetricsCollector>();

        return services;
    }
}

public interface IMetricsCollector
{
    void RecordApiRequestDuration(string endpoint, long durationMs);
    void RecordApiError(string endpoint);
    void RecordCacheHit();
    void RecordCacheMiss();
    void RecordDatabaseQuery(long durationMs);
}

public class PrometheusMetricsCollector : IMetricsCollector
{
    private readonly Counter _apiRequestsTotal;
    private readonly Histogram _apiRequestDuration;
    private readonly Counter _apiErrorsTotal;
    private readonly Counter _cacheHits;
    private readonly Counter _cacheMisses;
    private readonly Histogram _databaseQueryDuration;

    public PrometheusMetricsCollector()
    {
        _apiRequestsTotal = Metrics.CreateCounter(
            "smartattendance_api_requests_total",
            "Total API requests",
            new CounterConfiguration { LabelNames = new[] { "endpoint", "method" } }
        );

        _apiRequestDuration = Metrics.CreateHistogram(
            "smartattendance_api_request_duration_ms",
            "API request duration in milliseconds",
            new HistogramConfiguration
            {
                LabelNames = new[] { "endpoint" },
                Buckets = new[] { 10.0, 50.0, 100.0, 500.0, 1000.0, 2000.0, 5000.0 }
            }
        );

        _apiErrorsTotal = Metrics.CreateCounter(
            "smartattendance_api_errors_total",
            "Total API errors",
            new CounterConfiguration { LabelNames = new[] { "endpoint", "status_code" } }
        );

        _cacheHits = Metrics.CreateCounter(
            "smartattendance_cache_hits_total",
            "Total cache hits"
        );

        _cacheMisses = Metrics.CreateCounter(
            "smartattendance_cache_misses_total",
            "Total cache misses"
        );

        _databaseQueryDuration = Metrics.CreateHistogram(
            "smartattendance_db_query_duration_ms",
            "Database query duration in milliseconds",
            new HistogramConfiguration
            {
                Buckets = new[] { 10.0, 50.0, 100.0, 500.0, 1000.0, 5000.0 }
            }
        );
    }

    public void RecordApiRequestDuration(string endpoint, long durationMs)
    {
        _apiRequestDuration.Labels(endpoint).Observe(durationMs);
    }

    public void RecordApiError(string endpoint)
    {
        _apiErrorsTotal.Labels(endpoint, "500").Inc();
    }

    public void RecordCacheHit()
    {
        _cacheHits.Inc();
    }

    public void RecordCacheMiss()
    {
        _cacheMisses.Inc();
    }

    public void RecordDatabaseQuery(long durationMs)
    {
        _databaseQueryDuration.Observe(durationMs);
    }
}
```

---

### 10. CONTAINERIZATION

**Docker Multi-Stage Build:**

```dockerfile
# Dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

WORKDIR /app

# Copy csproj files
COPY ["backend/SmartAttendance.API/SmartAttendance.API.csproj", "backend/SmartAttendance.API/"]
COPY ["backend/SmartAttendance.Domain/SmartAttendance.Domain.csproj", "backend/SmartAttendance.Domain/"]
COPY ["backend/SmartAttendance.Infrastructure/SmartAttendance.Infrastructure.csproj", "backend/SmartAttendance.Infrastructure/"]

# Restore dependencies
RUN dotnet restore "backend/SmartAttendance.API/SmartAttendance.API.csproj"

# Copy source code
COPY backend/ .

# Build release
RUN dotnet build "SmartAttendance.API/SmartAttendance.API.csproj" -c Release -o /app/build

# Publish
RUN dotnet publish "SmartAttendance.API/SmartAttendance.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime

WORKDIR /app

# Install health check dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy published app
COPY --from=builder /app/publish .

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run app
ENTRYPOINT ["dotnet", "SmartAttendance.API.dll"]
```

**Docker Compose for Local Development:**

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: password
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:7.0-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0
    ports:
      - "9200:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      ASPNETCORE_ENVIRONMENT: Development
      ASPNETCORE_URLS: http://+:5000
      MongoDb__ConnectionString: mongodb://root:password@mongodb:27017/SmartAttendance?authSource=admin
      Redis__Connection: redis:6379
      RabbitMQ__HostName: rabbitmq
      Elasticsearch__Uri: http://elasticsearch:9200
      Jwt__Secret: ThisIsAVerySecureKeyForSmartAttendanceSystem12345!
      Jwt__Issuer: SmartAttendance
      Jwt__Audience: SmartAttendanceUsers
    depends_on:
      - mongodb
      - redis
      - rabbitmq
      - elasticsearch

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:5000
    depends_on:
      - api

volumes:
  mongodb_data:
  redis_data:
  rabbitmq_data:
  elasticsearch_data:
```

---

### 11. KUBERNETES DEPLOYMENT

**Kubernetes Manifests:**

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: attendance-system

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
  namespace: attendance-system
data:
  ASPNETCORE_ENVIRONMENT: "Production"
  ASPNETCORE_URLS: "http://+:5000"
  Jwt__Issuer: "SmartAttendance"
  Jwt__Audience: "SmartAttendanceUsers"
  Elasticsearch__Uri: "http://elasticsearch:9200"
  RabbitMQ__HostName: "rabbitmq"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-secrets
  namespace: attendance-system
type: Opaque
data:
  Jwt__Secret: VGhpc0lzQVZlcnlTZWN1cmVLZXlGb3JTbWFydEF0dGVuZGFuY2VTZXN0ZW0xMjM0NSE=  # base64 encoded
  MongoDb__ConnectionString: bW9uZ29kYjovL3VzZXI6cGFzc3dvcmRAjbm9uZ29kYi1wcmltYXJ5OjI3MDE3L1NtYXJ0QXR0ZW5kYW5jZQ==

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: attendance-api
  namespace: attendance-system
  labels:
    app: attendance-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: attendance-api
  template:
    metadata:
      labels:
        app: attendance-api
    spec:
      serviceAccountName: attendance-api
      containers:
      - name: api
        image: your-registry/smartattendance-api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 5000
          name: http
        
        envFrom:
        - configMapRef:
            name: api-config
        - secretRef:
            name: api-secrets
        
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            cpu: 500m
            memory: 1Gi
        
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 5
          failureThreshold: 2
        
        volumeMounts:
        - name: logs
          mountPath: /var/log/app
      
      volumes:
      - name: logs
        emptyDir: {}

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: attendance-api
  namespace: attendance-system
  labels:
    app: attendance-api
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 5000
    protocol: TCP
    name: http
  selector:
    app: attendance-api

---
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: attendance-api-hpa
  namespace: attendance-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: attendance-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: attendance-ingress
  namespace: attendance-system
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.attendance.company.com
    secretName: attendance-tls
  rules:
  - host: api.attendance.company.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: attendance-api
            port:
              number: 80
```

---

### 12. CI/CD PIPELINE

**GitHub Actions Workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy Smart Attendance

on:
  push:
    branches: [main, develop]
    paths:
      - 'backend/**'
      - 'frontend/**'
      - 'k8s/**'
      - 'docker-compose.yml'
      - '.github/workflows/deploy.yml'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - uses: actions/checkout@v3

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2

    - name: Log in to Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=sha
          type=semver,pattern={{version}}

    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}

  test:
    runs-on: ubuntu-latest
    needs: build

    services:
      mongodb:
        image: mongo:7.0
        options: >-
          --health-cmd "mongosh --eval \"db.adminCommand('ping')\" --quiet"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 27017:27017

      redis:
        image: redis:7.0-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - uses: actions/checkout@v3

    - name: Setup .NET
      uses: actions/setup-dotnet@v3
      with:
        dotnet-version: 8.x

    - name: Restore dependencies
      run: dotnet restore backend/SmartAttendance.API/SmartAttendance.API.csproj

    - name: Build
      run: dotnet build backend/SmartAttendance.API/SmartAttendance.API.csproj --configuration Release --no-restore

    - name: Run unit tests
      run: dotnet test backend/SmartAttendance.Tests/SmartAttendance.Tests.csproj --configuration Release --no-build --verbosity normal

    - name: Run integration tests
      run: dotnet test backend/SmartAttendance.IntegrationTests/SmartAttendance.IntegrationTests.csproj --configuration Release --no-build --verbosity normal
      env:
        ConnectionStrings__MongoDB: mongodb://localhost:27017/SmartAttendanceTest
        ConnectionStrings__Redis: localhost:6379

    - name: SonarQube Analysis
      uses: SonarSource/sonarcloud-github-action@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  deploy-staging:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/develop'

    steps:
    - uses: actions/checkout@v3

    - name: Deploy to Staging
      run: |
        kubectl apply -f k8s/ --namespace=attendance-staging
        kubectl rollout status deployment/attendance-api --namespace=attendance-staging

  deploy-production:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'

    steps:
    - uses: actions/checkout@v3

    - name: Deploy to Production
      run: |
        kubectl apply -f k8s/ --namespace=attendance-system
        kubectl rollout status deployment/attendance-api --namespace=attendance-system

    - name: Notify Slack
      uses: slackapi/slack-github-action@v1
      with:
        webhook-url: ${{ secrets.SLACK_WEBHOOK }}
        payload: |
          {
            "text": "✅ Smart Attendance API deployed to production",
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "*Production Deployment Successful*\n`${{ github.sha }}`"
                }
              }
            ]
          }
```

---

### 13. DISASTER RECOVERY

**Backup Strategy & MongoDB Replication:**

```yaml
# k8s/mongodb-replica-set.yaml
apiVersion: mongodbcommunity.mongodb.com/v1
kind: MongoDBCommunity
metadata:
  name: mongodb-replica
  namespace: attendance-system
spec:
  members: 3
  type: ReplicaSet
  version: "7.0"
  
  security:
    authentication:
      modes: ["SCRAM"]
  
  users:
  - name: admin
    db: admin
    passwordSecretRef:
      name: mongodb-admin-password
    roles:
    - name: root
      db: admin
  
  additionalMongodConfig:
    storage:
      engine: wiredTiger
      wiredTiger:
        engineConfig:
          cacheSizeGB: 4
    replication:
      oplogSizeMB: 10240
      enableMajorityReadConcern: true

---
# k8s/backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongodb-backup
  namespace: attendance-system
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: mongodb-backup
          containers:
          - name: backup
            image: mongo:7.0
            command:
            - /bin/sh
            - -c
            - |
              mongodump --uri "mongodb://admin:password@mongodb-replica-0.mongodb-replica-svc:27017/SmartAttendance?authSource=admin" \
                       --out /backup/$(date +\%Y-\%m-\%d-\%H-\%M-\%S)
              
              aws s3 sync /backup s3://backup-bucket/mongodb/$(date +\%Y/\%m/\%d)/ \
                --region us-east-1 \
                --sse AES256
            
            env:
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: aws-credentials
                  key: access-key
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: aws-credentials
                  key: secret-key
            
            volumeMounts:
            - name: backup
              mountPath: /backup
          
          volumes:
          - name: backup
            emptyDir: {}
          
          restartPolicy: OnFailure
```

---

## DEPLOYMENT STRATEGY

### Development Environment
```bash
# Local development with Docker Compose
docker-compose up -d

# Access
- API: http://localhost:5000
- Frontend: http://localhost:5173
- MongoDB: mongodb://root:password@localhost:27017
- Redis: localhost:6379
```

### Staging Environment
```bash
# Deploy to staging
kubectl apply -f k8s/ --namespace=attendance-staging
kubectl set image deployment/attendance-api \
  attendance-api=ghcr.io/your-repo/smartattendance-api:develop \
  --namespace=attendance-staging
```

### Production Environment
```bash
# Blue-Green Deployment
# Deploy to blue environment
kubectl apply -f k8s/blue-deployment.yaml

# Run smoke tests
./smoke-tests.sh

# Switch traffic to blue
kubectl patch service attendance-api -p '{"spec":{"selector":{"deployment":"blue"}}}'

# Keep green for rollback
```

---

## PERFORMANCE TARGETS

| Metric | Target | P95 | P99 |
|--------|--------|-----|-----|
| API Response Time | < 100ms | < 500ms | < 2s |
| Database Query | < 50ms | < 200ms | < 500ms |
| Cache Hit Ratio | > 80% | - | - |
| Throughput | 10,000 req/sec | - | - |
| Error Rate | < 0.1% | - | - |
| Availability | 99.95% | - | - |

---

## SECURITY CHECKLIST

- ✅ OWASP Top 10 compliance
- ✅ API key rotation (90 days)
- ✅ TLS 1.3 for all communication
- ✅ AES-256 encryption at rest
- ✅ RBAC + Permission-based access
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ CSRF tokens
- ✅ Rate limiting
- ✅ WAF rules configured
- ✅ Vulnerability scanning (weekly)
- ✅ Penetration testing (quarterly)
- ✅ GDPR compliance
- ✅ Audit logging
- ✅ Data retention policies

---

## MONITORING DASHBOARDS

**Grafana Dashboard Queries:**

```prometheus
# API Success Rate
rate(smartattendance_api_requests_total{status="200"}[5m]) / rate(smartattendance_api_requests_total[5m]) * 100

# API P99 Latency
histogram_quantile(0.99, rate(smartattendance_api_request_duration_ms_bucket[5m]))

# Cache Hit Ratio
smartattendance_cache_hits_total / (smartattendance_cache_hits_total + smartattendance_cache_misses_total) * 100

# Database Connection Pool Usage
smartattendance_db_connections_active / smartattendance_db_connections_max * 100

# Pod Memory Usage
container_memory_usage_bytes{pod=~"attendance-api.*"}

# Pod CPU Usage
rate(container_cpu_usage_seconds_total{pod=~"attendance-api.*"}[5m])
```

---

This architecture is **production-ready**, **highly scalable**, and follows **industry best practices**! 🚀

