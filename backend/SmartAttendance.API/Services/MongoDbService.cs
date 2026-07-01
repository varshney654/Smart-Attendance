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
        public readonly IMongoCollection<AuditLog> AuditLogs;

        public MongoDbService(IOptions<DatabaseSettings> databaseSettings, IMongoClient mongoClient)
        {
            var mongoDatabase = mongoClient.GetDatabase(databaseSettings.Value.DatabaseName);

            Users = mongoDatabase.GetCollection<User>(databaseSettings.Value.UsersCollectionName);
            Attendances = mongoDatabase.GetCollection<Attendance>(databaseSettings.Value.AttendanceCollectionName);
            Alerts = mongoDatabase.GetCollection<Alert>(databaseSettings.Value.AlertsCollectionName);
            AuditLogs = mongoDatabase.GetCollection<AuditLog>(databaseSettings.Value.AuditLogsCollectionName);
        }
    }
}
