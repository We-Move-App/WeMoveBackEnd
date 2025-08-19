const { UserActivityModel } = require("../../models/admin-module/ActivityModel/ActivityModel");
const { format, differenceInCalendarDays } = require("date-fns");

const logActivity = async (userId, activity) => {
  if (!userId || !activity) return;

  try {
    // Fetch the most recent previous activity
    const lastActivity = await UserActivityModel.findOne({ userId })
      .sort({ createdAt: -1 });

    // Create new activity
    const currentActivity = await UserActivityModel.create({ userId, activity });

    // Format the time
    const formatActivity = (date) => {
      if (!date) return null;
      const now = new Date();
      const daysDiff = differenceInCalendarDays(now, date);
      if (daysDiff === 0) return `Today, ${format(date, "hh:mm a")}`;
      if (daysDiff === 1) return `Yesterday, ${format(date, "hh:mm a")}`;
      return `${format(date, "dd MMM, hh:mm a")}`;
    };

    return {
      lastActivity: lastActivity
        ? { activity: lastActivity.activity, time: formatActivity(lastActivity.createdAt) }
        : null,
      currentActivity: {
        activity: currentActivity.activity,
        time: formatActivity(currentActivity.createdAt),
      },
    };
  } catch (err) {
    console.error("Failed to log activity:", err.message);
    return null;
  }
};

module.exports = { logActivity };
