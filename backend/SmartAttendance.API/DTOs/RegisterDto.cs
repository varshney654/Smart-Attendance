namespace SmartAttendance.API.DTOs
{
    public class RegisterDto
    {
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string Role { get; set; } = "Student";
        public string? Department { get; set; }
        public string? ProfileImage { get; set; }
    }
}
