// script.js
db = db.getSiblingDB("SmartAttendance");

// Aggregate to find duplicates based on userId and date (year, month, day)
const pipeline = [
    {
        $project: {
            _id: 1,
            userId: 1,
            dateString: {
                $dateToString: { format: "%Y-%m-%d", date: "$date" }
            }
        }
    },
    {
        $group: {
            _id: { userId: "$userId", date: "$dateString" },
            count: { $sum: 1 },
            ids: { $push: "$_id" }
        }
    },
    {
        $match: {
            count: { $gt: 1 }
        }
    }
];

const duplicates = db.Attendance.aggregate(pipeline).toArray();
print(`Found ${duplicates.length} duplicate groups.`);

let deletedCount = 0;
duplicates.forEach(group => {
    // Keep the first ID, delete the rest
    const idsToDelete = group.ids.slice(1);
    const result = db.Attendance.deleteMany({ _id: { $in: idsToDelete } });
    deletedCount += result.deletedCount;
    print(`Deleted ${result.deletedCount} duplicates for user ${group._id.userId} on ${group._id.date}`);
});

print(`Total duplicates deleted: ${deletedCount}`);
