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
                try
                {
                    Console.WriteLine($"[DEBUG] Generated OTP for {request.Email}: {otp}");
                    var smtpEmail = Environment.GetEnvironmentVariable("SMTP_EMAIL") ?? "smartattendance88@gmail.com";
                    var smtpPassword = Environment.GetEnvironmentVariable("SMTP_APP_PASSWORD") ?? "bmvi jgsv njlj udmb";

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

                    await smtpClient.SendMailAsync(mailMessage);
                    Console.WriteLine("[SMTP SEND SUCCESS]");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SMTP FAILURE] SendResetCode Gmail Exception: {ex.Message}");
                    if (ex.InnerException != null) 
                    {
                        Console.WriteLine($"[SMTP FAILURE] Inner Exception: {ex.InnerException.Message}");
                    }
                    Console.WriteLine($"[SMTP FAILURE] Stack Trace: {ex.StackTrace}");
                }
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
                    Password = BCrypt.Net.BCrypt.HashPassword(password)
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

                // Send email synchronously to catch failures before returning 200 OK
                try
                {
                    Console.WriteLine("[CREDENTIAL EMAIL START]");
                    var smtpEmail = Environment.GetEnvironmentVariable("SMTP_EMAIL") ?? "smartattendance88@gmail.com";
                    var smtpPassword = Environment.GetEnvironmentVariable("SMTP_APP_PASSWORD") ?? "bmvi jgsv njlj udmb";

                    using var smtpClient = new System.Net.Mail.SmtpClient("smtp.gmail.com", 587)
                    {
                        EnableSsl = true,
                        UseDefaultCredentials = false,
                        Credentials = new System.Net.NetworkCredential(smtpEmail, smtpPassword),
                        Timeout = 15000 // Enforce a 15-second timeout to prevent infinite hanging
                    };

                    var userMailMessage = new System.Net.Mail.MailMessage
                    {
                        From = new System.Net.Mail.MailAddress(smtpEmail, "Smart Attendance System"),
                        Subject = "Welcome to Smart Attendance - Your Account is Ready",
                        Body = $@"
<div style='font-family: ""Segoe UI"", Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 2rem 1rem;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);'>
        <!-- Header -->
        <div style='background-color: #0f172a; padding: 2.5rem 2rem; text-align: center;'>
            <img src='https://smart-attendance-2-jimq.onrender.com/logo.png' alt='Smart Attendance Logo' style='width: 64px; height: 64px; margin-bottom: 1rem;' />
            <h1 style='color: #ffffff; margin: 0; font-size: 1.5rem; font-weight: 600; letter-spacing: 0.5px;'>Smart Attendance</h1>
            <p style='color: #94a3b8; margin: 0.5rem 0 0; font-size: 0.95rem;'>AI-Powered Attendance Management</p>
        </div>
        
        <!-- Content -->
        <div style='padding: 2.5rem 2rem;'>
            <h2 style='color: #1e293b; margin-top: 0; font-size: 1.25rem;'>Hello {request.Name}, 👋</h2>
            <p style='color: #475569; line-height: 1.6; font-size: 1rem;'>Welcome to the Smart Attendance System! Your account has been successfully created and is ready to use.</p>
            
            <!-- Credentials Box -->
            <div style='background-color: #f1f5f9; border-left: 4px solid #22c55e; padding: 1.5rem; border-radius: 0 8px 8px 0; margin: 2rem 0;'>
                <h3 style='margin-top: 0; color: #0f172a; font-size: 1.1rem; margin-bottom: 1.25rem;'>📋 Account Details</h3>
                <table style='width: 100%; border-collapse: collapse;'>
                    <tr>
                        <td style='padding: 0.5rem 0; color: #64748b; width: 100px; font-weight: 500;'>Name:</td>
                        <td style='padding: 0.5rem 0; color: #0f172a; font-weight: 600;'>{request.Name}</td>
                    </tr>
                    <tr>
                        <td style='padding: 0.5rem 0; color: #64748b; font-weight: 500;'>Role:</td>
                        <td style='padding: 0.5rem 0;'>
                            <span style='background-color: #d1fae5; color: #059669; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600;'>{request.Role}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding: 0.5rem 0; color: #64748b; font-weight: 500;'>Email:</td>
                        <td style='padding: 0.5rem 0; color: #0f172a; font-weight: 600;'>{request.Email}</td>
                    </tr>
                    <tr>
                        <td style='padding: 0.5rem 0; color: #64748b; font-weight: 500;'>Password:</td>
                        <td style='padding: 0.5rem 0;'>
                            <span style='color: #0f172a; font-weight: 600; letter-spacing: 1px; background-color: #e2e8f0; padding: 0.25rem 0.5rem; border-radius: 4px;'>{password}</span>
                        </td>
                    </tr>
                </table>
            </div>
            
            <!-- CTA Button -->
            <div style='text-align: center; margin: 2.5rem 0;'>
                <a href='https://smart-attendance-2-jimq.onrender.com/login' style='background-color: #22c55e; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem; display: inline-block; box-shadow: 0 4px 6px -1px rgba(34, 197, 94, 0.4);'>
                    Login Now
                </a>
            </div>
            
            <!-- Getting Started -->
            <h3 style='color: #0f172a; font-size: 1.1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 2.5rem;'>🚀 Getting Started</h3>
            <ol style='color: #475569; line-height: 1.7; padding-left: 1.5rem; margin-top: 1rem;'>
                <li style='margin-bottom: 0.5rem;'>Open the login portal using the button above.</li>
                <li style='margin-bottom: 0.5rem;'>Login using your secure credentials.</li>
                <li style='margin-bottom: 0.5rem;'>Register your face biometric data after your first login.</li>
                <li>Start marking your attendance seamlessly.</li>
            </ol>
            
            <!-- Features -->
            <h3 style='color: #0f172a; font-size: 1.1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 2rem;'>✨ Features Available</h3>
            <ul style='color: #475569; line-height: 1.7; padding-left: 0; list-style-type: none; margin-top: 1rem;'>
                <li style='margin-bottom: 0.5rem;'>✅ Face Recognition Attendance</li>
                <li style='margin-bottom: 0.5rem;'>✅ Attendance History</li>
                <li style='margin-bottom: 0.5rem;'>✅ Analytics Dashboard</li>
                <li style='margin-bottom: 0.5rem;'>✅ Attendance Reports</li>
                <li>✅ Profile Management</li>
            </ul>

            <!-- Security Notice -->
            <div style='background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 1.25rem; border-radius: 0 8px 8px 0; margin: 2.5rem 0;'>
                <h4 style='margin: 0 0 0.5rem 0; color: #b45309; font-size: 1rem;'>🔒 Security Notice</h4>
                <ul style='color: #92400e; margin: 0; padding-left: 1.25rem; font-size: 0.9rem; line-height: 1.5;'>
                    <li style='margin-bottom: 0.25rem;'>This is a temporary system-generated password.</li>
                    <li style='margin-bottom: 0.25rem;'>Please change your password immediately after your first login.</li>
                    <li>Do not share your credentials with anyone.</li>
                </ul>
            </div>
            
            <p style='color: #475569; line-height: 1.6; margin-top: 2.5rem;'>
                If you face any issues, please contact the system administrator.<br><br>
                Thank you for using Smart Attendance.<br>
                <strong style='color: #0f172a;'>Best Regards,<br>Smart Attendance Team</strong>
            </p>
        </div>
        
        <!-- Footer -->
        <div style='background-color: #f8fafc; padding: 2rem; text-align: center; border-top: 1px solid #e2e8f0;'>
            <p style='color: #64748b; margin: 0; font-size: 0.85rem;'>&copy; 2026 Smart Attendance System</p>
            <p style='color: #94a3b8; margin: 0.25rem 0 0; font-size: 0.8rem;'>AI-Powered Attendance Management Platform</p>
        </div>
    </div>
</div>",
                        IsBodyHtml = true
                    };
                    userMailMessage.To.Add(request.Email);
                    
                    // Send synchronously to enforce Timeout
                    smtpClient.Send(userMailMessage);
                    Console.WriteLine("[CREDENTIAL EMAIL SUCCESS]");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[CREDENTIAL EMAIL FAILURE] RequestAccess Exception: {ex.Message}");
                    if (ex.InnerException != null) 
                    {
                        Console.WriteLine($"[SMTP FAILURE] Inner Exception: {ex.InnerException.Message}");
                    }
                    return StatusCode(500, new { success = false, message = "User created, but SMTP failed to send credentials: " + ex.Message });
                }

                return Ok(new { success = true, message = "Your account has been created successfully. Login credentials have been sent to your email." });

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
                    var smtpEmail = Environment.GetEnvironmentVariable("SMTP_EMAIL") ?? "smartattendance88@gmail.com";
                    var smtpPassword = Environment.GetEnvironmentVariable("SMTP_APP_PASSWORD") ?? "bmvi jgsv njlj udmb";

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
