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

        [BsonElement("resetOtp")]
        public string? ResetOtp { get; set; }

        [BsonElement("resetOtpExpiry")]
        public DateTime? ResetOtpExpiry { get; set; }

        [BsonElement("profileImage")]
        public string? ProfileImage { get; set; }

        [BsonElement("faceData")]
        public List<double[]> FaceData { get; set; } = new List<double[]>();

        [BsonElement("emailDeliveryStatus")]
        public string EmailDeliveryStatus { get; set; } = "Pending"; // Pending, Sent, Failed

        [BsonElement("emailSent")]
        public bool EmailSent { get; set; } = false;

        [BsonElement("emailSentAt")]
        public DateTime? EmailSentAt { get; set; }

        [BsonElement("lastEmailAttempt")]
        public DateTime? LastEmailAttempt { get; set; }

        [BsonElement("temporaryPassword")]
        public string? TemporaryPassword { get; set; }

        [BsonElement("temporaryPasswordCreatedAt")]
        public DateTime? TemporaryPasswordCreatedAt { get; set; }

        [BsonElement("isPasswordChanged")]
        public bool IsPasswordChanged { get; set; } = false;

        [BsonElement("isDisabled")]
        public bool IsDisabled { get; set; } = false;

        [BsonElement("failedOtpAttempts")]
        public int FailedOtpAttempts { get; set; } = 0;

        [BsonElement("otpLastRequestedAt")]
        public DateTime? OtpLastRequestedAt { get; set; }

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
