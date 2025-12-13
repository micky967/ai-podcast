"use client";

import { PricingTable } from "@clerk/nextjs";

export function PricingTableWrapper() {
  return (
    <div className="max-w-6xl mx-auto">
      <PricingTable
        appearance={{
          elements: {
            pricingTableCardHeader: {
              background:
                "linear-gradient(135deg, rgb(16 185 129), rgb(45 212 191))",
              color: "white",
              borderRadius: "1rem 1rem 0 0",
              padding: "2.5rem",
            },
            pricingTableCardTitle: {
              fontSize: "2.25rem",
              fontWeight: "800",
              color: "white",
              marginBottom: "0.5rem",
            },
            pricingTableCardDescription: {
              fontSize: "1.1rem",
              color: "rgba(255, 255, 255, 0.95)",
              fontWeight: "500",
            },
            pricingTableCardFee: {
              color: "white",
              fontWeight: "800",
              fontSize: "3rem",
            },
            pricingTableCardFeePeriod: {
              color: "rgba(255, 255, 255, 0.85)",
              fontSize: "1.1rem",
            },
            pricingTableCard: {
              borderRadius: "1rem",
              border: "2px solid rgb(16 185 129 / 0.2)",
              boxShadow: "0 10px 40px rgba(16, 185, 129, 0.15)",
              transition: "all 0.3s ease",
              overflow: "hidden",
              background: "rgba(255, 255, 255, 0.9)",
              backdropFilter: "blur(10px)",
            },
            pricingTableCardBody: {
              padding: "2.5rem",
            },
            pricingTableCardFeatures: {
              marginTop: "2rem",
              gap: "1rem",
            },
            pricingTableCardFeature: {
              fontSize: "1.05rem",
              padding: "0.75rem 0",
              fontWeight: "500",
            },
            pricingTableCardButton: {
              marginTop: "2rem",
              borderRadius: "0.75rem",
              fontWeight: "700",
              padding: "1rem 2.5rem",
              transition: "all 0.2s ease",
              fontSize: "1.1rem",
              background:
                "linear-gradient(135deg, rgb(16 185 129), rgb(45 212 191))",
              border: "none",
              boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)",
            },
          },
        }}
      />
    </div>
  );
}





