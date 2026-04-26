using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartAttendance.API.Models
{
    [BsonIgnoreExtraElements]
    public class AccessRequest
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("name")]
        public string Name { get; set; } = null!;

        [BsonElement("email")]
        public string Email { get; set; } = null!;

        [BsonElement("role")]
        public string Role { get; set; } = null!;

        [BsonElement("status")]
        public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected
    }
}
