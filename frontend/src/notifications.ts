// Local reminder scheduling (workout / weight / meal). Local notifications only
// — no push. Fully testable on a real device / dev build; on web it no-ops.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  if (!settings.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function parseTime(t: string | undefined, fallbackH: number): { hour: number; minute: number } {
  if (t && /^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":").map(Number);
    return { hour: h, minute: m };
  }
  return { hour: fallbackH, minute: 0 };
}

type ReminderUser = {
  notifications?: Record<string, any>;
  training_days?: string[];
};

const WEEKDAY: Record<string, number> = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };

// Reschedules all GymBuddy reminders from the user's settings.
export async function syncReminders(user: ReminderUser): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const n = user.notifications ?? {};
  const anyOn = n.workouts || n.weight || n.measurements;
  if (!anyOn) { await Notifications.cancelAllScheduledNotificationsAsync(); return true; }
  const ok = await ensureNotificationPermission();
  if (!ok) return false;
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Workout reminders on chosen training days
  if (n.workouts) {
    const wt = parseTime(n.workout_time, 18);
    const days = user.training_days?.length ? user.training_days : ["mon", "wed", "fri"];
    for (const d of days) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "GymBuddy 💪", body: "Time for your workout!" },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: WEEKDAY[d] ?? 2, hour: wt.hour, minute: wt.minute },
      });
    }
  }
  // Weight check-in (weekly, Monday)
  if (n.weight) {
    const wt = parseTime(n.weight_time, 8);
    await Notifications.scheduleNotificationAsync({
      content: { title: "GymBuddy ⚖️", body: "Log your weight check-in." },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour: wt.hour, minute: wt.minute },
    });
  }
  // Meal logging (daily)
  if (n.measurements) {
    const wt = parseTime(n.meal_time, 12);
    await Notifications.scheduleNotificationAsync({
      content: { title: "GymBuddy 🍽️", body: "Don't forget to log your meals." },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: wt.hour, minute: wt.minute },
    });
  }
  return true;
}
