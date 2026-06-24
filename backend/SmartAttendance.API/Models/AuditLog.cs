using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartAttendance.API.Models
{
    public class AuditLog
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string AdminId { get; set; } = null!;
        public string AdminName { get; set; } = null!;
        public string UserId { get; set; } = null!;
        public string UserName { get; set; } = null!;
        public string AttendanceStatus { get; set; } = null!;
        public DateTime Timestamp { get; set; }
        public string Source { get; set; } = "Manual Override";
    }
}
