using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using SmartAttendance.API.Data;
using SmartAttendance.API.DTOs;
using SmartAttendance.API.Models;
using SmartAttendance.API.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace SmartAttendance.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly PrismaDbContext _db;
        private readonly IUserRepository _users;

        public AuthController(PrismaDbContext db)
        {
            _db = db;
            _users = db.Users;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto registerDto)
        {
            // Check if user exists using Prisma-like ORM
            var existingUser = await _users.FindByEmailAsync(registerDto.Email);
            if (existingUser != null)
                return BadRequest(new { message = "Email already in use" });

            var user = new User
            {
                Name = registerDto.Name,
                Email = registerDto.Email,
                Role = registerDto.Role,
                Department = registerDto.Department,
                Password = BCrypt.Net.BCrypt.HashPassword(registerDto.Password)
            };

            // Create user using Prisma-like ORM
            await _users.CreateAsync(user);

            return Ok(new { message = "User registered successfully" });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            // Find user using Prisma-like ORM
            var user = await _users.FindByEmailAsync(loginDto.Email);

            if (user == null || !BCrypt.Net.BCrypt.Verify(loginDto.Password, user.Password))
                return Unauthorized(new { message = "Invalid email or password" });

            var token = GenerateJwtToken(user);

            // Do not send password back
            user.Password = "";

            return Ok(new
            {
                token,
                user
            });
        }

        private string GenerateJwtToken(User user)
        {
            var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET") ?? "FallbackSecretKey123!@#_MakeItLongEnough";
            var key = Encoding.ASCII.GetBytes(jwtSecret);

            var tokenHandler = new JwtSecurityTokenHandler();
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id ?? ""),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Role, user.Role),
                    new Claim("Name", user.Name)
                }),
                Expires = DateTime.UtcNow.AddDays(7),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }
}
