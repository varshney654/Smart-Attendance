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
    public class AlertsController : ControllerBase
    {
        private readonly MongoDbService _mongoService;

        public AlertsController(MongoDbService mongoService)
        {
            _mongoService = mongoService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAlerts()
        {
            var alerts = await _mongoService.Alerts.Find(_ => true).SortByDescending(a => a.CreatedAt).ToListAsync();
            return Ok(alerts);
        }

        [HttpPut("{id}/acknowledge")]
        public async Task<IActionResult> AcknowledgeAlert(string id)
        {
            var update = Builders<Alert>.Update.Set(a => a.Status, "Acknowledged");
            var result = await _mongoService.Alerts.UpdateOneAsync(a => a.Id == id, update);

            if (result.ModifiedCount == 0) return NotFound(new { message = "Alert not found or already acknowledged" });

            return Ok(new { message = "Alert acknowledged successfully" });
        }
    }
}
