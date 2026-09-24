import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export const subscribeCategoryNames = ({ onNames, onError }) => {
  if (!db) {
    onError?.(new Error("Firestore is not configured."));
    return () => {};
  }

  let userUnsubscribe = () => {};
  const categoryUnsubscribes = new Map();
  const categoriesByUser = new Map();

  const emitNames = () => {
    const names = [...categoriesByUser.values()]
      .flat()
      .filter((name) => typeof name === "string" && name.trim())
      .map((name) => name.trim());

    onNames?.([...new Set(names)]);
  };

  const subscribeUserCategories = (userId) => {
    const unsubscribe = onSnapshot(
      collection(db, "users", userId, "categories"),
      (snapshot) => {
        categoriesByUser.set(
          userId,
          snapshot.docs.map((categorySnapshot) => categorySnapshot.data()?.name)
        );
        emitNames();
      },
      (error) => {
        console.error(`[FIRESTORE] Category listener failed for user ${userId}:`, error);
        onError?.(error);
      }
    );

    categoryUnsubscribes.set(userId, unsubscribe);
  };

  userUnsubscribe = onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      const userIds = new Set(snapshot.docs.map((userSnapshot) => userSnapshot.id));

      snapshot.docs.forEach((userSnapshot) => {
        if (!categoryUnsubscribes.has(userSnapshot.id)) {
          subscribeUserCategories(userSnapshot.id);
        }
      });

      categoryUnsubscribes.forEach((unsubscribe, userId) => {
        if (!userIds.has(userId)) {
          unsubscribe();
          categoryUnsubscribes.delete(userId);
          categoriesByUser.delete(userId);
        }
      });

      emitNames();
    },
    (error) => {
      console.error("[FIRESTORE] User listener for categories failed:", error);
      onError?.(error);
    }
  );

  return () => {
    userUnsubscribe();
    categoryUnsubscribes.forEach((unsubscribe) => unsubscribe());
  };
};