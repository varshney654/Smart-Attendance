using SmartAttendance.API.Models;
using SmartAttendance.API.Services;
using MongoDB.Driver;

namespace SmartAttendance.API.BackgroundJobs
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
            _logger.LogInformation("AutoAbsentService (Time-Based Background Job) is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Calculate wait time until 23:55:00 local time
                    var now = DateTime.Now;
                    var scheduledTime = new DateTime(now.Year, now.Month, now.Day, 23, 55, 0);

                    if (now > scheduledTime)
                    {
                        scheduledTime = scheduledTime.AddDays(1);
                    }

                    var delay = scheduledTime - now;
                    _logger.LogInformation($"AutoAbsentService sleeping for {delay}. Next run at: {scheduledTime}");

                    // Wait until 11:55 PM
                    await Task.Delay(delay, stoppingToken);

                    // Execute the sweep
                    await CompleteDailyAbsentSweepAsync();
                }
                catch (TaskCanceledException)
                {
                    _logger.LogInformation("AutoAbsentService was deliberately cancelled during sleep interval.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "A fatal exception occurred during the AutoAbsentService sweep.");
                    // Prevent endless crashing loop by waiting 1 minute before retry
                    await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                }
            }
        }

        private async Task CompleteDailyAbsentSweepAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var mongoService = scope.ServiceProvider.GetRequiredService<MongoDbService>();

            var today = DateTime.UtcNow.Date;

            // Fetch all non-admin users
            var regularUsers = await mongoService.Users
                .Find(u => u.Role != "Admin")
                .ToListAsync();

            // Fetch all attendance records strictly for today
            var todaysAttendances = await mongoService.Attendances
                .Find(a => a.Date == today)
                .ToListAsync();

            var attendedUserIds = todaysAttendances.Select(a => a.UserId).ToHashSet();
            int absentCount = 0;

            foreach (var user in regularUsers)
            {
                if (user.Id != null && !attendedUserIds.Contains(user.Id))
                {
                    // Mathematically absent
                    var absentRecord = new Attendance
                    {
                        UserId = user.Id,
                        Date = today,
                        Time = "23:55:00",
                        Status = "Absent",
                        Method = "Auto",
                        Confidence = null
                    };

                    await mongoService.Attendances.InsertOneAsync(absentRecord);
                    absentCount++;
                }
            }

            _logger.LogInformation($"AutoAbsentService Sweep Completed. Automatically marked {absentCount} users as Absent for {today:yyyy-MM-dd}.");
        }
    }
}
