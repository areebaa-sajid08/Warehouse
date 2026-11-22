import ActivityNotification from "../models/activityNotification.model.js";

const visibleRolesByCategory = {
  account: ["admin"],
  catalog: ["admin", "warehouseManager", "salesRepresentative"],
  inventory: ["admin"],
  order: ["admin"],
  supply: ["admin"],
  warehouse: ["admin"],
};

export async function publishActivityNotification({
  actorId,
  title,
  message,
  category,
  visibleToRoles = visibleRolesByCategory[category] || ["admin"],
  recipientIds = [],
  dedupeKey,
}) {
  try {
    const notification = {
      actor: actorId,
      title,
      message,
      category,
      visibleToRoles,
      recipientIds: [...new Set(recipientIds.map(String))],
    };
    if (dedupeKey) {
      const now = new Date();
      await ActivityNotification.updateOne(
        { dedupeKey },
        { $set: { ...notification, dedupeKey, readBy: [], createdAt: now, updatedAt: now } },
        { upsert: true, timestamps: false },
      );
    } else {
      await ActivityNotification.create(notification);
    }
  } catch (error) {
    if (error.code === 11000 && dedupeKey) return;
    console.error("Failed to save activity notification:", error.message);
  }
}
