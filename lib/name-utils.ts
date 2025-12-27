/**
 * Name utility functions for transforming user names
 */

/**
 * Replaces the owner's real name with "Administrator" for privacy
 * This ensures the owner's real name is never displayed to other users
 * 
 * @param name - The user's name from Clerk
 * @returns The transformed name (or original if not the owner)
 */
export function transformUserName(name: string | null | undefined): string {
  if (!name) return name || "";
  
  // Replace "Manjit Lider" with "Administrator" for privacy
  if (name === "Manjit Lider" || name.trim() === "Manjit Lider") {
    return "Administrator";
  }
  
  return name;
}

