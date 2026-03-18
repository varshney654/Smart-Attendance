namespace SmartAttendance.API.Models
{
    public class DatabaseSettings
    {
        public string ConnectionString { get; set; } = null!;
        public string DatabaseName { get; set; } = null!;
        public string UsersCollectionName { get; set; } = null!;
        public string AttendanceCollectionName { get; set; } = null!;
        public string AlertsCollectionName { get; set; } = null!;
    }
}
