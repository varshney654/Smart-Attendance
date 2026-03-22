using System;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartAttendance.API.Models
{
    [BsonIgnoreExtraElements]
    public class Alert
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("userId")]
        [BsonRepresentation(BsonType.ObjectId)]
        public string UserId { get; set; } = null!;

        [BsonElement("type")]
        public string Type { get; set; } = null!; // e.g., "Frequent Absence", "Consecutive Late"

        [BsonElement("message")]
        public string Message { get; set; } = null!;

        [BsonElement("status")]
        public string Status { get; set; } = "Unacknowledged"; // Acknowledged, Unacknowledged

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
