const { UserActivityModel } = require("../../models/admin-module/ActivityModel/ActivityModel");
const { format, differenceInCalendarDays, formatDistanceToNowStrict } = require("date-fns");

const logActivity = async ({ userId, activity, performedBy, type = "update" }) => {
  if (!userId || !activity || !performedBy) return null;

  try {
    const lastActivity = await UserActivityModel.findOne({ userId, type })
      .sort({ createdAt: -1 })
      .populate("performedBy", "name email role"); // ✅ get admin details

    const currentActivity = await UserActivityModel.create({
      userId,
      activity,
      performedBy,
      type,
    });

    const populatedCurrent = await UserActivityModel.findById(currentActivity._id).populate(
      "performedBy",
      "name email role"
    );

    // Format time
    const formatActivityTime = (date) => {
      if (!date) return null;
      const now = new Date();
      const daysDiff = differenceInCalendarDays(now, date);

      if (daysDiff === 0)
        return `Today, ${format(date, "hh:mm a")} (${formatDistanceToNowStrict(date)} ago)`;
      if (daysDiff === 1)
        return `Yesterday, ${format(date, "hh:mm a")} (${formatDistanceToNowStrict(date)} ago)`;
      return `${format(date, "eee, dd MMM, hh:mm a")} (${formatDistanceToNowStrict(date)} ago)`;
    };

    return {
      lastActivity: lastActivity
        ? {
            activity: lastActivity.activity,
            time: formatActivityTime(lastActivity.createdAt),
            performedBy: lastActivity.performedBy,
          }
        : null,
      recentActivity: {
        activity: populatedCurrent.activity,
        time: formatActivityTime(populatedCurrent.createdAt),
        performedBy: populatedCurrent.performedBy,
      },
    };
  } catch (err) {
    console.error("Failed to log activity:", err.message);
    return null;
  }
};

module.exports = { logActivity };
