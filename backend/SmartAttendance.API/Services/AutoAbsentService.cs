using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SmartAttendance.API.Models;
using System;
using System.Threading;
using System.Threading.Tasks;
using MongoDB.Driver;

namespace SmartAttendance.API.Services
{
    public class AutoAbsentService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<AutoAbsentService> _logger;

        public AutoAbsentService(IServiceProvider serviceProvider, ILogger<AutoAbsentService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("AutoAbsentService is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Calculate wait time until next 11:59 PM in IST
                    var istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
                    var nowUtc = DateTime.UtcNow;
                    var nowIst = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, istZone);
                    
                    var today1159PM = nowIst.Date.AddHours(23).AddMinutes(59);
                    
                    if (nowIst > today1159PM)
                    {
                        today1159PM = today1159PM.AddDays(1);
                    }

                    var timeToWait = today1159PM - nowIst;
                    _logger.LogInformation($"AutoAbsentService waiting for {timeToWait} until {today1159PM} IST");

                    // Wait until 11:59 PM
                    await Task.Delay(timeToWait, stoppingToken);

                    // Run Job
                    await RunAbsentJobAsync(stoppingToken);
                }
                catch (TaskCanceledException)
                {
                    // Expected when shutting down
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred in AutoAbsentService");
                    // Wait 1 hour before retrying on crash to prevent tight loop
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                }
            }
        }

        private async Task RunAbsentJobAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Running Daily Absent Job...");

            using var scope = _serviceProvider.CreateScope();
            var mongoService = scope.ServiceProvider.GetRequiredService<MongoDbService>();

            var today = DateTime.UtcNow.Date;

            // Get all users
            var users = await mongoService.Users.Find(_ => true).ToListAsync(stoppingToken);
            
            // Get all attendances for today
            var attendancesToday = await mongoService.Attendances
                .Find(a => a.Date == today)
                .ToListAsync(stoppingToken);

            var attendedUserIds = attendancesToday.Select(a => a.UserId).ToHashSet();

            foreach (var user in users)
            {
                if (user.Id != null && !attendedUserIds.Contains(user.Id))
                {
                    var absentRecord = new Attendance
                    {
                        UserId = user.Id,
                        Date = today,
                        Time = "11:59 PM",
                        Status = "Absent",
                        Method = "System",
                        Role = user.Role
                    };
                    
                    await mongoService.Attendances.InsertOneAsync(absentRecord, cancellationToken: stoppingToken);
                    _logger.LogInformation($"Marked user {user.Id} ({user.Name}) as Absent.");
                }
            }
            
            _logger.LogInformation("Daily Absent Job completed.");
        }
    }
}
