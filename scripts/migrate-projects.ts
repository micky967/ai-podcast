/**
 * Migration Script: Copy projects from Dev Convex to Prod Convex
 * 
 * Usage:
 * 1. Make sure you have DEV_CONVEX_URL and PROD_CONVEX_URL in your .env.local
 *    Or set them as environment variables:
 *    DEV_CONVEX_URL=https://your-dev-url.convex.cloud PROD_CONVEX_URL=https://your-prod-url.convex.cloud npx tsx scripts/migrate-projects.ts
 * 
 * 2. Run: npx tsx scripts/migrate-projects.ts
 * 
 * Note: This script checks for duplicate fileNames and only inserts new projects.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function migrateProjects() {
  // Get URLs from environment or .env.local
  const devUrl = process.env.DEV_CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  
  if (!devUrl) {
    console.error("❌ Error: DEV_CONVEX_URL or NEXT_PUBLIC_CONVEX_URL must be set");
    console.error("Check your .env.local file or set it as an environment variable");
    process.exit(1);
  }

  // For prod, you'll need to set PROD_CONVEX_URL separately
  const prodUrl = process.env.PROD_CONVEX_URL;
  
  if (!prodUrl) {
    console.error("❌ Error: PROD_CONVEX_URL must be set");
    console.error("Set it as: PROD_CONVEX_URL=https://your-prod-url.convex.cloud");
    process.exit(1);
  }
  
  console.log("📥 Connecting to Dev Convex...");
  const devClient = new ConvexHttpClient(devUrl);
  
  console.log("📤 Connecting to Prod Convex...");
  const prodClient = new ConvexHttpClient(prodUrl);
  
  console.log("🔍 Fetching all projects from Dev...");
  
  try {
    // Get all projects from dev
    const devProjects = await devClient.query(api.projects.getAllProjectsForMigration, {});
    
    console.log(`✅ Found ${devProjects.length} projects in Dev`);
    
    if (devProjects.length === 0) {
      console.log("No projects to migrate.");
      return;
    }
    
    console.log("\n📋 Preparing projects for migration...");
    console.log("   (Checking for duplicate fileNames in Prod...)");
    
    // Prepare projects data (remove _id and other Convex-specific fields)
    const projectsToInsert = devProjects.map((project: any) => {
      const { _id, _creationTime, ...projectData } = project;
      return projectData;
    });
    
    console.log(`\n🚀 Inserting ${projectsToInsert.length} projects into Prod...`);
    
    // Bulk insert with duplicate checking
    const result = await prodClient.mutation(api.projects.bulkInsertProjects, {
      projects: projectsToInsert,
    });
    
    console.log("\n✅ Migration complete!");
    console.log(`   Inserted: ${result.inserted} projects`);
    console.log(`   Skipped: ${result.skipped} projects (duplicate fileNames)`);
    console.log(`   Total: ${result.total} projects`);
    
    if (result.skippedFileNames.length > 0) {
      console.log("\n⚠️  Skipped fileNames (already exist in Prod):");
      result.skippedFileNames.forEach((fileName: string) => {
        console.log(`   - ${fileName}`);
      });
    }
    
  } catch (error) {
    console.error("\n❌ Error during migration:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
    }
    process.exit(1);
  }
}

migrateProjects().catch(console.error);
