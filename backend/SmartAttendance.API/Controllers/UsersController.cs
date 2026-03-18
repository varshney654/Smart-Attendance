using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartAttendance.API.Models;
using SmartAttendance.API.Services;

namespace SmartAttendance.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly MongoDbService _mongoService;

        public UsersController(MongoDbService mongoService)
        {
            _mongoService = mongoService;
        }

        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _mongoService.Users.Find(_ => true).ToListAsync();
            // Sanitize passwords
            foreach (var user in users)
            {
                user.Password = "";
            }
            return Ok(users);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUser(string id)
        {
            var user = await _mongoService.Users.Find(u => u.Id == id).FirstOrDefaultAsync();
            if (user == null) return NotFound(new { message = "User not found" });

            user.Password = "";
            return Ok(user);
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
            var result = await _mongoService.Users.DeleteOneAsync(u => u.Id == id);
            if (result.DeletedCount == 0) return NotFound(new { message = "User not found" });

            return NoContent();
        }
    }
}
