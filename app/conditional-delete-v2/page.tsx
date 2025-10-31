'use client';

import { Trash2, MessageSquare, Check, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect, useRef } from 'react';
import { getMessagesByResource } from './actions';

// Generate time-based resourceId (1 hour granularity)
const getResourceId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    return `conditional-delete-v2-resource-${year}-${month}-${day}-${hour}`;
};

interface MastraMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    metadata?: any;
}

interface ToolCall {
    id: string;
    name: string;
    args: any;
    result?: any;
    suspended?: boolean;
}

const ConditionalDeleteV2Page = () => {
    const [text, setText] = useState<string>('');
    const [messages, setMessages] = useState<MastraMessage[]>([]);
    const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [resourceId] = useState<string>(getResourceId());
    const [threadId, setThreadId] = useState<string | undefined>(undefined);
    const [runId, setRunId] = useState<string | undefined>(undefined);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, toolCalls]);

    // Fetch existing messages on mount
    useEffect(() => {
        const fetchMessages = async () => {
            const existingMessages = await getMessagesByResource(resourceId);
            if (existingMessages && existingMessages.length > 0) {
                // Convert Mastra messages to display format
                const displayMessages: MastraMessage[] = existingMessages.map((msg: any) => ({
                    id: msg.id || String(Math.random()),
                    role: msg.role,
                    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                    metadata: msg.metadata,
                }));
                setMessages(displayMessages);
            }
        };
        fetchMessages();
    }, [resourceId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!text.trim()) {
            return;
        }

        const userMessage: MastraMessage = {
            id: String(Date.now()),
            role: 'user',
            content: text,
        };

        setMessages(prev => [...prev, userMessage]);
        setText('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/conditional-delete-v2', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        ...messages.map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: text }
                    ],
                    resourceId,
                    threadId,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            await processStream(response);
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const processStream = async (response: Response) => {
        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = '';
        let currentMessage = '';
        let currentMessageId = String(Date.now());
        let currentToolCalls: ToolCall[] = [];

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'metadata') {
                            setThreadId(data.threadId);
                            setRunId(data.runId);
                        } else if (data.type === 'text-start') {
                            // Start of a new assistant message
                            currentMessage = '';
                            currentMessageId = String(Date.now());
                        } else if (data.type === 'text-delta') {
                            // Streaming text chunk
                            currentMessage += data.payload.text;
                            setMessages(prev => {
                                const newMessages = [...prev];
                                const lastMsg = newMessages[newMessages.length - 1];
                                if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === currentMessageId) {
                                    lastMsg.content = currentMessage;
                                } else {
                                    newMessages.push({
                                        id: currentMessageId,
                                        role: 'assistant',
                                        content: currentMessage,
                                    });
                                }
                                return newMessages;
                            });
                        } else if (data.type === 'tool-call') {
                            const toolCall: ToolCall = {
                                id: data.payload.toolCallId,
                                name: data.payload.toolName,
                                args: data.payload.args,
                            };
                            currentToolCalls.push(toolCall);
                            setToolCalls(prev => [...prev, toolCall]);
                        } else if (data.type === 'tool-call-suspended') {
                            const suspendedCall: ToolCall = {
                                id: data.payload.toolCallId,
                                name: data.payload.toolName,
                                args: data.payload.suspendPayload,
                                suspended: true,
                            };
                            setToolCalls(prev => {
                                const newCalls = [...prev];
                                const existingIdx = newCalls.findIndex(c => c.id === suspendedCall.id);
                                if (existingIdx >= 0) {
                                    newCalls[existingIdx] = suspendedCall;
                                } else {
                                    newCalls.push(suspendedCall);
                                }
                                return newCalls;
                            });
                        } else if (data.type === 'tool-result') {
                            const { toolCallId, result } = data.payload;
                            setToolCalls(prev => {
                                const newCalls = [...prev];
                                const existingIdx = newCalls.findIndex(c => c.id === toolCallId);
                                if (existingIdx >= 0) {
                                    newCalls[existingIdx].result = result;
                                    newCalls[existingIdx].suspended = false;
                                }
                                return newCalls;
                            });
                        } else if (data.type === 'text-end') {
                            // Text streaming complete for this message
                            console.log('Text streaming complete for message:', currentMessageId);
                        } else if (data.type === 'step-start') {
                            console.log('Step started:', data.payload);
                        } else if (data.type === 'step-finish') {
                            console.log('Step finished:', data.payload);
                        } else if (data.type === 'finish') {
                            console.log('Stream finished');
                            currentMessage = '';
                            currentMessageId = String(Date.now());
                        } else {
                            // Log unhandled chunk types for debugging
                            console.log('Unhandled chunk type:', data.type, data);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    };

    const handleApproval = async (toolCallId: string, approved: boolean) => {
        if (!runId) {
            console.error('No runId available for approval');
            return;
        }

        try {
            const response = await fetch('/api/conditional-delete-v2/resume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    runId,
                    toolCallId,
                    approved,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to process approval');
            }

            // Process the resume stream
            await processStream(response);

            // Remove the tool call from the list after processing
            setToolCalls(prev => prev.filter(call => call.id !== toolCallId));
        } catch (error) {
            console.error('Error handling approval:', error);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 relative size-full rounded-lg border h-[600px]">
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                    <div className="flex items-center gap-2">
                        <Trash2 className="size-6 text-blue-500" />
                        <Zap className="size-4 text-yellow-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">条件付き削除エージェント V2</h1>
                        <p className="text-sm text-muted-foreground">
                            Mastra生フォーマット対応版 - 10件以下は承認不要、11件以上は承認が必要です
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <MessageSquare className="size-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-semibold mb-2">メッセージがありません</h3>
                            <p className="text-sm text-muted-foreground">
                                削除したいテーブル名とレコード数を入力してください
                            </p>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex gap-3 ${
                                    message.role === 'user' ? 'justify-end' : 'justify-start'
                                }`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg p-4 ${
                                        message.role === 'user'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 text-gray-900'
                                    }`}
                                >
                                    <div className="whitespace-pre-wrap">{message.content}</div>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Display tool calls waiting for approval */}
                    {toolCalls.filter(call => call.suspended).map((call) => (
                        <div key={call.id} className="w-full rounded-lg border border-blue-300 bg-blue-50 p-4 shadow-sm">
                            <div className="flex items-start gap-3">
                                <Zap className="size-5 text-blue-600 mt-1 flex-shrink-0" />
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <h3 className="font-semibold text-blue-900">削除の承認が必要です（11件以上）</h3>
                                        <p className="text-sm text-blue-800 mt-1">
                                            ⚠️ この操作は取り消すことができません
                                        </p>
                                        <p className="text-xs text-blue-700 mt-1">
                                            Mastra生フォーマット使用
                                        </p>
                                    </div>
                                    <div className="bg-white rounded p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-700">テーブル:</span>
                                            <span className="text-sm font-bold text-gray-900">{call.args.table}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-700">削除件数:</span>
                                            <span className="text-sm font-bold text-red-600">{call.args.count}件</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="default"
                                            className="bg-green-600 hover:bg-green-700"
                                            onClick={() => handleApproval(call.id, true)}
                                        >
                                            <Check className="size-4 mr-1" />
                                            承認する
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-red-300 text-red-700 hover:bg-red-50"
                                            onClick={() => handleApproval(call.id, false)}
                                        >
                                            <X className="size-4 mr-1" />
                                            拒否する
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 rounded-lg p-4">
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                                    <span className="text-sm text-gray-600">処理中...</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSubmit} className="border-t pt-4">
                    <div className="flex gap-2">
                        <Textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="例: usersテーブルから5件のレコードを削除（承認不要）/ usersテーブルから15件削除（承認必要）"
                            className="flex-1 min-h-[80px]"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                        />
                        <Button type="submit" disabled={!text.trim() || isLoading}>
                            送信
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ConditionalDeleteV2Page;
