'use client';

import {
    PromptInput,
    PromptInputBody,
    PromptInputButton,
    type PromptInputMessage,
    PromptInputModelSelect,
    PromptInputModelSelectContent,
    PromptInputModelSelectItem,
    PromptInputModelSelectTrigger,
    PromptInputModelSelectValue,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputToolbar,
    PromptInputTools,
} from '@/src/components/ai-elements/prompt-input';
import { Trash2, MessageSquare, MicIcon, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { getMessagesByResource } from './actions';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton,
} from '@/src/components/ai-elements/conversation';
import { Message, MessageContent, MessageAvatar } from '@/src/components/ai-elements/message';
import { Response } from '@/src/components/ai-elements/response';
import { Loader } from '@/src/components/ai-elements/loader';
import {
    Tool,
    ToolContent,
    ToolHeader,
    ToolInput,
    ToolOutput,
} from '@/src/components/ai-elements/tool';
import {
    Reasoning,
    ReasoningContent,
    ReasoningTrigger,
} from '@/src/components/ai-elements/reasoning';

const models = [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'claude-sonnet-4.5-20250929', name: 'Sonnet 4.5' },
];

// Generate time-based resourceId (1 hour granularity)
const getResourceId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    return `delete-resource-${year}-${month}-${day}-${hour}`;
};

