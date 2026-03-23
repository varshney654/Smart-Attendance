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

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder =>
        {
            builder.AllowAnyOrigin()
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");

// Disable HTTPS redirection in production (Render handles SSL termination)
if (!builder.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Configure port from environment variable (required for Render)
// Render sets the PORT environment variable, so we must listen on that port
var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Urls.Add($"http://0.0.0.0:{port}");

// Add a simple health check endpoint for Render
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

app.Run();
