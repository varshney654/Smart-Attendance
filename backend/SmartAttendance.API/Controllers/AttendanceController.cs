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
            var filterBuilder = Builders<Attendance>.Filter;
            var filter = filterBuilder.Empty;

            if (!string.IsNullOrEmpty(status) && status != "All Status")
            {
                filter &= filterBuilder.Eq(a => a.Status, status);
            }

            // Implement dateRange filters for '7 Days', '30 Days', 'All Time'
            if (!string.IsNullOrEmpty(dateRange) && dateRange != "All Time")
            {
                var days = dateRange == "7 Days" ? -7 : -30;
                var startDate = DateTime.UtcNow.AddDays(days);
                filter &= filterBuilder.Gte(a => a.Date, startDate);
            }

            var records = await _mongoService.Attendances.Find(filter).SortByDescending(a => a.Date).ThenByDescending(a => a.Time).ToListAsync();

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
                r.Confidence
            });

            return Ok(enrichedRecords);
        }

        [HttpPost("mark")]
        public async Task<IActionResult> MarkAttendance([FromBody] DTOs.MarkAttendanceDto dto)
        {
            try
            {
                var today = DateTime.UtcNow.Date;

                // 1. Enforce one attendance entry per user per day
                var existingRecord = await _mongoService.Attendances
                    .Find(a => a.UserId == dto.UserId && a.Date == today)
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
                    Confidence = dto.Confidence
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
