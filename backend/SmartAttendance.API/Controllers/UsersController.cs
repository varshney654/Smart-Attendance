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

        public UsersController(MongoDbService mongoService, PrismaDbContext db)
        {
            _mongoService = mongoService;
            _db = db;
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
                hasFaceData = u.FaceData != null && u.FaceData.Any()
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
                Console.WriteLine($"[CLEANUP ERROR] Failed to clean up user data: {ex.Message}");
                return StatusCode(500, new { message = "Failed to clean up user data completely." });
            }
        }
    }
}
