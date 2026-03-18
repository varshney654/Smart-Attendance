using Microsoft.Extensions.Options;
using MongoDB.Driver;
using SmartAttendance.API.Models;

namespace SmartAttendance.API.Services
{
    public class MongoDbService
    {
        public readonly IMongoCollection<User> Users;
        public readonly IMongoCollection<Attendance> Attendances;
        public readonly IMongoCollection<Alert> Alerts;

        public MongoDbService(IOptions<DatabaseSettings> databaseSettings, IConfiguration configuration)
        {
            // Load MONGO_URI from env if exists, else fallback to appsettings
            var mongoUri = Environment.GetEnvironmentVariable("MONGO_URI") ?? databaseSettings.Value.ConnectionString;

            var mongoClient = new MongoClient(mongoUri);
            var mongoDatabase = mongoClient.GetDatabase(databaseSettings.Value.DatabaseName);

            Users = mongoDatabase.GetCollection<User>(databaseSettings.Value.UsersCollectionName);
            Attendances = mongoDatabase.GetCollection<Attendance>(databaseSettings.Value.AttendanceCollectionName);
            Alerts = mongoDatabase.GetCollection<Alert>(databaseSettings.Value.AlertsCollectionName);
        }
    }
}
