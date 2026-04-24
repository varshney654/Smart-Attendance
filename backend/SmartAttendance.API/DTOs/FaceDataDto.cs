namespace SmartAttendance.API.DTOs
{
    public class RegisterFaceDto
    {
        public string UserId { get; set; } = null!;
        public List<double[]> Embeddings { get; set; } = new List<double[]>();
    }

    public class MatchFaceDto
    {
        public double[] Embedding { get; set; } = null!;
    }
}
