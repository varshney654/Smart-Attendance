using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartAttendance.API.Models;
using SmartAttendance.API.Services;

namespace SmartAttendance.API.Controllers
{
    [Route("api/face")]
    [ApiController]
    [Authorize]
    public class FaceRecognitionController : ControllerBase
    {
        private readonly MongoDbService _mongoService;

        public FaceRecognitionController(MongoDbService mongoService)
        {
            _mongoService = mongoService;
        }

        public class RegisterFaceDto
        {
            public string UserId { get; set; } = null!;
            public List<double[]> FaceData { get; set; } = new List<double[]>();
        }

        [HttpPost("register")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> RegisterFace([FromBody] RegisterFaceDto dto)
        {
            try 
            {
                if (dto.FaceData == null || !dto.FaceData.Any())
                    return BadRequest(new { message = "No face data provided." });

                var update = Builders<User>.Update.Set(u => u.FaceData, dto.FaceData);
                var result = await _mongoService.Users.UpdateOneAsync(u => u.Id == dto.UserId, update);

                if (result.MatchedCount == 0)
                    return NotFound(new { message = "User not found." });

                return Ok(new { message = "Face registered successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error occurred during registration: " + ex.Message });
            }
        }

        [HttpGet("data")]
        public async Task<IActionResult> GetFaceData()
        {
            try
            {
                var usersWithFaces = await _mongoService.Users
                    .Find(u => u.FaceData != null && u.FaceData.Any())
                    .ToListAsync();

                var payload = usersWithFaces.Select(u => new
                {
                    userId = u.Id,
                    name = u.Name,
                    faceData = u.FaceData
                });

                return Ok(payload);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching face data: " + ex.Message });
            }
        }
    }
}
