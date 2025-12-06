/**
 * Admin Page - Seed Categories
 *
 * One-time page to seed all medical specialty categories into the database.
 * This page should only be accessible to authorized users.
 */
"use client";

import { useState } from "react";
import { seedCategoriesAction } from "@/app/actions/categories";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Loader2, Database, AlertCircle } from "lucide-react";

export default function SeedCategoriesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    mainCategoriesCreated?: number;
    subcategoriesCreated?: number;
    error?: string;
  } | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setResult(null);
    try {
      const seedResult = await seedCategoriesAction();
      setResult(seedResult);
    } catch (error) {
      setResult({
        success: false,
        message: "Failed to seed categories",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
          <span className="gradient-emerald-text">Seed Categories</span>
        </h1>
        <p className="text-lg text-gray-600">
          Populate the database with all medical specialty categories and
          subcategories
        </p>
      </div>

      <Card className="glass-card p-8">
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <Database className="h-8 w-8 text-emerald-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-2">
                What will be created?
              </h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>20 main medical specialty categories</li>
                <li>All associated subcategories</li>
                <li>
                  This operation is <strong>idempotent</strong> - safe to run
                  multiple times
                </li>
                <li>Existing categories won&apos;t be duplicated</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <Button
              onClick={handleSeed}
              disabled={loading}
              className="gradient-emerald text-white hover-glow shadow-lg px-8 py-6 text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Seeding Categories...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-5 w-5" />
                  Seed Categories Now
                </>
              )}
            </Button>
          </div>

          {result && (
            <div
              className={`border rounded-lg p-6 ${
                result.success
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3
                    className={`text-lg font-semibold mb-2 ${
                      result.success ? "text-emerald-900" : "text-red-900"
                    }`}
                  >
                    {result.success ? "Success!" : "Error"}
                  </h3>
                  <p
                    className={
                      result.success ? "text-emerald-800" : "text-red-800"
                    }
                  >
                    {result.message}
                  </p>
                  {result.success && (
                    <div className="mt-4 space-y-1 text-emerald-700">
                      {result.mainCategoriesCreated !== undefined && (
                        <p>
                          ✓ Created {result.mainCategoriesCreated} main
                          categories
                        </p>
                      )}
                      {result.subcategoriesCreated !== undefined && (
                        <p>
                          ✓ Created {result.subcategoriesCreated}{" "}
                          subcategories
                        </p>
                      )}
                    </div>
                  )}
                  {result.error && (
                    <p className="mt-2 text-sm text-red-700">{result.error}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">
                Alternative Methods:
              </h3>
              <div className="space-y-2 text-sm text-blue-800">
                <p>
                  <strong>1. Convex CLI:</strong> Run{" "}
                  <code className="bg-blue-100 px-2 py-1 rounded">
                    npx convex run categories:seedCategories
                  </code>
                </p>
                <p>
                  <strong>2. Convex Dashboard:</strong> Go to Functions tab and
                  run the seedCategories function
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

