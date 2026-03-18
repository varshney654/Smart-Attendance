using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using SmartAttendance.API.Data;
using SmartAttendance.API.Models;
using SmartAttendance.API.Services;
using System.Net;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Load .env variables
DotNetEnv.Env.Load("../../.env");

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
app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Configure port from env
var portStr = Environment.GetEnvironmentVariable("PORT");
if (int.TryParse(portStr, out int port))
{
    app.Urls.Add($"http://*:{port}");
}

app.Run();
