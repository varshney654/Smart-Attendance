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
        private readonly IEmailService _emailService;

        public AuthController(PrismaDbContext db, IEmailService emailService)
        {
            _db = db;
            _users = db.Users;
            _emailService = emailService;
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
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            Console.WriteLine("[LOGIN REQUEST RECEIVED]");
            Console.WriteLine($"[LOGIN ATTEMPT] Email: {loginDto.Email}, Role: {loginDto.Role}");

            Console.WriteLine("[DB QUERY START]");
            // Find user using Prisma-like ORM, explicitly excluding FaceData for performance
            var user = await _users.FindByEmailWithoutFaceDataAsync(loginDto.Email);
            Console.WriteLine($"[DB QUERY COMPLETE] Time: {stopwatch.ElapsedMilliseconds}ms");

            if (user == null)
            {
                Console.WriteLine("[LOGIN FAILED] User not found.");
                return NotFound(new { message = "User not found", status = 404 });
            }

            if (user.IsDisabled)
            {
                Console.WriteLine("[LOGIN FAILED] User account is disabled.");
                return Unauthorized(new { message = "Your account has been disabled. Please contact the administrator.", status = 403 });
            }

            var passCheckStart = stopwatch.ElapsedMilliseconds;
            if (!BCrypt.Net.BCrypt.Verify(loginDto.Password, user.Password))
            {
                Console.WriteLine("[LOGIN FAILED] Invalid password.");
                return Unauthorized(new { message = "Invalid password", status = 401 });
            }
            Console.WriteLine($"[PASSWORD VERIFIED] Time: {stopwatch.ElapsedMilliseconds - passCheckStart}ms");

            if (!string.Equals(user.Role, loginDto.Role, StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine($"[LOGIN FAILED] Role mismatch. Expected: {user.Role}, Provided: {loginDto.Role}");
                return Unauthorized(new { message = "Role mismatch", status = 401 });
            }

            var jwtStart = stopwatch.ElapsedMilliseconds;
            var token = GenerateJwtToken(user);
            Console.WriteLine($"[JWT GENERATED] Time: {stopwatch.ElapsedMilliseconds - jwtStart}ms");

            // Do not send password back
            user.Password = "";
            // PERFORMANCE OPTIMIZATION: FaceData is already excluded by the DB query, but ensure it's an empty list for the frontend
            user.FaceData = new List<double[]>();

            Console.WriteLine($"[RESPONSE SENT] Total Time: {stopwatch.ElapsedMilliseconds}ms");
            Console.WriteLine($"[LOGIN SUCCESS] User {loginDto.Email} logged in successfully");

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

            // Rate Limiting Logic: Max 3 requests in 15 minutes
            if (user.OtpLastRequestedAt.HasValue && (DateTime.UtcNow - user.OtpLastRequestedAt.Value).TotalMinutes < 15)
            {
                if (user.FailedOtpAttempts >= 3)
                {
                    return BadRequest(new { success = false, message = "Too many requests. Please try again after 15 minutes." });
                }
                user.FailedOtpAttempts++;
            }
            else
            {
                user.FailedOtpAttempts = 1;
            }

            user.OtpLastRequestedAt = DateTime.UtcNow;

            var otp = new Random().Next(100000, 999999).ToString();
            user.ResetOtp = BCrypt.Net.BCrypt.HashPassword(otp);
            user.ResetOtpExpiry = DateTime.UtcNow.AddMinutes(10);
            
            if (user.Id != null)
            {
                await _users.UpdateAsync(user.Id, user);
            }

            // Run email in background to avoid blocking the API response
            _ = Task.Run(async () =>
            {
                await _emailService.SendResetOtpAsync(user, otp);
            });

            return Ok(new { success = true, message = "OTP sent to your email" });
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
            user.FailedOtpAttempts = 0;
            user.TemporaryPassword = null; // Clear any temp password on successful reset
            user.TemporaryPasswordCreatedAt = null;
            user.IsPasswordChanged = true;

            if (user.Id != null)
            {
                await _users.UpdateAsync(user.Id, user);
            }

            return Ok(new { message = "Password has been successfully updated!" });
        }

        [HttpPost("/api/request-access")]
        public async Task<IActionResult> RequestAccess([FromBody] RequestAccessDto request)
        {
            Console.WriteLine("[REQUEST RECEIVED]");
            try
            {
                var existingUser = await _users.FindByEmailAsync(request.Email);
                if (existingUser != null)
                {
                    return BadRequest(new { success = false, message = "Email already in use." });
                }

                // Generate random password
                var randomDigits = new Random().Next(1000, 9999);
                var password = $"User@{randomDigits}";
                Console.WriteLine($"[PASSWORD GENERATED] Password: {password}");

                // Create User
                var user = new User
                {
                    Name = request.Name,
                    Email = request.Email,
                    Role = request.Role,
                    Password = BCrypt.Net.BCrypt.HashPassword(password),
                    TemporaryPassword = password,
                    TemporaryPasswordCreatedAt = DateTime.UtcNow,
                    IsPasswordChanged = false,
                    EmailDeliveryStatus = "Pending"
                };
                await _users.CreateAsync(user);
                Console.WriteLine("[USER CREATED]");

                // Create AccessRequest (Auto Approved)
                var accessRequest = new AccessRequest
                {
                    Name = request.Name,
                    Email = request.Email,
                    Role = request.Role,
                    Status = "Auto Approved"
                };
                await _db.AccessRequests.CreateAsync(accessRequest);

                // Run email in background to avoid blocking account creation
                _ = Task.Run(async () =>
                {
                    await _emailService.SendWelcomeEmailAsync(user, password);
                });

                return Ok(new { success = true, message = "Your account has been created successfully. Login credentials will be sent to your email shortly." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] DB save failed: {ex.Message}");
                return StatusCode(500, new { success = false, message = "Failed to submit request." });
            }
        }

        [HttpGet("/api/requests")]
        public async Task<IActionResult> GetRequests()
        {
            var requests = await _db.AccessRequests.FindAllAsync();
            return Ok(requests);
        }

        [HttpPost("/api/approve/{id}")]
        public async Task<IActionResult> ApproveRequest(string id)
        {
            var request = await _db.AccessRequests.FindByIdAsync(id);
            if (request == null) return NotFound(new { message = "Request not found" });
            if (request.Status != "Pending") return BadRequest(new { message = "Request is already processed" });

            // Generate simple random password
            var randomDigits = new Random().Next(1000, 9999);
            var password = $"User@{randomDigits}";
            
            var user = new User
            {
                Name = request.Name,
                Email = request.Email,
                Role = request.Role,
                Password = BCrypt.Net.BCrypt.HashPassword(password),
                TemporaryPassword = password,
                TemporaryPasswordCreatedAt = DateTime.UtcNow,
                IsPasswordChanged = false,
                EmailDeliveryStatus = "Pending"
            };
            await _users.CreateAsync(user);

            request.Status = "Approved";
            await _db.AccessRequests.UpdateAsync(id, request);

            // Run email in background to avoid blocking the API response
            _ = Task.Run(async () =>
            {
                await _emailService.SendAccessApprovedEmailAsync(user, password);
            });

            return Ok(new { success = true, message = "Request approved and user created." });
        }

        [HttpPost("/api/reject/{id}")]
        public async Task<IActionResult> RejectRequest(string id)
        {
            var request = await _db.AccessRequests.FindByIdAsync(id);
            if (request == null) return NotFound(new { message = "Request not found" });
            
            request.Status = "Rejected";
            await _db.AccessRequests.UpdateAsync(id, request);
            return Ok(new { success = true, message = "Request rejected." });
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
