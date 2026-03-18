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
        public async Task<IActionResult> GetDashboardMetrics()
        {
            var today = DateTime.UtcNow.Date;
            
            var totalUsers = await _mongoService.Users.CountDocumentsAsync(u => u.Role != "Admin");
            var todaysAttendance = await _mongoService.Attendances.Find(a => a.Date == today).ToListAsync();

            var presentToday = todaysAttendance.Count(a => a.Status == "Present" || a.Status == "Late");
            var absentToday = todaysAttendance.Count(a => a.Status == "Absent"); // Could also derive from TotalUsers - (Present+Late) if not explicitly marked

            // Since it's a demo, absent might be (totalUsers - presentToday)
            if (todaysAttendance.Count == 0) {
               absentToday = 0; // Assume we don't know yet, or totalUsers
            } else {
               absentToday = (int)totalUsers - presentToday;
               if (absentToday < 0) absentToday = 0;
            }

            var lateToday = todaysAttendance.Count(a => a.Status == "Late");
            
            var attendanceRate = totalUsers > 0 ? ((double)presentToday / totalUsers) * 100 : 0;

            // Trend over 7 days
            var last7Days = Enumerable.Range(0, 7).Select(i => today.AddDays(-i)).Reverse().ToList();
            var trendQuery = await _mongoService.Attendances
                .Find(a => a.Date >= today.AddDays(-7) && a.Date <= today)
                .ToListAsync();

            var trendData = last7Days.Select(date => new
            {
                Day = date.ToString("ddd"),
                PresentCount = trendQuery.Count(a => a.Date == date && (a.Status == "Present" || a.Status == "Late"))
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
                AttendanceRate = attendanceRate,
                Trend = trendData,
                StatusDistribution = statusDistribution
            });
        }
    }
}
