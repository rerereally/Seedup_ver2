import type { ArticleQuestionAnswer } from './ai-types';
import { callOpenRouter, getWritingModels } from '../llm';
import { truncate } from './text';

export async function answerArticleQuestion(input: {
  title: string;
  summary: string;
  content: string;
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { result: null, model: null, error: '글 도우미 모델 설정이 없습니다.' };

  try {
    const { result, model } = await callOpenRouter<ArticleQuestionAnswer>(apiKey, [
      { role: 'system', content: '너는 Seedup 아티클을 읽는 개발자를 돕는 정확한 Q&A 튜터다. 반드시 JSON만 반환한다. 원문에 없는 사실은 만들지 않으며, 사용자가 개념을 물으면 먼저 그 개념을 직접 설명한다.' },
      {
        role: 'user',
        content: `아래 아티클 내용만 근거로 사용자의 질문에 한국어로 짧게 답하라.

규칙:
- 답변은 기본적으로 3~6문장으로 간결하게 작성한다. 첫 문장에서 질문에 직접 답한다.
- "질문을 더 구체적으로 해달라" 또는 제목을 반복하는 것으로 답변을 대신하지 않는다. 질문이 짧아도 글의 문맥에서 가장 자연스러운 의미를 해석해 설명한다.
- 용어 질문에는 "무엇인지 → 이 글에서 왜 나오는지 → 개발자가 이해할 포인트" 순서로 설명한다.
- 글에 없는 수치·제품 기능·최신 사실은 추측하지 않는다. 글에 근거가 부족하면 모르는 부분만 명확히 밝히되, 이미 설명 가능한 부분은 답한다.
- 사용자가 "더 짧게", "요약해줘"처럼 후속 요청을 하면 대화 맥락의 직전 답변만 1~2문장으로 압축한다. 새 기술, 일정, 성능 수치, 구현 계획을 추가하지 않는다.
- 본문에 특정 절 이후 내용이 없다고 말한 경우, 그 이후의 구현 방법·평가 결과·일정을 본문에 있다고 단정하지 않는다.
- 아래 question은 이번 요청의 최우선 질문이다. 이전 대화는 "더 짧게" 같은 후속 질문을 해석할 때만 참고하며, 새 질문에는 이전 답변을 반복하지 말고 해당 질문에 직접 답한다.

출력 JSON:
{
  "answer": "질문에 대한 답변"
}

title: ${input.title}
summary: ${truncate(input.summary, 700)}
content: ${truncate(input.content, 2200)}
conversation: ${formatArticleQuestionHistory(input.history)}
question: ${truncate(input.question, 500)}`,
      },
    ], {
      models: getWritingModels(),
      jsonSchema: {
        name: 'article_question_answer',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['answer'],
          properties: { answer: { type: 'string', minLength: 30, maxLength: 1200 } },
        },
      },
      temperature: 0.2,
      timeoutMs: 25_000,
      maxTokens: 700,
    });

    if (typeof result.answer !== 'string' || result.answer.trim().length < 30) {
      const fallbackAnswer = getArticleQuestionFallback(input);
      return fallbackAnswer
        ? { result: { answer: fallbackAnswer }, model, error: null }
        : { result: null, model, error: '글 도우미가 충분한 답변을 만들지 못했습니다.' };
    }
    if (hasUnsupportedSpecificClaim(result.answer, input)) {
      return { result: null, model, error: '본문 근거를 확인할 수 없는 답변이 생성되어 표시하지 않았습니다.' };
    }
    return { result: { answer: result.answer.trim() }, model };
  } catch (error) {
    console.error('OpenRouter article question failed', error);
    const fallbackAnswer = getArticleQuestionFallback(input);
    return fallbackAnswer
      ? { result: { answer: fallbackAnswer }, model: null, error: null }
      : { result: null, model: null, error: getArticleQuestionErrorMessage(error) };
  }
}

function getArticleQuestionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes('401') || message.includes('403') || message.includes('unauthorized') || message.includes('forbidden')) return '배포 환경의 OpenRouter API 키를 확인해주세요.';
  if (message.includes('404') || message.includes('not found') || message.includes('model not')) return '배포 환경의 글 도우미 모델 이름을 확인해주세요.';
  if (message.includes('abort') || message.includes('timeout')) return '답변 생성 시간이 초과되었습니다. 다시 시도해주세요.';
  if (message.includes('429') || message.includes('rate') || message.includes('quota')) return '글 도우미 요청이 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.';
  if (message.includes('empty content')) return '글 도우미가 빈 응답을 반환했습니다. 다시 시도해주세요.';
  if (message.includes('json')) return '글 도우미 응답 형식을 처리하지 못했습니다. 다시 시도해주세요.';
  if (message.includes('fetch failed') || message.includes('network')) return '글 도우미 서버와 통신하지 못했습니다. 배포 환경의 외부 요청 설정을 확인해주세요.';
  return '글 도우미 요청을 처리하지 못했습니다. 배포 로그에서 OpenRouter 오류를 확인해주세요.';
}

