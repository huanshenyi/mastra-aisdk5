'use server';

import { mastra } from '@/src/mastra';
import type { UIMessage } from 'ai';

/**
 * Get messages by resourceId from Mastra Memory
 */
export async function getMessagesByResource(resourceId: string): Promise<UIMessage[]> {
    try {
        const reviewAgent = mastra.getAgent('reviewAgent');
        const memory = await reviewAgent.getMemory()

        if (!memory) {
            return [];
        }

        const result = await memory.query({ threadId: resourceId });

        // Return uiMessages if they exist
        if (result && 'uiMessages' in result && Array.isArray(result.uiMessages)) {
            return result.uiMessages as UIMessage[];
        }

        return [];
    } catch (error) {
        console.error('Error fetching messages:', error);
        return [];
    }
}
