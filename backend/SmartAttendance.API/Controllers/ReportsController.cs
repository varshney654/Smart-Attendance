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
    public class ReportsController : ControllerBase
    {
        private readonly MongoDbService _mongoService;

        public ReportsController(MongoDbService mongoService)
        {
            _mongoService = mongoService;
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummaryReport([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var filterBuilder = Builders<Attendance>.Filter;
            var filter = filterBuilder.Empty;

            if (startDate.HasValue)
            {
                filter &= filterBuilder.Gte(a => a.Date, startDate.Value.Date);
            }
            if (endDate.HasValue)
            {
                filter &= filterBuilder.Lte(a => a.Date, endDate.Value.Date);
            }

            var records = await _mongoService.Attendances.Find(filter).ToListAsync();

            var totalRecords = records.Count;
            var totalPresent = records.Count(a => a.Status == "Present");
            var totalLate = records.Count(a => a.Status == "Late");
            var totalAbsent = records.Count(a => a.Status == "Absent");

            // Avoid division by zero
            var averageAttendanceRate = totalRecords > 0 
                ? ((double)(totalPresent + totalLate) / totalRecords) * 100 
                : 0;

            return Ok(new
            {
                TotalRecords = totalRecords,
                Present = totalPresent,
                Late = totalLate,
                Absent = totalAbsent,
                AverageAttendanceRate = averageAttendanceRate
            });
        }
    }
}
