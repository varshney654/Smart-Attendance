using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SmartAttendance.API.Services;

namespace SmartAttendance.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AnalyticsController : ControllerBase
    {
        private readonly MongoDbService _mongoService;

        public AnalyticsController(MongoDbService mongoService)
        {
            _mongoService = mongoService;
        }

        [HttpGet("dashboard")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetDashboardMetrics()
        {
            var today = DateTime.UtcNow.Date;
            
            // Get all non-admin users
            var allUsers = await _mongoService.Users.Find(u => u.Role != "Admin").ToListAsync();
            var totalUsers = allUsers.Count;
            
            // Get today's attendance records
            var startOfDay = today;
            var endOfDay = today.AddDays(1);
            var todaysAttendance = await _mongoService.Attendances
                .Find(a => a.Date >= startOfDay && a.Date < endOfDay)
                .ToListAsync();

            // Count present/late (not absent)
            var presentToday = todaysAttendance.Count(a => a.Status == "Present" || a.Status == "Late");
            var lateToday = todaysAttendance.Count(a => a.Status == "Late");
            
            // Absent = total users - (present + late) who have attendance records
            // If a user has no attendance record for today, they could be considered absent
            // But for now, let's just show actual recorded attendance
            var absentToday = Math.Max(0, totalUsers - presentToday);
            
            // If no attendance records exist, show 0 for all
            if (todaysAttendance.Count == 0)
            {
                presentToday = 0;
                absentToday = 0;
                lateToday = 0;
            }

            // Attendance rate = (present / total users) * 100
            var attendanceRate = totalUsers > 0 ? ((double)presentToday / totalUsers) * 100 : 0;

            // Trend over 7 days
            var last7Days = Enumerable.Range(0, 7).Select(i => today.AddDays(-i)).Reverse().ToList();
            var trendQuery = await _mongoService.Attendances
                .Find(a => a.Date >= today.AddDays(-7) && a.Date <= today)
                .ToListAsync();

            var trendData = last7Days.Select(date => {
                var dayStart = date.Date;
                var dayEnd = dayStart.AddDays(1);
                var dayRecords = trendQuery.Where(a => a.Date >= dayStart && a.Date < dayEnd).ToList();
                return new
                {
                    Day = date.ToString("ddd"),
                    PresentCount = dayRecords.Count(a => a.Status == "Present" || a.Status == "Late")
                };
            }).ToList();

            var statusDistribution = new
            {
                Present = todaysAttendance.Count(a => a.Status == "Present"),
                Absent = absentToday,
                Late = lateToday
            };

            return Ok(new
            {
                TotalUsers = totalUsers,
                PresentToday = presentToday,
                AbsentToday = absentToday,
                LateToday = lateToday,
                AttendanceRate = Math.Min(attendanceRate, 100), // Cap at 100%
                Trend = trendData,
                StatusDistribution = statusDistribution
            });
        }
    }
}
