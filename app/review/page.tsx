'use client';

import {
    PromptInput,
    PromptInputActionAddAttachments,
    PromptInputActionMenu,
    PromptInputActionMenuContent,
    PromptInputActionMenuTrigger,
    PromptInputAttachments,
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
import { GlobeIcon, MessageSquare, MicIcon, FileIcon, XIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getMessagesByResource } from './actions';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type FileUIPart } from 'ai';
import { usePromptInputAttachments } from '@/src/components/ai-elements/prompt-input';
import { Button } from '@/components/ui/button';
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

// Helper function to convert FileList to data URLs (AI SDK v5 format)
async function convertFilesToDataURLs(files: FileList) {
    return Promise.all(
        Array.from(files).map(
            file =>
                new Promise<{
                    type: 'file';
                    mediaType: string;
                    url: string;
                }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve({
                            type: 'file',
                            mediaType: file.type,
                            url: reader.result as string,
                        });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                }),
        ),
    );
}

// Helper function to convert Blob URL to data URL
async function convertBlobUrlToDataUrl(blobUrl: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Failed to read blob'));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Generate time-based resourceId (1 hour granularity)
const getResourceId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    return `resource-${year}-${month}-${day}-${hour}`;
};

// Custom attachment component with file name and type display
const CustomAttachment = ({ data }: { data: FileUIPart & { id: string } }) => {
    const attachments = usePromptInputAttachments();

    // Get file type description
    const getFileTypeLabel = () => {
        if (data.mediaType?.includes('pdf')) {
            return 'PDF Document';
        } else if (data.mediaType?.includes('presentation') || data.mediaType?.includes('powerpoint')) {
            return 'PowerPoint Presentation';
        } else if (data.mediaType?.startsWith('image/')) {
            return 'Image';
        }
        return data.mediaType?.split('/')[1]?.toUpperCase() || 'File';
    };

    // Get file extension from filename or mediaType
    const getFileIcon = () => {
        if (data.mediaType?.includes('pdf')) {
            return <FileIcon className="size-6 text-red-500" />;
        } else if (data.mediaType?.includes('presentation') || data.mediaType?.includes('powerpoint')) {
            return <FileIcon className="size-6 text-orange-500" />;
        } else if (data.mediaType?.startsWith('image/')) {
            return null; // Will show image preview
        }
        return <FileIcon className="size-6 text-gray-500" />;
    };

    return (
        <div className="group relative flex items-center gap-3 rounded-lg border bg-card p-3 pr-10 shadow-sm min-w-[250px]">
            {data.mediaType?.startsWith('image/') && data.url ? (
                <img
                    alt={data.filename || 'attachment'}
                    className="h-16 w-16 rounded object-cover flex-shrink-0"
                    src={data.url}
                />
            ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                    {getFileIcon()}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                    {data.filename || 'Untitled'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    {getFileTypeLabel()}
                </p>
            </div>
            <Button
                aria-label="Remove attachment"
                className="absolute -right-2 -top-2 h-7 w-7 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => attachments.remove(data.id)}
                size="icon"
                type="button"
                variant="destructive"
            >
                <XIcon className="h-4 w-4" />
            </Button>
        </div>
    );
};

const ReviewPage = () => {
    const [text, setText] = useState<string>('');
    const [model, setModel] = useState<string>(models[1].id);
    const [useMicrophone, setUseMicrophone] = useState<boolean>(false);
    const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
    const [resourceId] = useState<string>(getResourceId());
    const [threadId, setThreadId] = useState<string | undefined>(undefined);

    const { messages, status, sendMessage, setMessages } = useChat({
        transport: new DefaultChatTransport({
            api: '/api/chat',
        }),
        onFinish({ message }) {
            // Extract threadId from metadata
            if (message.metadata) {
                const metadata = message.metadata as { threadId?: string; resourceId?: string };
                if (metadata.threadId) {
                    setThreadId(metadata.threadId);
                }
            }
        }
    });

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
        const hasAttachments = Boolean(message.files?.length);

        if (!(hasText || hasAttachments)) {
            return;
        }

        // Convert files to data URLs if present
        let fileParts: Array<{ type: 'file'; mediaType: string; url: string }> = [];

        if (message.files && message.files.length > 0) {
            if (message.files instanceof FileList) {
                fileParts = await convertFilesToDataURLs(message.files);
            } else if (Array.isArray(message.files)) {
                fileParts = await Promise.all(
                    message.files.map(async (file: any) => {
                        const dataUrl = await convertBlobUrlToDataUrl(file.url);
                        return {
                            type: 'file' as const,
                            mediaType: file.mediaType || 'application/octet-stream',
                            url: dataUrl,
                        };
                    })
                );
            }
        }

        // Create text part if message text exists
        const textPart = message.text
            ? [{ type: 'text' as const, text: message.text }]
            : [];

        // Send message with parts array (AI SDK v5 format)
        sendMessage(
            {
                role: 'user',
                parts: [...textPart, ...fileParts],
            },
            {
                body: {
                    model: model,
                    webSearch: useWebSearch,
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
                <Conversation className="relative w-full" style={{ height: '500px' }}>
                    <ConversationContent>
                        {messages.length === 0 ? (
                            <ConversationEmptyState
                                icon={<MessageSquare className="size-12" />}
                                title="No messages yet"
                                description="Start a conversation to see messages here"
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
                                                // Type guard for tool parts
                                                if (
                                                    'state' in part &&
                                                    'input' in part &&
                                                    (part.type.startsWith('tool-') || part.type === 'dynamic-tool')
                                                ) {
                                                    return (
                                                        <Tool
                                                            key={`${message.id}-tool-${i}`}
                                                            defaultOpen={
                                                                part.state === 'output-available' ||
                                                                part.state === 'output-error'
                                                            }
                                                        >
                                                            <ToolHeader
                                                                type={part.type as `tool-${string}`}
                                                                state={part.state}
                                                            />
                                                            <ToolContent>
                                                                <ToolInput input={part.input} />
                                                                {part.state === 'output-available' &&
                                                                    'output' in part && (
                                                                        <ToolOutput
                                                                            output={JSON.stringify(part.output, null, 2)}
                                                                            errorText={undefined}
                                                                        />
                                                                    )}
                                                                {part.state === 'output-error' &&
                                                                    'errorText' in part && (
                                                                        <ToolOutput
                                                                            output={undefined}
                                                                            errorText={part.errorText}
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
                                            name={message.role === 'user' ? 'User' : 'AI Assistant'}
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
                    globalDrop
                    multiple
                >
                    <PromptInputBody>
                        <PromptInputAttachments className="gap-2 p-2 min-h-0">
                            {(attachment) => <CustomAttachment data={attachment} />}
                        </PromptInputAttachments>
                        <PromptInputTextarea
                            onChange={(e) => setText(e.target.value)}
                            value={text}
                        />
                    </PromptInputBody>
                    <PromptInputToolbar>
                        <PromptInputTools>
                            <PromptInputActionMenu>
                                <PromptInputActionMenuTrigger />
                                <PromptInputActionMenuContent>
                                    <PromptInputActionAddAttachments />
                                </PromptInputActionMenuContent>
                            </PromptInputActionMenu>
                            <PromptInputButton
                                onClick={() => setUseMicrophone(!useMicrophone)}
                                variant={useMicrophone ? 'default' : 'ghost'}
                            >
                                <MicIcon size={16} />
                                <span className="sr-only">Microphone</span>
                            </PromptInputButton>
                            <PromptInputButton
                                onClick={() => setUseWebSearch(!useWebSearch)}
                                variant={useWebSearch ? 'default' : 'ghost'}
                            >
                                <GlobeIcon size={16} />
                                <span>Search</span>
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

export default ReviewPage;
