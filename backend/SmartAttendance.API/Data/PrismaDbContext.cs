using MongoDB.Driver;
using SmartAttendance.API.Models;
using System.Linq.Expressions;

namespace SmartAttendance.API.Data
{
    /// <summary>
    /// Prisma-like base repository interface for MongoDB operations
    /// Provides CRUD operations similar to Prisma ORM
    /// </summary>
    public interface IRepository<T> where T : class
    {
        Task<T?> FindByIdAsync(string id);
        Task<IEnumerable<T>> FindAllAsync();
        Task<IEnumerable<T>> FindManyAsync(Expression<Func<T, bool>> filter);
        Task<T?> FindFirstAsync(Expression<Func<T, bool>> filter);
        Task<T> CreateAsync(T entity);
        Task<T> UpdateAsync(string id, T entity);
        Task<bool> DeleteAsync(string id);
        Task<long> CountAsync(Expression<Func<T, bool>>? filter = null);
        Task<bool> ExistsAsync(Expression<Func<T, bool>> filter);
    }

    /// <summary>
    /// MongoDB Repository Implementation - Prisma-like ORM for MongoDB
    /// </summary>
    public class MongoRepository<T> : IRepository<T> where T : class
    {
        private readonly IMongoCollection<T> _collection;
        private readonly string _idPropertyName;

        public MongoRepository(IMongoCollection<T> collection)
        {
            _collection = collection;
            // Get the Id property name from the entity
            var idProperty = typeof(T).GetProperty("Id");
            _idPropertyName = idProperty?.Name ?? "Id";
        }

