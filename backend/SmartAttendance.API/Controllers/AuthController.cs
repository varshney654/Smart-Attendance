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
                ProfileImage = registerDto.ProfileImage,
                Password = BCrypt.Net.BCrypt.HashPassword(registerDto.Password)
            };

            // Create user using Prisma-like ORM
            await _users.CreateAsync(user);

            return Ok(new { message = "User registered successfully" });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            Console.WriteLine($"[LOGIN ATTEMPT] Email: {loginDto.Email}, Role: {loginDto.Role}");

            // Find user using Prisma-like ORM
            var user = await _users.FindByEmailAsync(loginDto.Email);

            if (user == null)
            {
                Console.WriteLine("[LOGIN FAILED] User not found.");
                return NotFound(new { message = "User not found", status = 404 });
            }

            if (!BCrypt.Net.BCrypt.Verify(loginDto.Password, user.Password))
            {
                Console.WriteLine("[LOGIN FAILED] Invalid password.");
                return Unauthorized(new { message = "Invalid password", status = 401 });
            }

            if (!string.Equals(user.Role, loginDto.Role, StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine($"[LOGIN FAILED] Role mismatch. Expected: {user.Role}, Provided: {loginDto.Role}");
                return Unauthorized(new { message = "Role mismatch", status = 401 });
            }

            var token = GenerateJwtToken(user);

            // Do not send password back
            user.Password = "";

            Console.WriteLine("[LOGIN SUCCESS] Token generated.");

            return Ok(new
            {
                message = "Login successful",
                status = 200,
                token,
                user
            });
        }

        [HttpPost("send-reset-code")]
        public async Task<IActionResult> SendResetCode([FromBody] ResetRequestDto request)
        {
            var user = await _users.FindByEmailAsync(request.Email);
            if (user == null)
            {
                return Ok(new { success = true, message = "OTP sent to your email" });
            }

            var otp = new Random().Next(100000, 999999).ToString();
            user.ResetOtp = BCrypt.Net.BCrypt.HashPassword(otp);
            user.ResetOtpExpiry = DateTime.UtcNow.AddMinutes(10);
            
            if (user.Id != null)
            {
                await _users.UpdateAsync(user.Id, user);
            }

            try
            {
                Console.WriteLine($"[DEBUG] Generated OTP for {request.Email}: {otp}");
                Console.WriteLine("[SMTP] Connecting to Gmail SMTP...");

                using var smtpClient = new System.Net.Mail.SmtpClient("smtp.gmail.com", 587)
                {
                    EnableSsl = true,
                    UseDefaultCredentials = false,
                    Credentials = new System.Net.NetworkCredential("ajayvarshney2429@gmail.com", "dzcetjdsnxcqrutjye")
                };

                Console.WriteLine("[SMTP] Authenticating...");

                var mailMessage = new System.Net.Mail.MailMessage
                {
                    From = new System.Net.Mail.MailAddress("ajayvarshney2429@gmail.com", "Smart Attendance System"),
                    Subject = "Password Reset OTP",
                    Body = $"<p>Your password reset code is: <strong>{otp}</strong></p><p>This code will expire securely in exactly 10 minutes.</p>",
                    IsBodyHtml = true
                };
                mailMessage.To.Add(request.Email);

                Console.WriteLine("[SMTP] Sending mail...");
                smtpClient.Send(mailMessage);
                Console.WriteLine("[SMTP] EMAIL SENT SUCCESS");
                
                return Ok(new { success = true, message = "OTP sent to your email" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SMTP ERROR] Gmail Rejection Reason: {ex.Message}");
                if (ex.InnerException != null) 
                {
                    Console.WriteLine($"[SMTP ERROR] Inner Exception: {ex.InnerException.Message}");
                }
                Console.WriteLine($"[SMTP ERROR] Stack Trace: {ex.StackTrace}");
                
                return StatusCode(500, new { success = false, message = "Failed to send OTP email" });
            }
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto request)
        {
            var user = await _users.FindByEmailAsync(request.Email);

            if (user == null || user.ResetOtp == null || !BCrypt.Net.BCrypt.Verify(request.Otp, user.ResetOtp))
            {
                return BadRequest(new { success = false, message = "Invalid or expired reset code." });
            }

            if (user.ResetOtpExpiry == null || DateTime.UtcNow > user.ResetOtpExpiry)
            {
                return BadRequest(new { success = false, message = "Reset code has securely expired after 10 minutes." });
            }

            // OTP Verified. Execute Hash override.
            user.Password = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.ResetOtp = null;
            user.ResetOtpExpiry = null;

            if (user.Id != null)
            {
                await _users.UpdateAsync(user.Id, user);
            }

            return Ok(new { message = "Password has been successfully updated!" });
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
