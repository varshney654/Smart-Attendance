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
                var smtpEmail = Environment.GetEnvironmentVariable("SMTP_EMAIL") ?? "rajeevgupta2429@gmail.com";
                var smtpPassword = Environment.GetEnvironmentVariable("SMTP_APP_PASSWORD") ?? "dzcetjdsnxcqrutjye";

                Console.WriteLine("[SMTP CONNECTED]");
                using var smtpClient = new System.Net.Mail.SmtpClient("smtp.gmail.com", 587)
                {
                    EnableSsl = true,
                    UseDefaultCredentials = false,
                    Credentials = new System.Net.NetworkCredential(smtpEmail, smtpPassword)
                };

                Console.WriteLine("[SMTP AUTH SUCCESS]");

                var mailMessage = new System.Net.Mail.MailMessage
                {
                    From = new System.Net.Mail.MailAddress(smtpEmail, "Smart Attendance System"),
                    Subject = "Password Reset OTP",
                    Body = $"<p>Your password reset code is: <strong>{otp}</strong></p><p>This code will expire securely in exactly 10 minutes.</p>",
                    IsBodyHtml = true
                };
                mailMessage.To.Add(request.Email);

                smtpClient.Send(mailMessage);
                Console.WriteLine("[SMTP SEND SUCCESS]");
                
                return Ok(new { success = true, message = "OTP sent to your email" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SMTP FAILURE] Gmail Rejection Reason: {ex.Message}");
                if (ex.InnerException != null) 
                {
                    Console.WriteLine($"[SMTP FAILURE] Inner Exception: {ex.InnerException.Message}");
                }
                Console.WriteLine($"[SMTP FAILURE] Stack Trace: {ex.StackTrace}");
                
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

        [HttpPost("/api/request-access")]
        public async Task<IActionResult> RequestAccess([FromBody] RequestAccessDto request)
        {
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

                // 1. Create User
                var user = new User
                {
                    Name = request.Name,
                    Email = request.Email,
                    Role = request.Role,
                    Password = BCrypt.Net.BCrypt.HashPassword(password)
                };
                await _users.CreateAsync(user);
                Console.WriteLine($"[DB SUCCESS] User {request.Email} created successfully.");

                // 2. Create AccessRequest (Auto-Approved)
                var accessRequest = new AccessRequest
                {
                    Name = request.Name,
                    Email = request.Email,
                    Role = request.Role,
                    Status = "Approved"
                };
                await _db.AccessRequests.CreateAsync(accessRequest);

                // 3. Email Sending Logic
                bool emailSent = true;
                try
                {
                    var smtpEmail = Environment.GetEnvironmentVariable("SMTP_EMAIL") ?? "rajeevgupta2429@gmail.com";
                    var smtpPassword = Environment.GetEnvironmentVariable("SMTP_APP_PASSWORD") ?? "dzcetjdsnxcqrutjye";

                    Console.WriteLine("[SMTP CONNECTED]");
                    using var smtpClient = new System.Net.Mail.SmtpClient("smtp.gmail.com", 587)
                    {
                        EnableSsl = true,
                        UseDefaultCredentials = false,
                        Credentials = new System.Net.NetworkCredential(smtpEmail, smtpPassword)
                    };

                    Console.WriteLine("[SMTP AUTH SUCCESS]");

                    var mailMessage = new System.Net.Mail.MailMessage
                    {
                        From = new System.Net.Mail.MailAddress(smtpEmail, "Smart Attendance System"),
                        Subject = "Your Smart Attendance Account Details",
                        Body = $@"
<div style='font-family: Arial, sans-serif; color: #333; line-height: 1.6;'>
    <div style='text-align: center; margin-bottom: 1.5rem;'>
        <img src='https://smart-attendance-2-jimq.onrender.com/logo.png' alt='Smart Attendance Logo' style='width: 64px; height: 64px; margin-bottom: 0.5rem;' />
        <h2 style='margin: 0; color: #1e293b;'>Smart Attendance</h2>
        <p style='margin: 0; color: #64748b; font-size: 0.9rem;'>Your Digital Attendance System</p>
    </div>
    <p>Hello,</p>
    <p>Your access request for the Smart Attendance System has been approved ✅</p>
    <p>Here are your login credentials:</p>
    <p>
        <strong>Email:</strong> {request.Email}<br>
        <strong>Password:</strong> {password}
    </p>
    <p>🔐 Please change your password after first login for security purposes.</p>
    <p>You can login here:<br><a href='https://smart-attendance-2-jimq.onrender.com' style='color: #1a73e8;'>https://smart-attendance-2-jimq.onrender.com</a></p>
    <p>If you face any issues, feel free to reply to this email.</p>
    <p>Regards,<br>Smart Attendance Team</p>
</div>",
                        IsBodyHtml = true
                    };
                    mailMessage.To.Add(request.Email);

                    smtpClient.Send(mailMessage);
                    Console.WriteLine("[SMTP SEND SUCCESS]");
                }
                catch (Exception ex)
                {
                    emailSent = false;
                    Console.WriteLine($"[SMTP FAILURE] RequestAccess Gmail Exception: {ex.Message}");
                    if (ex.InnerException != null) 
                    {
                        Console.WriteLine($"[SMTP FAILURE] Inner Exception: {ex.InnerException.Message}");
                    }
                }

                // 4. Final API Response
                if (emailSent)
                {
                    return Ok(new { success = true, message = "Account created successfully. Check your email." });
                }
                else
                {
                    return Ok(new { success = true, message = "Request submitted successfully, but email delivery failed." });
                }
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
                Password = BCrypt.Net.BCrypt.HashPassword(password)
            };
            await _users.CreateAsync(user);

            request.Status = "Approved";
            await _db.AccessRequests.UpdateAsync(id, request);

            // Run email in background to avoid blocking the API response
            _ = Task.Run(async () =>
            {
                try
                {
                    var smtpEmail = Environment.GetEnvironmentVariable("SMTP_EMAIL") ?? "rajeevgupta2429@gmail.com";
                    var smtpPassword = Environment.GetEnvironmentVariable("SMTP_APP_PASSWORD") ?? "dzcetjdsnxcqrutjye";

                    Console.WriteLine("[SMTP CONNECTED]");
                    using var smtpClient = new System.Net.Mail.SmtpClient("smtp.gmail.com", 587)
                    {
                        EnableSsl = true,
                        UseDefaultCredentials = false,
                        Credentials = new System.Net.NetworkCredential(smtpEmail, smtpPassword)
                    };

                    Console.WriteLine("[SMTP AUTH SUCCESS]");

                    var mailMessage = new System.Net.Mail.MailMessage
                    {
                        From = new System.Net.Mail.MailAddress(smtpEmail, "Smart Attendance System"),
                        Subject = "Access Request Approved",
                        Body = $@"
<div style='font-family: Arial, sans-serif; color: #333; line-height: 1.6;'>
    <div style='text-align: center; margin-bottom: 1.5rem;'>
        <img src='https://smart-attendance-2-jimq.onrender.com/logo.png' alt='Smart Attendance Logo' style='width: 64px; height: 64px; margin-bottom: 0.5rem;' />
        <h2 style='margin: 0; color: #1e293b;'>Smart Attendance</h2>
        <p style='margin: 0; color: #64748b; font-size: 0.9rem;'>Your Digital Attendance System</p>
    </div>
    <p>Hello {request.Name},</p>
    <p>Your access request for the Smart Attendance System has been approved ✅</p>
    <p>Here are your login credentials:</p>
    <p>
        <strong>Email:</strong> {request.Email}<br>
        <strong>Password:</strong> {password}
    </p>
    <p>🔐 Please change your password after first login for security purposes.</p>
    <p>You can login here:<br><a href='https://smart-attendance-2-jimq.onrender.com' style='color: #1a73e8;'>https://smart-attendance-2-jimq.onrender.com</a></p>
    <p>If you face any issues, feel free to reply to this email.</p>
    <p>Regards,<br>Smart Attendance Team</p>
</div>",
                        IsBodyHtml = true
                    };
                    mailMessage.To.Add(request.Email);

                    await smtpClient.SendMailAsync(mailMessage);
                    Console.WriteLine("[SMTP SEND SUCCESS]");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SMTP FAILURE] ApproveRequest Gmail Exception: {ex.Message}");
                    if (ex.InnerException != null) 
                    {
                        Console.WriteLine($"[SMTP FAILURE] Inner Exception: {ex.InnerException.Message}");
                    }
                }
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
