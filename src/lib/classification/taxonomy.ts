export const TAXONOMY = [
  "family",
  "kids",
  "couple",
  "friends",
  "travel",
  "food",
  "pets",
  "work",
  "documents",
  "screenshots",
  "home",
  "events",
  "nature",
  "vehicles",
  "shopping",
  "memes",
  "other",
] as const;

export type CategorySlug = (typeof TAXONOMY)[number];

export const CATEGORY_NAMES: Record<CategorySlug, string> = {
  family: "Family",
  kids: "Kids",
  couple: "Couple",
  friends: "Friends",
  travel: "Travel",
  food: "Food",
  pets: "Pets",
  work: "Work",
  documents: "Documents",
  screenshots: "Screenshots",
  home: "Home",
  events: "Events",
  nature: "Nature",
  vehicles: "Vehicles",
  shopping: "Shopping",
  memes: "Memes",
  other: "Other",
};

export function isCategorySlug(value: string): value is CategorySlug {
  return (TAXONOMY as readonly string[]).includes(value);
}
