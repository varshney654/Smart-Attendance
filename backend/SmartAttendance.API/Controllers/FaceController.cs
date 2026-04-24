using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartAttendance.API.DTOs;
using SmartAttendance.API.Models;
using SmartAttendance.API.Services;

namespace SmartAttendance.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FaceController : ControllerBase
    {
        private readonly MongoDbService _mongoService;

        public FaceController(MongoDbService mongoService)
        {
            _mongoService = mongoService;
        }

        [HttpPost("register")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> RegisterFace([FromBody] RegisterFaceDto request)
        {
            if (string.IsNullOrEmpty(request.UserId) || request.Embeddings == null || !request.Embeddings.Any())
                return BadRequest("Invalid request data.");

            var user = await _mongoService.Users.Find(u => u.Id == request.UserId).FirstOrDefaultAsync();
            if (user == null)
                return NotFound("User not found.");

            var update = Builders<User>.Update.Set(u => u.FaceData, request.Embeddings);
            await _mongoService.Users.UpdateOneAsync(u => u.Id == request.UserId, update);

            return Ok(new { message = "Face registered successfully." });
        }

        [HttpPost("match")]
        public async Task<IActionResult> MatchFace([FromBody] MatchFaceDto request)
        {
            if (request.Embedding == null || request.Embedding.Length == 0)
                return BadRequest("Invalid embedding.");

            var allUsers = await _mongoService.Users.Find(u => u.FaceData != null && u.FaceData.Any()).ToListAsync();
            
            User? bestMatch = null;
            double bestDistance = double.MaxValue;
            double threshold = 0.55; // Threshold for face-api.js euclidean distance (smaller is better). 0.6 is common, 0.55 is stricter.

            foreach (var user in allUsers)
            {
                if (user.FaceData == null || !user.FaceData.Any()) continue;

                // Find average distance to this user's registered embeddings
                double totalDistance = 0;
                foreach (var registeredEmbedding in user.FaceData)
                {
                    totalDistance += EuclideanDistance(request.Embedding, registeredEmbedding);
                }
                
                double averageDistance = totalDistance / user.FaceData.Count;

                if (averageDistance < bestDistance)
                {
                    bestDistance = averageDistance;
                    bestMatch = user;
                }
            }

            if (bestMatch != null && bestDistance <= threshold)
            {
                // Convert distance to a confidence percentage
                double confidence = Math.Max(0, Math.Min(1, 1 - (bestDistance / (threshold * 1.5))));
                
                return Ok(new 
                { 
                    match = true, 
                    userId = bestMatch.Id, 
                    userName = bestMatch.Name, 
                    confidence = Math.Round(confidence * 100, 2) 
                });
            }

            return Ok(new { match = false, message = "No matching face found.", distance = bestDistance });
        }

        private double EuclideanDistance(double[] a, double[] b)
        {
            if (a.Length != b.Length)
                return double.MaxValue; // Dimension mismatch 

            double sum = 0;
            for (int i = 0; i < a.Length; i++)
            {
                sum += Math.Pow(a[i] - b[i], 2);
            }
            return Math.Sqrt(sum);
        }
    }
}
