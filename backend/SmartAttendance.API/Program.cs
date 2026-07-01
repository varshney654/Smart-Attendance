using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using SmartAttendance.API.Data;
using SmartAttendance.API.Models;
using SmartAttendance.API.Services;
using System.Net;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Only load .env file in development (not in Docker/Render)
if (builder.Environment.IsDevelopment())
{
    // Try multiple paths to find .env (handles dotnet run vs bin/Debug paths)
    var possibleEnvPaths = new[]
    {
        Path.Combine(Directory.GetCurrentDirectory(), "..", "..", ".env"),
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".env"),
        Path.Combine(Directory.GetCurrentDirectory(), ".env")
    };

    var envLoaded = false;
    foreach (var envPath in possibleEnvPaths)
    {
        var fullPath = Path.GetFullPath(envPath);
        if (File.Exists(fullPath))
        {
            DotNetEnv.Env.Load(fullPath);
            Console.WriteLine($"[ENV] Loaded .env from: {fullPath}");
            envLoaded = true;
            break;
        }
    }
    if (!envLoaded)
    {
        Console.WriteLine("[ENV WARNING] .env file not found! SMTP and other credentials may not be available.");
        Console.WriteLine($"[ENV WARNING] Searched paths: {string.Join(", ", possibleEnvPaths.Select(p => Path.GetFullPath(p)))}");
    }
}

// Fix TLS issue on Windows
ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;

// Verify SMTP Environment Variables
Console.WriteLine("--- Checking SMTP Environment Variables ---");
if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SMTP_EMAIL"))) Console.WriteLine("WARNING: SMTP_EMAIL environment variable is missing.");
if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SMTP_PASSWORD")) && string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SMTP_APP_PASSWORD"))) Console.WriteLine("WARNING: SMTP_PASSWORD environment variable is missing.");
if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SMTP_HOST"))) Console.WriteLine("WARNING: SMTP_HOST environment variable is missing. (Defaults to smtp.gmail.com)");
if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SMTP_PORT"))) Console.WriteLine("WARNING: SMTP_PORT environment variable is missing. (Defaults to 587)");
Console.WriteLine("-------------------------------------------");

// Add services to the container.
builder.Services.Configure<DatabaseSettings>(
    builder.Configuration.GetSection("SmartAttendanceDatabase"));

// Create a single shared MongoClient for the entire application (avoids dual connection pools)
var mongoUri = Environment.GetEnvironmentVariable("MONGO_URI") ?? "mongodb://localhost:27017";
var mongoSettings = MongoClientSettings.FromConnectionString(mongoUri);
mongoSettings.ServerSelectionTimeout = TimeSpan.FromSeconds(30);
mongoSettings.ConnectTimeout = TimeSpan.FromSeconds(20);
mongoSettings.SocketTimeout = TimeSpan.FromSeconds(30);
mongoSettings.MaxConnectionPoolSize = 50;
mongoSettings.MinConnectionPoolSize = 5;
var sharedMongoClient = new MongoClient(mongoSettings);
builder.Services.AddSingleton<IMongoClient>(sharedMongoClient);

builder.Services.AddSingleton<MongoDbService>();

// Register Prisma-like ORM Context (uses the shared MongoClient)
builder.Services.AddSingleton<PrismaDbContext>(sp =>
{
    var client = sp.GetRequiredService<IMongoClient>();
    return new PrismaDbContext(client, "SmartAttendance");
});

// Register Email Service
builder.Services.AddSingleton<IEmailService, EmailService>();

// Register Scheduled Background Threads
builder.Services.AddHostedService<SmartAttendance.API.BackgroundJobs.AutoAbsentService>();

// Configure JWT Authentication
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET") ?? "FallbackSecretKey123!@#_MakeItLongEnough";
var key = Encoding.ASCII.GetBytes(jwtSecret);

builder.Services.AddAuthentication(x =>
{
    x.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    x.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(x =>
{
    x.RequireHttpsMetadata = false;
    x.SaveToken = true;
    x.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false, // True for prod
        ValidateAudience = false // True for prod
    };
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS - allow local development and deployed frontend origin
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecific",
        builder =>
        {
            builder.WithOrigins(
                    "https://smart-attendance-2-jimq.onrender.com",
                    "http://localhost:5173",
                    "http://127.0.0.1:5173"
                )
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
});

var app = builder.Build();

// Warm up MongoDB connection pool on startup to avoid cold-start delays
try
{
    var warmupClient = app.Services.GetRequiredService<IMongoClient>();
    var warmupDb = warmupClient.GetDatabase("SmartAttendance");
    await warmupDb.RunCommandAsync<MongoDB.Bson.BsonDocument>(new MongoDB.Bson.BsonDocument("ping", 1));
    Console.WriteLine("[STARTUP] MongoDB connection warm-up successful.");
}
catch (Exception ex)
{
    Console.WriteLine($"[STARTUP WARNING] MongoDB warm-up failed: {ex.Message}. First request may be slow.");
}

// Enable Swagger if ENABLE_SWAGGER environment variable is set to "true" OR in Development
var enableSwagger = app.Environment.IsDevelopment() || 
                    Environment.GetEnvironmentVariable("ENABLE_SWAGGER")?.ToLower() == "true";

if (enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowSpecific");

// Disable HTTPS redirection in production (Render handles SSL termination)
if (!builder.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Root endpoint - redirects to Swagger UI
app.MapGet("/", () =>
    Results.Content(@"<!DOCTYPE html>
<html>
<head>
    <meta http-equiv='refresh' content='0; url=/swagger' />
</head>
<body>
    <p>Redirecting to <a href='/swagger'>Swagger UI</a>...</p>
</body>
</html>", "text/html"));

// Configure port from environment variable (required for Render)
// Render sets the PORT environment variable, so we must listen on that port
var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Urls.Add($"http://0.0.0.0:{port}");

// Add a simple health check endpoint for Render
app.MapGet("/health", () => Results.Ok(new { status = "ok", timestamp = DateTime.UtcNow }));
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", timestamp = DateTime.UtcNow }));


await app.RunAsync();
