using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartAttendance.API.Models;
using SmartAttendance.API.Services;
using SmartAttendance.API.Data;

namespace SmartAttendance.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly MongoDbService _mongoService;
        private readonly PrismaDbContext _db;
        private readonly IEmailService _emailService;

        public UsersController(MongoDbService mongoService, PrismaDbContext db, IEmailService emailService)
        {
            _mongoService = mongoService;
            _db = db;
            _emailService = emailService;
        }

        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _mongoService.Users.Find(_ => true).ToListAsync();
            var result = users.Select(u => new
            {
                id = u.Id,
                name = u.Name,
                email = u.Email,
                role = u.Role,
                department = u.Department,
                profileImage = u.ProfileImage,
                hasFaceData = u.FaceData != null && u.FaceData.Any(),
                emailDeliveryStatus = u.EmailDeliveryStatus,
                lastEmailAttempt = u.LastEmailAttempt,
                createdAt = u.CreatedAt,
                isDisabled = u.IsDisabled,
                temporaryPassword = u.TemporaryPassword,
                temporaryPasswordCreatedAt = u.TemporaryPasswordCreatedAt,
                isPasswordChanged = u.IsPasswordChanged
            });
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUser(string id)
        {
            var user = await _mongoService.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found" });

            return Ok(new
            {
                id = user.Id,
                name = user.Name,
                email = user.Email,
                role = user.Role,
                department = user.Department,
                profileImage = user.ProfileImage,
                hasFaceData = user.FaceData != null && user.FaceData.Any()
            });
        }

        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] User userIn)
        {
            // Hash password logic for manual admin creation if needed, 
            // but normally register flow handles it. Assuming plain password provided if no hash.
            userIn.Password = BCrypt.Net.BCrypt.HashPassword(userIn.Password);
            await _mongoService.Users.InsertOneAsync(userIn);
            userIn.Password = "";
            return CreatedAtAction(nameof(GetUser), new { id = userIn.Id }, userIn);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(string id, [FromBody] User userIn)
        {
            var existingUser = await _mongoService.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (existingUser == null) return NotFound(new { message = "User not found" });

            userIn.Id = id;
            // Preserve password if it's empty in payload
            if (string.IsNullOrEmpty(userIn.Password))
            {
                userIn.Password = existingUser.Password;
            }
            else
            {
                userIn.Password = BCrypt.Net.BCrypt.HashPassword(userIn.Password);
            }

            await _mongoService.Users.ReplaceOneAsync(u => u.Id == id, userIn);
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(string id)
        {
            var user = await _mongoService.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found" });

            Console.WriteLine($"[CLEANUP] Starting data cleanup for deleted user: {user.Email} (ID: {id})");

            try
            {
                // 1 & 2 & 3. Delete user document (which also physically deletes Face Registration Data and Face Descriptors)
                var result = await _mongoService.Users.DeleteOneAsync(u => u.Id == id);
                Console.WriteLine($"[CLEANUP] User document deleted. Result: {result.DeletedCount > 0}");

                // 4. Delete all attendance records
                var attendanceResult = await _mongoService.Attendances.DeleteManyAsync(a => a.UserId == id);
                Console.WriteLine($"[CLEANUP] Deleted {attendanceResult.DeletedCount} attendance records.");

                // 5. Delete all alerts/notifications
                var alertsResult = await _mongoService.Alerts.DeleteManyAsync(a => a.UserId == id);
                Console.WriteLine($"[CLEANUP] Deleted {alertsResult.DeletedCount} alerts/notifications.");

                // 6. Delete associated access requests so they can apply again
                var accessRequests = await _db.AccessRequests.FindManyAsync(r => r.Email == user.Email);
                int accessReqDeleted = 0;
                foreach (var req in accessRequests)
                {
                    if (req.Id != null) 
                    {
                        await _db.AccessRequests.DeleteAsync(req.Id);
                        accessReqDeleted++;
                    }
                }
                Console.WriteLine($"[CLEANUP] Deleted {accessReqDeleted} access requests for email {user.Email}.");
                Console.WriteLine($"[CLEANUP] User {user.Email} completely expunged from the system.");
                
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to clean up user data completely." });
            }
        }

        [HttpPost("{id}/resend-credentials")]
        public async Task<IActionResult> ResendCredentials(string id)
        {
            var user = await _mongoService.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found" });

            // Generate random password
            var randomDigits = new Random().Next(1000, 9999);
            var password = $"User@{randomDigits}";

            user.Password = BCrypt.Net.BCrypt.HashPassword(password);
            user.TemporaryPassword = password;
            user.TemporaryPasswordCreatedAt = DateTime.UtcNow;
            user.IsPasswordChanged = false;
            user.EmailDeliveryStatus = "Pending";

            await _mongoService.Users.ReplaceOneAsync(u => u.Id == id, user);

            _ = Task.Run(async () =>
            {
                await _emailService.SendWelcomeEmailAsync(user, password);
            });

            return Ok(new { message = "Credentials generated and email sending started.", password = password });
        }

        [HttpPost("{id}/generate-credentials")]
        public async Task<IActionResult> GenerateCredentials(string id)
        {
            var user = await _mongoService.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found" });

            // Generate random password
            var randomDigits = new Random().Next(1000, 9999);
            var password = $"User@{randomDigits}";

            user.Password = BCrypt.Net.BCrypt.HashPassword(password);
            user.TemporaryPassword = password;
            user.TemporaryPasswordCreatedAt = DateTime.UtcNow;
            user.IsPasswordChanged = false;

            await _mongoService.Users.ReplaceOneAsync(u => u.Id == id, user);

            return Ok(new { message = "New temporary credentials generated successfully.", password = password });
        }

        [HttpPut("{id}/toggle-status")]
        public async Task<IActionResult> ToggleStatus(string id)
        {
            var user = await _mongoService.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found" });

            user.IsDisabled = !user.IsDisabled;
            await _mongoService.Users.ReplaceOneAsync(u => u.Id == id, user);

            return Ok(new { message = $"User {(user.IsDisabled ? "disabled" : "enabled")} successfully." });
        }
    }
}
