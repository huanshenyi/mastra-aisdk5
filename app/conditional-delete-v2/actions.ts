'use server';

import { mastra } from '@/src/mastra';

/**
 * Get messages by resourceId from Mastra Memory
 */
export async function getMessagesByResource(resourceId: string): Promise<any[]> {
    try {
        const conditionalDeleteAgent = mastra.getAgent('conditionalDeleteAgent');
        const memory = await conditionalDeleteAgent.getMemory()

        if (!memory) {
            return [];
        }

        const result = await memory.query({ threadId: resourceId });

        // Return messages from memory
        if (result && 'messages' in result && Array.isArray(result.messages)) {
            return result.messages;
        }

        return [];
    } catch (error) {
        console.error('Error fetching messages:', error);
        return [];
    }
}