        public async Task<T?> FindByIdAsync(string id)
        {
            var filter = Builders<T>.Filter.Eq("_id", new MongoDB.Bson.ObjectId(id));
            return await _collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<IEnumerable<T>> FindAllAsync()
        {
            return await _collection.Find(_ => true).ToListAsync();
        }

        public async Task<IEnumerable<T>> FindManyAsync(Expression<Func<T, bool>> filter)
        {
            return await _collection.Find(filter).ToListAsync();
        }

        public async Task<T?> FindFirstAsync(Expression<Func<T, bool>> filter)
        {
            return await _collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<T> CreateAsync(T entity)
        {
            await _collection.InsertOneAsync(entity);
            return entity;
        }

        public async Task<T> UpdateAsync(string id, T entity)
        {
            var filter = Builders<T>.Filter.Eq("_id", new MongoDB.Bson.ObjectId(id));
            await _collection.ReplaceOneAsync(filter, entity);
            return entity;
        }

        public async Task<bool> DeleteAsync(string id)
        {
            var filter = Builders<T>.Filter.Eq("_id", new MongoDB.Bson.ObjectId(id));
            var result = await _collection.DeleteOneAsync(filter);
            return result.DeletedCount > 0;
        }

        public async Task<long> CountAsync(Expression<Func<T, bool>>? filter = null)
        {
            if (filter == null)
            {
                return await _collection.CountDocumentsAsync(_ => true);
            }
            return await _collection.CountDocumentsAsync(filter);
        }

        public async Task<bool> ExistsAsync(Expression<Func<T, bool>> filter)
        {
            return await _collection.Find(filter).AnyAsync();
        }
    }

    /// <summary>
    /// User Repository - Prisma-like operations for User model
    /// </summary>
    public interface IUserRepository : IRepository<User>
    {
        Task<User?> FindByEmailAsync(string email);
        Task<User?> FindByRoleAsync(string role);
        Task<IEnumerable<User>> FindByDepartmentAsync(string department);
    }

    public class UserRepository : MongoRepository<User>, IUserRepository
    {
        public UserRepository(IMongoCollection<User> collection) : base(collection) { }

        public async Task<User?> FindByEmailAsync(string email)
        {
            return await FindFirstAsync(u => u.Email == email);
        }

        public async Task<User?> FindByRoleAsync(string role)
        {
            return await FindFirstAsync(u => u.Role == role);
        }

        public async Task<IEnumerable<User>> FindByDepartmentAsync(string department)
        {
            return await FindManyAsync(u => u.Department == department);
        }
    }

    /// <summary>
    /// Attendance Repository - Prisma-like operations for Attendance model
    /// </summary>
    public interface IAttendanceRepository : IRepository<Attendance>
    {
        Task<IEnumerable<Attendance>> FindByDateAsync(DateTime date);
        Task<IEnumerable<Attendance>> FindByUserIdAsync(string userId);
        Task<Attendance?> FindByUserAndDateAsync(string userId, DateTime date);
    }

    public class AttendanceRepository : MongoRepository<Attendance>, IAttendanceRepository
    {
        public AttendanceRepository(IMongoCollection<Attendance> collection) : base(collection) { }

        public async Task<IEnumerable<Attendance>> FindByDateAsync(DateTime date)
        {
            var startOfDay = date.Date;
            var endOfDay = startOfDay.AddDays(1);
            return await FindManyAsync(a => a.Date >= startOfDay && a.Date < endOfDay);
        }

        public async Task<IEnumerable<Attendance>> FindByUserIdAsync(string userId)
        {
            return await FindManyAsync(a => a.UserId == userId);
        }

        public async Task<Attendance?> FindByUserAndDateAsync(string userId, DateTime date)
        {
            var startOfDay = date.Date;
            var endOfDay = startOfDay.AddDays(1);
            return await FindFirstAsync(a => a.UserId == userId && a.Date >= startOfDay && a.Date < endOfDay);
        }
    }

    /// <summary>
    /// Alert Repository - Prisma-like operations for Alert model
    /// </summary>
    public interface IAlertRepository : IRepository<Alert>
    {
        Task<IEnumerable<Alert>> FindByUserIdAsync(string userId);
        Task<IEnumerable<Alert>> FindUnreadAsync(string userId);
    }

    public class AlertRepository : MongoRepository<Alert>, IAlertRepository
    {
        public AlertRepository(IMongoCollection<Alert> collection) : base(collection) { }

        public async Task<IEnumerable<Alert>> FindByUserIdAsync(string userId)
        {
            return await FindManyAsync(a => a.UserId == userId);
        }

        public async Task<IEnumerable<Alert>> FindUnreadAsync(string userId)
        {
            return await FindManyAsync(a => a.UserId == userId && a.Status == "Unacknowledged");
        }
    }

    /// <summary>
    /// Access Request Repository - Prisma-like operations for AccessRequest model
    /// </summary>
    public interface IAccessRequestRepository : IRepository<AccessRequest>
    {
        Task<IEnumerable<AccessRequest>> FindPendingAsync();
    }

    public class AccessRequestRepository : MongoRepository<AccessRequest>, IAccessRequestRepository
    {
        public AccessRequestRepository(IMongoCollection<AccessRequest> collection) : base(collection) { }

        public async Task<IEnumerable<AccessRequest>> FindPendingAsync()
        {
            return await FindManyAsync(r => r.Status == "Pending");
        }
    }

    /// <summary>
    /// Prisma-like Database Client - Single entry point for all database operations
    /// </summary>
    public class PrismaDbContext
    {
        private readonly IMongoDatabase _database;

        public PrismaDbContext(IMongoClient mongoClient, string databaseName)
        {
            _database = mongoClient.GetDatabase(databaseName);
        }

        public IUserRepository Users => new UserRepository(_database.GetCollection<User>("Users"));
        public IAttendanceRepository Attendances => new AttendanceRepository(_database.GetCollection<Attendance>("Attendance"));
        public IAlertRepository Alerts => new AlertRepository(_database.GetCollection<Alert>("Alerts"));
        public IAccessRequestRepository AccessRequests => new AccessRequestRepository(_database.GetCollection<AccessRequest>("AccessRequests"));
    }
}
