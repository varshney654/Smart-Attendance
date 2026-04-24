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

                // Cross-verification loop to strictly prevent duplicate Identity registrations
                var allEnrolledUsers = await _mongoService.Users.Find(u => u.FaceData != null && u.FaceData.Any()).ToListAsync();
                
                foreach (var user in allEnrolledUsers)
                {
                    // Allow the user to overwrite their own FaceData safely
                    if (user.Id == dto.UserId) continue;

                    // Evaluate every new sample array against every existing sample array
                    foreach (var existingEmbedding in user.FaceData)
                    {
                        foreach (var incomingEmbedding in dto.FaceData)
                        {
                            double distance = EuclideanDistance(existingEmbedding, incomingEmbedding);
                            if (distance < 0.5)
                            {
                                // A mathematical match was found against a DIFFERENT user in the database
                                return BadRequest(new { message = "Face already registered to another user in the system." });
                            }
                        }
                    }
                }

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

        private double EuclideanDistance(double[] source, double[] target)
        {
            if (source.Length != target.Length) return double.MaxValue;
            double sum = 0;
            for (int i = 0; i < source.Length; i++)
            {
                sum += Math.Pow(source[i] - target[i], 2);
            }
            return Math.Sqrt(sum);
        }

        [HttpGet("data")]
        public async Task<IActionResult> GetFaceData()
        {
            try
            {
                var loggedInUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                                  ?? User.FindFirst("id")?.Value 
                                  ?? User.FindFirst("sub")?.Value;
                var loggedInRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value 
                                ?? User.FindFirst("role")?.Value;

                List<User> usersWithFaces;
                
                if (loggedInRole == "Admin")
                {
                    usersWithFaces = await _mongoService.Users
                        .Find(u => u.FaceData != null && u.FaceData.Any())
                        .ToListAsync();
                }
                else
                {
                    usersWithFaces = await _mongoService.Users
                        .Find(u => u.Id == loggedInUserId && u.FaceData != null && u.FaceData.Any())
                        .ToListAsync();
                }

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
