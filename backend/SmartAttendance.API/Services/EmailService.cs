using System.Net.Mail;
using Microsoft.Extensions.DependencyInjection;
using SmartAttendance.API.Data;
using SmartAttendance.API.Models;

namespace SmartAttendance.API.Services
{
    public interface IEmailService
    {
        Task SendWelcomeEmailAsync(User user, string plainPassword);
        Task SendResetOtpAsync(User user, string otp);
        Task SendAccessApprovedEmailAsync(User user, string plainPassword);
    }

    public class EmailService : IEmailService
    {
        private readonly IServiceScopeFactory _scopeFactory;

        public EmailService(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
        }

        private async Task ExecuteWithRetryAsync(string email, string subject, string body, User userToUpdate)
        {
            int maxRetries = 3;
            int[] delaySeconds = { 2, 5, 10 };
            
            var smtpEmail = Environment.GetEnvironmentVariable("SMTP_EMAIL") ?? "smartattendance88@gmail.com";
            var smtpPassword = Environment.GetEnvironmentVariable("SMTP_APP_PASSWORD") ?? "bmvi jgsv njlj udmb";

            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    Console.WriteLine($"[SMTP ATTEMPT {attempt}] Sending to {email}...");
                    
                    using var smtpClient = new SmtpClient("smtp.gmail.com", 587)
                    {
                        EnableSsl = true,
                        UseDefaultCredentials = false,
                        Credentials = new System.Net.NetworkCredential(smtpEmail, smtpPassword),
                        Timeout = 60000 // 60 seconds
                    };

                    var mailMessage = new MailMessage
                    {
                        From = new MailAddress(smtpEmail, "Smart Attendance System"),
                        Subject = subject,
                        Body = body,
                        IsBodyHtml = true
                    };
                    mailMessage.To.Add(email);

                    await smtpClient.SendMailAsync(mailMessage);
                    
                    Console.WriteLine($"[SMTP SUCCESS] Email sent to {email} on attempt {attempt}");
                    
                    // Update user status
                    await UpdateUserEmailStatusAsync(userToUpdate.Id, "Sent");
                    return; // Success
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SMTP FAILURE] Attempt {attempt} failed for {email}");
                    Console.WriteLine($"User: {email}");
                    Console.WriteLine($"Time: {DateTime.UtcNow}");
                    Console.WriteLine($"Error: {ex.Message}");
                    Console.WriteLine($"Stack Trace: {ex.StackTrace}");
                    
