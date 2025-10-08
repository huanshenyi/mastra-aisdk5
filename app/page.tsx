'use client';

import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
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
import { GlobeIcon, MessageSquare, MicIcon } from 'lucide-react';
import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type ToolUIPart } from 'ai';
import { Button } from '@/components/ui/button';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/src/components/ai-elements/conversation';
import { Message, MessageContent } from '@/src/components/ai-elements/message';
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

type WeatherToolInput = {
  location: string;
};

type WeatherToolOutput = {
  location: string;
  temperature: string;
  conditions: string;
  humidity: string;
  windSpeed: string;
  lastUpdated: string;
};

type WeatherToolUIPart = ToolUIPart<{
  weatherTool: {
    input: WeatherToolInput;
    output: WeatherToolOutput;
  };
}>;

const models = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'claude-sonnet-4.5-20250929', name: 'Sonnet 4.5' },
];

const InputDemo = () => {
  const [text, setText] = useState<string>('');
  const [model, setModel] = useState<string>(models[1].id);
  const [useMicrophone, setUseMicrophone] = useState<boolean>(false);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);

  const { messages, status, sendMessage, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    onToolCall({ toolCall }) {
      console.log("toolCall.toolName:", toolCall.toolName) //webSearchServer_tavily_search
    }
  });

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    sendMessage(
      {
        text: message.text || 'Sent with attachments',
        files: message.files
      },
      {
        body: {
          model: model,
          webSearch: useWebSearch,
        },
      },
    );
    setText('');
  };

  const handleWeatherClick = () => {
    sendMessage({ text: 'Get weather data for San Francisco' });
  };

  const latestMessage = messages[messages.length - 1];
  const weatherTool = latestMessage?.parts?.find(
    (part) => part.type === 'tool-vercelWeatherTool', //tool-weatherTool
  ) as WeatherToolUIPart | undefined;

  // console.log("weatherTool output", weatherTool?.output)

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full rounded-lg border h-[600px]">
      <div className="flex flex-col h-full">
        <div className="space-y-4">
          <Button onClick={handleWeatherClick} disabled={status !== 'ready'}>
            Get Weather for San Francisco
          </Button>

          {weatherTool && (
            <Tool defaultOpen={true}>
              <ToolHeader type="tool-vercelWeatherTool" state={weatherTool.state} />
              <ToolContent>
                <ToolInput input={weatherTool.input} />
                <ToolOutput
                  output={weatherTool.output}
                  errorText={weatherTool.errorText}
                />
              </ToolContent>
            </Tool>
          )}
        </div>

        <Conversation className="relative w-full" style={{ height: '500px' }}>
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageSquare className="size-12" />}
                title="No messages yet"
                description="Start a conversation to see messages here"
              />
            ) : (
              messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {message.parts.map((part, i) => {
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
                                i === message.parts.length - 1 &&
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
                </Message>
              ))
            )}
            {status === 'submitted' && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput onSubmit={handleSubmit} className="mt-4" globalDrop multiple>
          <PromptInputBody>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
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

function formatWeatherResult(result: WeatherToolOutput): string {
  return `**Weather for ${result.location}**

**Temperature:** ${result.temperature}
**Conditions:** ${result.conditions}
**Humidity:** ${result.humidity}
**Wind Speed:** ${result.windSpeed}

*Last updated: ${result.lastUpdated}*`;
}

export default InputDemo;
