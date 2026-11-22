import ActivityNotification from "../models/activityNotification.model.js";

export async function publishActivityNotification({ actorId, title, message, category }) {
  try {
    await ActivityNotification.create({ actor: actorId, title, message, category });
  } catch (error) {
    console.error("Failed to save activity notification:", error.message);
  }
}
