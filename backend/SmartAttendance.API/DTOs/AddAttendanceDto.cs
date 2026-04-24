namespace SmartAttendance.API.DTOs
{
    public class AddAttendanceDto
    {
        public string UserId { get; set; } = null!;
        public DateTime Date { get; set; }
        public string Time { get; set; } = null!;
        public string Status { get; set; } = null!;
    }
}