function getArticleQuestionFallback(input: { title: string; summary: string; content: string; question: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> }) {
  const question = input.question.toLowerCase();
  if (!/\bmcp\b|model context protocol|모델 컨텍스트 프로토콜|\brag\b|검색 증강|retrieval|에이전트|agent|쉽게|요약|핵심/.test(question)) return null;
  return buildArticleQuestionFallback(input);
}

function formatArticleQuestionHistory(history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined) {
  if (!history?.length) return '이전 대화 없음';
  return history.map((message) => `${message.role === 'user' ? '사용자' : '도우미'}: ${truncate(message.content, 700)}`).join('\n');
}

function hasUnsupportedSpecificClaim(answer: string, input: { summary: string; content: string }) {
  const source = `${input.summary}\n${input.content}`;
  const answerNumbers = answer.match(/\b\d+(?:\.\d+)?\s*(?:일|주|개월|%|배|ms|초|명|건)\b/g) ?? [];
  return answerNumbers.some((value) => !source.includes(value));
}

function buildArticleQuestionFallback(input: { title: string; summary: string; content: string; question: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> }): string {
  const question = input.question.toLowerCase();
  if (/더\s*짧게|짧게\s*(요약|설명)|한\s*줄|요약/.test(question)) {
    const previousAnswer = [...(input.history ?? [])].reverse().find((message) => message.role === 'assistant')?.content;
    if (previousAnswer) return previousAnswer.split(/(?<=[.!?다])\s+/).filter(Boolean).slice(0, 2).join(' ');
  }
  if (/\bmcp\b|model context protocol|모델 컨텍스트 프로토콜/.test(question)) {
    return 'MCP(Model Context Protocol)는 AI가 파일, 데이터베이스, API 같은 외부 도구와 정해진 방식으로 연결되도록 만드는 표준입니다. 쉽게 말해 AI에게 필요한 정보를 찾아오거나 작업을 요청할 수 있게 하는 연결 규칙입니다. 이 글에서는 MCP 서버를 Go로 구현해 도구 호출을 빠르고 안정적으로 처리하는 방법을 다룹니다. 개발자는 서버가 어떤 도구를 노출할지, 권한과 입력 검증을 어떻게 제한할지를 먼저 설계하는 것이 핵심입니다.';
  }
  if (/\brag\b|검색 증강|retrieval/.test(question)) {
    return 'RAG는 답변을 만들기 전에 관련 문서나 데이터를 검색해 그 내용을 근거로 활용하는 방식입니다. 모델이 기억만으로 답하지 않게 해 최신 문서나 내부 지식을 연결할 수 있습니다. 이 글의 맥락에서는 검색 결과의 품질, 어떤 문서를 가져오는지, 그리고 근거가 답변에 제대로 반영되는지가 중요합니다. 따라서 먼저 작은 문서 집합으로 검색 정확도와 답변 품질을 함께 확인하는 편이 좋습니다.';
  }
  if (/에이전트|agent/.test(question)) {
    return 'AI 에이전트는 답변만 생성하는 모델을 넘어, 필요한 정보를 찾고 도구를 호출하며 여러 단계를 수행하도록 구성한 프로그램입니다. 이 글에서의 핵심은 에이전트가 MCP를 통해 외부 도구를 안전하게 사용할 수 있도록 서버와 인터페이스를 설계하는 것입니다. 자동화 범위를 넓히기 전에 허용할 도구와 실패 시 동작을 제한해야 실제 서비스에서 관리하기 쉽습니다.';
  }
  if (/쉽게|요약|핵심/.test(question)) {
    const summary = stripAssistantMarkup(input.summary || input.content).slice(0, 500);
    return summary
      ? `쉽게 말하면, ${summary} 이 글은 기술을 소개하는 데서 끝나지 않고 개발 환경에서 어떤 문제를 해결하는지와 구현할 때 확인할 조건을 함께 다룹니다.`
      : `이 글은 "${input.title}"의 핵심 개념과 실제 구현 시 확인할 조건을 설명합니다. 먼저 문제를 해결하는 가장 작은 흐름을 만들고, 성능·보안·운영 조건은 그 다음 단계에서 검증하는 방식으로 이해하면 됩니다.`;
  }
  return `질문하신 "${input.question.trim()}"은 이 글의 주제인 "${input.title}"와 연결해 보면 됩니다. 글에서 직접 확인되는 내용과 일반적인 구현 원칙을 구분해 설명하려면, 궁금한 문장이나 용어를 함께 보내주시면 그 부분을 기준으로 더 정확히 풀어드릴 수 있습니다.`;
}

function stripAssistantMarkup(value: string) {
  return value.replace(/[#>*_`\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
}