const DeletePage = () => {
    const [text, setText] = useState<string>('');
    const [model, setModel] = useState<string>(models[1].id);
    const [useMicrophone, setUseMicrophone] = useState<boolean>(false);
    const [resourceId] = useState<string>(getResourceId());
    const [threadId, setThreadId] = useState<string | undefined>(undefined);
    const [runId, setRunId] = useState<string | undefined>(undefined);

    const { messages, status, sendMessage, setMessages } = useChat({
        transport: new DefaultChatTransport({
            api: '/api/delete',
        }),
        onFinish({ message }) {
            // Extract threadId and runId from metadata
            if (message.metadata) {
                const metadata = message.metadata as { threadId?: string; resourceId?: string; runId?: string };
                if (metadata.threadId) {
                    setThreadId(metadata.threadId);
                }
                if (metadata.runId) {
                    setRunId(metadata.runId);
                }
            }
        }
    });

    // Handle approval/denial using Mastra's native agent methods
    const handleApproval = async (toolCallId: string, approved: boolean) => {
        if (!runId) {
            console.error('No runId available for approval');
            return;
        }

        try {
            // Call the Mastra approval endpoint
            const response = await fetch('/api/delete/approve', {
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

            // Wait a moment for the agent to complete, then refresh messages from memory
            setTimeout(async () => {
                const updatedMessages = await getMessagesByResource(resourceId);
                if (updatedMessages && updatedMessages.length > 0) {
                    setMessages(updatedMessages);
                }
            }, 1000);
        } catch (error) {
            console.error('Error handling approval:', error);
        }
    };

    // Fetch existing messages on mount and set them
    useEffect(() => {
        const fetchMessages = async () => {
            const existingMessages = await getMessagesByResource(resourceId);
            if (existingMessages && existingMessages.length > 0) {
                setMessages(existingMessages);
            }
        };
        fetchMessages();
    }, [resourceId, setMessages]);

    const handleSubmit = async (message: PromptInputMessage) => {
        const hasText = Boolean(message.text);

        if (!hasText) {
            return;
        }

        // Send message with text only (AI SDK v5 format)
        sendMessage(
            {
                role: 'user',
                parts: [{ type: 'text' as const, text: message.text! }],
            },
            {
                body: {
                    model: model,
                    resourceId: resourceId,
                    threadId: threadId,
                },
            },
        );
        setText('');
    };

    return (
        <div className="max-w-4xl mx-auto p-6 relative size-full rounded-lg border h-[600px]">
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                    <Trash2 className="size-6 text-red-500" />
                    <div>
                        <h1 className="text-2xl font-bold">削除エージェント</h1>
                        <p className="text-sm text-muted-foreground">データベースからレコードを安全に削除します</p>
                    </div>
                </div>

                <Conversation className="relative w-full" style={{ height: '450px' }}>
                    <ConversationContent>
                        {messages.length === 0 ? (
                            <ConversationEmptyState
                                icon={<MessageSquare className="size-12" />}
                                title="メッセージがありません"
                                description="削除したいテーブル名とレコード数を入力してください"
                            />
                        ) : (
                            messages.map((message) => {
                                // Separate tool parts from text/reasoning parts
                                const toolParts = message.parts.filter((part) =>
                                    part.type.startsWith('tool-')
                                );
                                const contentParts = message.parts.filter(
                                    (part) => part.type === 'text' || part.type === 'reasoning'
                                );

                                return (
                                    <Message from={message.role} key={message.id}>
                                        <div className={`flex flex-col gap-2 w-full max-w-[80%] ${message.role === 'user' && 'items-end'}`}>
                                            {/* Render tools with same width constraints as message */}
                                            {toolParts.map((part, i) => {
                                                // Type guard for tool parts with approval support
                                                const partWithApproval = part as any;

                                                if (
                                                    'state' in partWithApproval &&
                                                    'input' in partWithApproval &&
                                                    (partWithApproval.type.startsWith('tool-') || partWithApproval.type === 'dynamic-tool')
                                                ) {
                                                    // Handle approval-requested state
                                                    if (partWithApproval.state === 'approval-requested' && 'approval' in partWithApproval) {
                                                        const approval = partWithApproval.approval;
                                                        const input = partWithApproval.input;

                                                        return (
                                                            <div key={`${message.id}-tool-${i}`} className="w-full rounded-lg border border-orange-300 bg-orange-50 p-4 shadow-sm">
                                                                <div className="flex items-start gap-3">
                                                                    <Trash2 className="size-5 text-orange-600 mt-1 flex-shrink-0" />
                                                                    <div className="flex-1 space-y-3">
                                                                        <div>
                                                                            <h3 className="font-semibold text-orange-900">削除の承認が必要です</h3>
                                                                            <p className="text-sm text-orange-800 mt-1">
                                                                                ⚠️ この操作は取り消すことができません
                                                                            </p>
                                                                        </div>
                                                                        <div className="bg-white rounded p-3 space-y-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-sm font-medium text-gray-700">テーブル:</span>
                                                                                <span className="text-sm font-bold text-gray-900">{input.table}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-sm font-medium text-gray-700">削除件数:</span>
                                                                                <span className="text-sm font-bold text-red-600">{input.count}件</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <Button
                                                                                size="sm"
                                                                                variant="default"
                                                                                className="bg-green-600 hover:bg-green-700"
                                                                                onClick={() => handleApproval(approval.id, true)}
                                                                            >
                                                                                <Check className="size-4 mr-1" />
                                                                                承認する
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="border-red-300 text-red-700 hover:bg-red-50"
                                                                                onClick={() => handleApproval(approval.id, false)}
                                                                            >
                                                                                <X className="size-4 mr-1" />
                                                                                拒否する
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    // Handle other tool states
                                                    return (
                                                        <Tool
                                                            key={`${message.id}-tool-${i}`}
                                                            defaultOpen={
                                                                partWithApproval.state === 'output-available' ||
                                                                partWithApproval.state === 'output-error'
                                                            }
                                                        >
                                                            <ToolHeader
                                                                type={partWithApproval.type as `tool-${string}`}
                                                                state={partWithApproval.state}
                                                            />
                                                            <ToolContent>
                                                                <ToolInput input={partWithApproval.input} />
                                                                {partWithApproval.state === 'output-available' &&
                                                                    'output' in partWithApproval && (
                                                                        <ToolOutput
                                                                            output={JSON.stringify(partWithApproval.output, null, 2)}
                                                                            errorText={undefined}
                                                                        />
                                                                    )}
                                                                {partWithApproval.state === 'output-error' &&
                                                                    'errorText' in partWithApproval && (
                                                                        <ToolOutput
                                                                            output={undefined}
                                                                            errorText={partWithApproval.errorText}
                                                                        />
                                                                    )}
                                                            </ToolContent>
                                                        </Tool>
                                                    );
                                                }
                                                return null;
                                            })}

                                            {/* Render message content */}
                                            {contentParts.length > 0 && (
                                                <MessageContent>
                                                    {contentParts.map((part, i) => {
                                                        switch (part.type) {
                                                            case 'text':
                                                                return (
                                                                    <Response key={`${message.id}-${i}`}>
                                                                        {part.text}
                                                                    </Response>
                                                                );
                                                            case 'reasoning':
                                                                return (
                                                                    <Reasoning
                                                                        key={`${message.id}-${i}`}
                                                                        className="w-full"
                                                                        isStreaming={
                                                                            status === 'streaming' &&
                                                                            i === contentParts.length - 1 &&
                                                                            message.id === messages.at(-1)?.id
                                                                        }
                                                                    >
                                                                        <ReasoningTrigger />
                                                                        <ReasoningContent>{part.text}</ReasoningContent>
                                                                    </Reasoning>
                                                                );
                                                            default:
                                                                return null;
                                                        }
                                                    })}
                                                </MessageContent>
                                            )}
                                        </div>
                                        <MessageAvatar
                                            src={
                                                message.role === 'user'
                                                    ? 'https://github.com/shadcn.png'
                                                    : 'https://github.com/vercel.png'
                                            }
                                            name={message.role === 'user' ? 'ユーザー' : '削除エージェント'}
                                        />
                                    </Message>
                                );
                            })
                        )}
                        {status === 'submitted' && <Loader />}
                    </ConversationContent>
                    <ConversationScrollButton />
                </Conversation>

                <PromptInput
                    onSubmit={handleSubmit}
                    className="mt-4"
                >
                    <PromptInputBody>
                        <PromptInputTextarea
                            onChange={(e) => setText(e.target.value)}
                            value={text}
                            placeholder="例: usersテーブルから10件のレコードを削除"
                        />
                    </PromptInputBody>
                    <PromptInputToolbar>
                        <PromptInputTools>
                            <PromptInputButton
                                onClick={() => setUseMicrophone(!useMicrophone)}
                                variant={useMicrophone ? 'default' : 'ghost'}
                            >
                                <MicIcon size={16} />
                                <span className="sr-only">マイク</span>
                            </PromptInputButton>
                            <PromptInputModelSelect
                                onValueChange={(value) => {
                                    setModel(value);
                                }}
                                value={model}
                            >
                                <PromptInputModelSelectTrigger>
                                    <PromptInputModelSelectValue />
                                </PromptInputModelSelectTrigger>
                                <PromptInputModelSelectContent>
                                    {models.map((model) => (
                                        <PromptInputModelSelectItem key={model.id} value={model.id}>
                                            {model.name}
                                        </PromptInputModelSelectItem>
                                    ))}
                                </PromptInputModelSelectContent>
                            </PromptInputModelSelect>
                        </PromptInputTools>
                        <PromptInputSubmit disabled={!text && !status} status={status} />
                    </PromptInputToolbar>
                </PromptInput>
            </div>
        </div>
    );
};

export default DeletePage;
