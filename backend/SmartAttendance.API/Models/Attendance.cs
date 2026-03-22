using System;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartAttendance.API.Models
{
    [BsonIgnoreExtraElements]
    public class Attendance
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("userId")]
        [BsonRepresentation(BsonType.ObjectId)]
        public string UserId { get; set; } = null!;

        [BsonElement("date")]
        public DateTime Date { get; set; }

        [BsonElement("time")]
        public string Time { get; set; } = null!;

        [BsonElement("status")]
        public string Status { get; set; } = "Present"; // Present, Late, Absent

        [BsonElement("method")]
        public string Method { get; set; } = "Manual"; // AI, Manual

        [BsonElement("confidence")]
        public double? Confidence { get; set; }
    }
}
