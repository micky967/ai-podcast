import { inngest } from "@/inngest/client";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        console.log("[AssemblyAI Webhook] Received event:", {
            transcriptId: body.transcript_id,
            status: body.status,
        });

        // Only process completed or error statuses
        if (body.status === "completed" || body.status === "error") {
            // Send Inngest event to resume the workflow
            await inngest.send({
                name: "assemblyai/transcription.completed",
                data: {
                    transcriptId: body.transcript_id,
                    status: body.status,
                    error: body.error || null,
                    // Include full transcript data for completed transcriptions
                    transcript: body.status === "completed" ? body : null,
                },
            });

            console.log(`[AssemblyAI Webhook] Sent Inngest event for transcript ${body.transcript_id}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[AssemblyAI Webhook] Error processing webhook:", error);
        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        );
    }
}
