namespace SmartAttendance.API.DTOs
{
    public class MarkAttendanceDto
    {
        public string UserId { get; set; } = null!;
        public string Method { get; set; } = "Manual";
        public double? Confidence { get; set; }
    }
}
