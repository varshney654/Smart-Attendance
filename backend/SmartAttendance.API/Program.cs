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
    DotNetEnv.Env.Load("../../.env");
}

// Fix TLS issue on Windows
ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;

// Add services to the container.
builder.Services.Configure<DatabaseSettings>(
    builder.Configuration.GetSection("SmartAttendanceDatabase"));

builder.Services.AddSingleton<MongoDbService>();

// Register Prisma-like ORM Context
builder.Services.AddSingleton<PrismaDbContext>(sp =>
{
    var mongoUri = Environment.GetEnvironmentVariable("MONGO_URI") ?? "mongodb://localhost:27017";
    var mongoClient = new MongoClient(mongoUri);
    return new PrismaDbContext(mongoClient, "SmartAttendance");
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


app.Run();
