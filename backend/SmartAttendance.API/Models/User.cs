using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SmartAttendance.API.Models
{
    [BsonIgnoreExtraElements]
    public class User
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("name")]
        public string Name { get; set; } = null!;

        [BsonElement("email")]
        public string Email { get; set; } = null!;

        [BsonElement("password")]
        public string Password { get; set; } = null!;

        [BsonElement("role")]
        public string Role { get; set; } = "Student"; // Admin, Employee, Student

        [BsonElement("department")]
        public string? Department { get; set; }

        [BsonElement("faceData")]
        public List<double[]> FaceData { get; set; } = new List<double[]>();
    }
}