                    if (attempt < maxRetries)
                    {
                        int delay = delaySeconds[attempt - 1];
                        Console.WriteLine($"[RETRYING IN {delay}s]");
                        await Task.Delay(delay * 1000);
                    }
                    else
                    {
                        Console.WriteLine($"[SMTP ABORTED] All {maxRetries} attempts failed.");
                        await UpdateUserEmailStatusAsync(userToUpdate.Id, "Failed");
                    }
                }
            }
        }

        private async Task UpdateUserEmailStatusAsync(string? userId, string status)
        {
            if (string.IsNullOrEmpty(userId)) return;

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PrismaDbContext>();
                
                var user = await db.Users.FindByIdAsync(userId);
                if (user != null)
                {
                    user.EmailDeliveryStatus = status;
                    user.LastEmailAttempt = DateTime.UtcNow;
                    if (status == "Sent")
                    {
                        user.EmailSent = true;
                        user.EmailSentAt = DateTime.UtcNow;
                    }
                    await db.Users.UpdateAsync(userId, user);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB FAILURE] Could not update email status for user {userId}: {ex.Message}");
            }
        }

        public async Task SendWelcomeEmailAsync(User user, string plainPassword)
        {
            var subject = "Welcome to Smart Attendance - Your Account is Ready";
            var body = $@"
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
            <h2 style='color: #1e293b; margin-top: 0; font-size: 1.25rem;'>Hello {user.Name}, 👋</h2>
            <p style='color: #475569; line-height: 1.6; font-size: 1rem;'>Welcome to the Smart Attendance System! Your account has been successfully created and is ready to use.</p>
            
            <!-- Credentials Box -->
            <div style='background-color: #f1f5f9; border-left: 4px solid #22c55e; padding: 1.5rem; border-radius: 0 8px 8px 0; margin: 2rem 0;'>
                <h3 style='margin-top: 0; color: #0f172a; font-size: 1.1rem; margin-bottom: 1.25rem;'>📋 Account Details</h3>
                <table style='width: 100%; border-collapse: collapse;'>
                    <tr>
                        <td style='padding: 0.5rem 0; color: #64748b; width: 100px; font-weight: 500;'>Name:</td>
                        <td style='padding: 0.5rem 0; color: #0f172a; font-weight: 600;'>{user.Name}</td>
                    </tr>
                    <tr>
                        <td style='padding: 0.5rem 0; color: #64748b; font-weight: 500;'>Role:</td>
                        <td style='padding: 0.5rem 0;'>
                            <span style='background-color: #d1fae5; color: #059669; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600;'>{user.Role}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding: 0.5rem 0; color: #64748b; font-weight: 500;'>Email:</td>
                        <td style='padding: 0.5rem 0; color: #0f172a; font-weight: 600;'>{user.Email}</td>
                    </tr>
                    <tr>
                        <td style='padding: 0.5rem 0; color: #64748b; font-weight: 500;'>Password:</td>
                        <td style='padding: 0.5rem 0;'>
                            <span style='color: #0f172a; font-weight: 600; letter-spacing: 1px; background-color: #e2e8f0; padding: 0.25rem 0.5rem; border-radius: 4px;'>{plainPassword}</span>
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
</div>";

            await ExecuteWithRetryAsync(user.Email, subject, body, user);
        }

        public async Task SendResetOtpAsync(User user, string otp)
        {
            var subject = "Password Reset OTP - Smart Attendance";
            var body = $@"
<div style='font-family: ""Segoe UI"", Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 2rem 1rem;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);'>
        <div style='background-color: #0f172a; padding: 2.5rem 2rem; text-align: center;'>
            <h1 style='color: #ffffff; margin: 0; font-size: 1.5rem; font-weight: 600;'>Password Reset</h1>
        </div>
        <div style='padding: 2.5rem 2rem;'>
            <h2 style='color: #1e293b; margin-top: 0; font-size: 1.25rem;'>Hello {user.Name},</h2>
            <p style='color: #475569; line-height: 1.6; font-size: 1rem;'>You recently requested to reset your password for your Smart Attendance account. Use the code below to reset it. This code will securely expire in exactly 10 minutes.</p>
            
            <div style='text-align: center; margin: 2rem 0;'>
                <span style='background-color: #f1f5f9; border: 2px dashed #94a3b8; color: #0f172a; font-size: 2rem; font-weight: 700; letter-spacing: 4px; padding: 1rem 2rem; border-radius: 8px; display: inline-block;'>
                    {otp}
                </span>
            </div>
            
            <p style='color: #64748b; font-size: 0.9rem; text-align: center;'>If you did not request a password reset, please ignore this email.</p>
        </div>
    </div>
</div>";
            await ExecuteWithRetryAsync(user.Email, subject, body, user);
        }

        public async Task SendAccessApprovedEmailAsync(User user, string plainPassword)
        {
            var subject = "Access Request Approved - Smart Attendance";
            var body = $@"
<div style='font-family: Arial, sans-serif; color: #333; line-height: 1.6;'>
    <div style='text-align: center; margin-bottom: 1.5rem;'>
        <img src='https://smart-attendance-2-jimq.onrender.com/logo.png' alt='Smart Attendance Logo' style='width: 64px; height: 64px; margin-bottom: 0.5rem;' />
        <h2 style='margin: 0; color: #1e293b;'>Smart Attendance</h2>
        <p style='margin: 0; color: #64748b; font-size: 0.9rem;'>Your Digital Attendance System</p>
    </div>
    <p>Hello {user.Name},</p>
    <p>Your access request for the Smart Attendance System has been approved ✅</p>
    <p>Here are your login credentials:</p>
    <p>
        <strong>Email:</strong> {user.Email}<br>
        <strong>Password:</strong> {plainPassword}
    </p>
    <p>🔐 Please change your password after first login for security purposes.</p>
    <p>You can login here:<br><a href='https://smart-attendance-2-jimq.onrender.com' style='color: #1a73e8;'>https://smart-attendance-2-jimq.onrender.com</a></p>
    <p>If you face any issues, feel free to reply to this email.</p>
    <p>Regards,<br>Smart Attendance Team</p>
</div>";
            await ExecuteWithRetryAsync(user.Email, subject, body, user);
        }
    }
}
