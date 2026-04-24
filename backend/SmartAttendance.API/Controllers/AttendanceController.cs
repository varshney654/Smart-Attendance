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
    public class AttendanceController : ControllerBase
    {
        private readonly MongoDbService _mongoService;
        private readonly ILogger<AttendanceController> _logger;

        public AttendanceController(MongoDbService mongoService, ILogger<AttendanceController> logger)
        {
            _mongoService = mongoService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetAttendanceRecords([FromQuery] string? search, [FromQuery] string? status, [FromQuery] string? dateRange)
        {
            var loggedInUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                              ?? User.FindFirst("id")?.Value 
                              ?? User.FindFirst("sub")?.Value;
                              
            var loggedInRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value 
                            ?? User.FindFirst("role")?.Value;

            var filterBuilder = Builders<Attendance>.Filter;
            var filter = filterBuilder.Empty;

            if (loggedInRole != "Admin")
            {
                if (string.IsNullOrEmpty(loggedInUserId))
                {
                    return Unauthorized(new { success = false, message = "Security Exception: Authentic JWT Token does not carry a verifiable NameIdentifier." });
                }
                
                Console.WriteLine($"[DEBUG] GetAttendanceRecords - Extracted JWT userId: {loggedInUserId}");
                
                filter &= filterBuilder.Eq(a => a.UserId, loggedInUserId);
            }

            if (!string.IsNullOrEmpty(status) && status != "All Status")
            {
                filter &= filterBuilder.Eq(a => a.Status, status);
            }

            // Implement dateRange filters for '7 Days', '30 Days', 'All Time'
            if (!string.IsNullOrEmpty(dateRange) && dateRange != "All Time")
            {
                var days = dateRange == "7 Days" ? -7 : -30;
                var startDate = DateTime.UtcNow.AddDays(days).Date;
                filter &= filterBuilder.Gte(a => a.Date, startDate);
            }

            var records = await _mongoService.Attendances.Find(filter).SortByDescending(a => a.Date).ThenByDescending(a => a.Time).ToListAsync();

            if (loggedInRole != "Admin")
            {
                Console.WriteLine($"[DEBUG] GetAttendanceRecords - Found {records.Count} records for user: {loggedInUserId}");
                if (records.Count == 0)
                {
                    Console.WriteLine($"[WARNING] UserId mismatch or no attendance data found for: {loggedInUserId}");
                }
            }

            // Enrich with usernames in a structured way (ideally via lookup, but manual here for simplicity)
            var userIds = records.Select(r => r.UserId).Where(id => id != null).Distinct().ToList();
            var users = await _mongoService.Users.Find(u => u.Id != null && userIds.Contains(u.Id)).ToListAsync();
            var userDict = users.Where(u => u.Id != null).ToDictionary(u => u.Id!, u => u.Name);

            var enrichedRecords = records.Select(r => new
            {
                r.Id,
                r.UserId,
                UserName = userDict.ContainsKey(r.UserId) ? userDict[r.UserId] : "Unknown",
                r.Date,
                r.Time,
                r.Status,
                r.Method,
                r.Confidence,
                r.Latitude,
                r.Longitude
            });

            return Ok(enrichedRecords);
        }

        [HttpGet("my-summary")]
        public async Task<IActionResult> GetMyAttendanceSummary()
        {
            var loggedInUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                              ?? User.FindFirst("id")?.Value 
                              ?? User.FindFirst("sub")?.Value;
                              
            if (string.IsNullOrEmpty(loggedInUserId))
            {
                return Unauthorized(new { success = false, message = "Security Exception: Authentic JWT Token does not carry a verifiable NameIdentifier." });
            }

            Console.WriteLine($"[DEBUG] GetMyAttendanceSummary - Extracted JWT userId: {loggedInUserId}");

            var records = await _mongoService.Attendances
                .Find(a => a.UserId == loggedInUserId)
                .ToListAsync();

            Console.WriteLine($"[DEBUG] GetMyAttendanceSummary - Found {records.Count} records in DB for matching UserId.");
            if (records.Count == 0)
            {
                Console.WriteLine($"[WARNING] UserId mismatch or no attendance data found for: {loggedInUserId}");
            }

            var present = records.Count(a => a.Status == "Present");
            var late = records.Count(a => a.Status == "Late");
            var absent = records.Count(a => a.Status == "Absent");

            return Ok(new { present, late, absent });
        }

        [HttpPost("mark")]
        public async Task<IActionResult> MarkAttendance([FromBody] DTOs.MarkAttendanceDto dto)
        {
            try
            {
                var loggedInUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                                  ?? User.FindFirst("id")?.Value 
                                  ?? User.FindFirst("sub")?.Value;
                var loggedInRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value 
                                ?? User.FindFirst("role")?.Value;

                if (loggedInRole != "Admin")
                {
                    if (string.IsNullOrEmpty(loggedInUserId))
                    {
                        return Unauthorized(new { success = false, message = "Security Exception: Authentic JWT Token does not carry a verifiable NameIdentifier." });
                    }
                    // Explicitly force the action strictly unto the authenticated user's physical payload
                    dto.UserId = loggedInUserId;
                }

                if (dto.Method == "AI")
                {
                    if (!dto.IsLive)
                    {
                        return BadRequest(new { success = false, message = "Liveness verification failed. Fake attempt detected." });
                    }

                    if (dto.FaceDescriptor == null || dto.FaceDescriptor.Count == 0)
                        return BadRequest(new { success = false, message = "No facial biometric descriptor was transmitted to the backend." });

                    var allUsersWithFaces = await _mongoService.Users.Find(u => u.FaceData != null && u.FaceData.Any()).ToListAsync();
                    
                    string? detectedUserId = null;
                    double globalMinDistance = double.MaxValue;

                    foreach (var u in allUsersWithFaces)
                    {
                        foreach (var embedding in u.FaceData)
                        {
                            double distance = EuclideanDistance(embedding, dto.FaceDescriptor);
                            if (distance < globalMinDistance) 
                            {
                                globalMinDistance = distance;
                                if (distance < 0.5) 
                                {
                                    detectedUserId = u.Id;
                                }
                            }
                        }
                    }

                    if (string.IsNullOrEmpty(detectedUserId))
                    {
                        return BadRequest(new { success = false, message = "Face not recognized in the system." });
                    }

                    if (loggedInRole != "Admin")
                    {
                        if (detectedUserId != loggedInUserId)
                        {
                            return BadRequest(new { success = false, message = "Face does not match logged-in user" });
                        }
                    }
                    else
                    {
                        if (detectedUserId != dto.UserId)
                        {
                            return BadRequest(new { success = false, message = "Face does not match selected user." });
                        }
                    }
                }

                var today = DateTime.UtcNow.Date;
                var endOfDay = today.AddDays(1);

                // 1. Enforce one attendance entry per user per day
                var existingRecord = await _mongoService.Attendances
                    .Find(a => a.UserId == dto.UserId && a.Date >= today && a.Date < endOfDay)
                    .FirstOrDefaultAsync();

                if (existingRecord != null)
                {
                    return BadRequest(new { success = false, message = "Attendance already marked for today." });
                }

                // 2. Automatically calculate Status using explicit Server Time
                // (Assuming local server timezone, configuring to 10:00:00 AM threshold)
                var currentTime = DateTime.Now;
                var thresholdTime = new TimeSpan(10, 0, 0);

                var attendance = new Attendance
                {
                    UserId = dto.UserId,
                    Date = today,
                    Time = currentTime.ToString("HH:mm:ss"),
                    Method = dto.Method,
                    Confidence = dto.Confidence,
                    Latitude = dto.Latitude,
                    Longitude = dto.Longitude
                };
                
                if (currentTime.TimeOfDay <= thresholdTime)
                {
                    attendance.Status = "Present";
                }
                else
                {
                    attendance.Status = "Late";
                }
                
                // Generate Alerts if necessary e.g., Late
                if (attendance.Status == "Late")
                {
                    await CreateAlertIfPatternDetected(attendance.UserId, attendance.Status);
                }

                await _mongoService.Attendances.InsertOneAsync(attendance);
                return Ok(new { success = true, status = attendance.Status, message = $"Attendance marked as {attendance.Status}.", attendance });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "A critical error occurred while attempting to mathematically map and log the attendance vector into MongoDB.");
                return StatusCode(500, new { success = false, message = "Failed due to server error" });
            }
        }

        private double CalculateHaversineDistance(double lat1, double lon1, double lat2, double lon2)
        {
            var r = 6371e3; // Earth's radius in meters
            var t1 = lat1 * Math.PI / 180;
            var t2 = lat2 * Math.PI / 180;
            var dt = (lat2 - lat1) * Math.PI / 180;
            var dl = (lon2 - lon1) * Math.PI / 180;

            var a = Math.Sin(dt / 2) * Math.Sin(dt / 2) +
                    Math.Cos(t1) * Math.Cos(t2) *
                    Math.Sin(dl / 2) * Math.Sin(dl / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

            return r * c; // Distance in meters
        }

        private double EuclideanDistance(double[] source, List<double> target)
        {
            if (source.Length != target.Count) return double.MaxValue;
            double sum = 0;
            for (int i = 0; i < source.Length; i++)
            {
                sum += Math.Pow(source[i] - target[i], 2);
            }
            return Math.Sqrt(sum);
        }

        [HttpPost("manual")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AddManualAttendance([FromBody] DTOs.AddAttendanceDto dto)
        {
            try
            {
                var targetDate = DateTime.SpecifyKind(dto.Date.Date, DateTimeKind.Utc);
                var endOfDay = targetDate.AddDays(1);
                var existingRecord = await _mongoService.Attendances
                    .Find(a => a.UserId == dto.UserId && a.Date >= targetDate && a.Date < endOfDay)
                    .FirstOrDefaultAsync();

                if (existingRecord != null)
                {
                    return BadRequest(new { success = false, message = "Attendance already marked for this user on this date." });
                }

                var attendance = new Attendance
                {
                    UserId = dto.UserId,
                    Date = targetDate,
                    Time = dto.Time,
                    Method = "Manual",
                    Confidence = null,
                    Status = dto.Status
                };

                await _mongoService.Attendances.InsertOneAsync(attendance);
                return Ok(new { success = true, message = "Manual attendance added successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding manual attendance.");
                return StatusCode(500, new { success = false, message = "Server error." });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateAttendance(string id, [FromBody] DTOs.UpdateAttendanceDto dto)
        {
            try
            {
                var update = Builders<Attendance>.Update
                    .Set(a => a.Status, dto.Status)
                    .Set(a => a.Time, dto.Time);

                var result = await _mongoService.Attendances.UpdateOneAsync(a => a.Id == id, update);

                if (result.MatchedCount == 0)
                    return NotFound(new { success = false, message = "Attendance record not found." });

                return Ok(new { success = true, message = "Attendance updated successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating attendance.");
                return StatusCode(500, new { success = false, message = "Server error: " + ex.Message });
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteAttendance(string id)
        {
            try
            {
                var result = await _mongoService.Attendances.DeleteOneAsync(a => a.Id == id);

                if (result.DeletedCount == 0)
                    return NotFound(new { success = false, message = "Attendance record not found." });

                return Ok(new { success = true, message = "Attendance deleted successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting attendance.");
                return StatusCode(500, new { success = false, message = "Server error: " + ex.Message });
            }
        }

        private async Task CreateAlertIfPatternDetected(string userId, string status)
        {
            // Simplified logic: If user has 3 Lates in last 7 days, trigger an alert
            var last7Days = DateTime.UtcNow.AddDays(-7);
            var recentRecords = await _mongoService.Attendances
                .Find(a => a.UserId == userId && a.Status == status && a.Date >= last7Days)
                .ToListAsync();

            if (recentRecords.Count >= 2) // Total will be 3 including the current one being added
            {
                // Check if alert already exists recently to avoid spam
                var existingAlerts = await _mongoService.Alerts
                    .Find(a => a.UserId == userId && a.Type == status + " Pattern" && a.CreatedAt >= last7Days)
                    .AnyAsync();

                if (!existingAlerts)
                {
                    var user = await _mongoService.Users.Find(u => u.Id == userId).FirstOrDefaultAsync();
                    var alert = new Alert
                    {
                        UserId = userId,
                        Type = status + " Pattern",
                        Message = $"User {user?.Name} has been {status} 3 times in the last 7 days.",
                        Status = "Unacknowledged"
                    };
                    await _mongoService.Alerts.InsertOneAsync(alert);
                }
            }
        }
    }
}
